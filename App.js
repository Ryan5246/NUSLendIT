import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { auth, db } from './firebaseConfig';

import { HomeScreen, LoginScreen, SignUpScreen } from './screens/HomeScreen';
import SetUsernameScreen from './screens/SetUsernameScreen';
import PostOTPScreen from './screens/PostOTPScreen';
import ProfileActivityScreen from './screens/ProfileActivityScreen';

import TabNavigator from './TabNavigator';

import * as Notifications from 'expo-notifications';

import {
  onAuthStateChanged
} from 'firebase/auth';

import {
  doc,
  setDoc,
  collection,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where
} from 'firebase/firestore';

import {
  registerForPushNotificationsAsync,
  cancelReturnRemindersForTransaction,
  scheduleReturnReminder
} from './utils/notifications';

const Stack = createStackNavigator();
export const navigationRef = createNavigationContainerRef();
let pendingNotificationData = null;

const getActiveRoute = (route) => {
  if (!route?.state?.routes) return route;
  return getActiveRoute(route.state.routes[route.state.index || 0]);
};

const navigateToChat = (data) => {
  if (!data?.chatId) return;

  navigationRef.navigate('MainTabs', {
    screen: 'Chat',
    params: {
      screen: 'ChatConversation',
      params: {
        chatId: data.chatId,
        itemTitle: data.itemTitle || 'Item',
        peerId: data.peerId,
        peerUsername: data.peerUsername || 'student'
      },
      initial: false
    }
  });
};

const openNotificationTarget = async (data) => {
  if (!data) return;

  if (!navigationRef.isReady()) {
    pendingNotificationData = data;
    return;
  }

  if (data.type === 'nearby_item_request') {
    navigationRef.navigate('MainTabs', {
      screen: 'Search',
      params: { initialTab: 'Request' }
    });
    return;
  }
  if (data.chatId) {
    const chatData = { ...data };

    try {
      const chatSnapshot = await getDoc(doc(db, 'chats', data.chatId));
      const chat = chatSnapshot.exists() ? chatSnapshot.data() : null;

      chatData.itemTitle = chatData.itemTitle || chat?.itemTitle;
      chatData.peerId =
        chatData.peerId ||
        chat?.participants?.find(id => id !== auth.currentUser?.uid);

      if (chatData.peerId && !chatData.peerUsername) {
        const profileSnapshot = await getDoc(
          doc(db, 'username', chatData.peerId)
        );
        chatData.peerUsername = profileSnapshot.data()?.username;
      }
    } catch (error) {
      console.error('Could not load chat notification details:', error);
    }

    navigateToChat(chatData);
  }
};
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data || {};
    if (navigationRef.isReady()) {
      const rootState = navigationRef.getRootState();
      const currentRoute = getActiveRoute(rootState?.routes?.[rootState.index || 0]) || navigationRef.getCurrentRoute();
      const isViewingActiveChat =
        currentRoute?.name === 'ChatConversation' &&
        (currentRoute?.params?.chatId === data.chatId || currentRoute?.params?.params?.chatId === data.chatId);

      if (isViewingActiveChat) {
        return {
          shouldShowBanner: false,
          shouldShowList: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        };
      }
    }
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
});

export default function App() {
  useEffect(() => {
    let unsubscribeReturnUpdates = () => { };

    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        unsubscribeReturnUpdates();

        if (!user) return;

        try {
          const pushToken = await registerForPushNotificationsAsync();

          if (pushToken) {
            await setDoc(
              doc(db, 'username', user.uid),
              {
                expoPushToken: pushToken,
                pushTokenUpdatedAt: Date.now(),
              },
              { merge: true }
            );
          }

          unsubscribeReturnUpdates = onSnapshot(
            query(
              collection(db, 'transactions'),
              where('borrowerId', '==', user.uid)
            ),
            snapshot => {
              snapshot.docs
                .filter(transactionDoc => {
                  const transaction = transactionDoc.data();
                  return (
                    transaction.status === 'returned' ||
                    transaction.status === 'completed'
                  );
                })
                .forEach(transactionDoc => {
                  cancelReturnRemindersForTransaction(
                    transactionDoc.id
                  ).catch(error =>
                    console.error('Could not cancel return reminder:', error)
                  );
                });
            }
          );

          const transactionsSnapshot = await getDocs(
            query(
              collection(db, 'transactions'),
              where('borrowerId', '==', user.uid)
            )
          );

          await Promise.all(
            transactionsSnapshot.docs
              .filter(transactionDoc => {
                const transaction = transactionDoc.data();
                return (
                  transaction.status === 'pending' &&
                  transaction.returnDateTimestamp?.toDate
                );
              })
              .map(async transactionDoc => {
                const transaction = transactionDoc.data();
                const profileSnapshot = await getDoc(
                  doc(db, 'username', transaction.lenderId)
                );
                return scheduleReturnReminder({
                  transactionId: transactionDoc.id,
                  itemTitle: transaction.itemTitle,
                  returnDate: transaction.returnDateTimestamp.toDate(),
                  chatId: transaction.chatId,
                  peerId: transaction.lenderId,
                  peerUsername:
                    profileSnapshot.data()?.username || 'student',
                });
              })
          );
        } catch (error) {
          console.error('Could not save push token:', error);
        }
      }
    );

    return () => {
      unsubscribe();
      unsubscribeReturnUpdates();
    };
  }, []);

  useEffect(() => {
    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {
        openNotificationTarget(
          response.notification.request.content.data
        );
      });

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          openNotificationTarget(
            response.notification.request.content.data
          );
        }
      })
      .catch((error) => {
        console.error('Could not read last notification response:', error);
      });

    return () => {
      responseSubscription.remove();
    };
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        if (pendingNotificationData) {
          const data = pendingNotificationData;
          pendingNotificationData = null;
          openNotificationTarget(data);
        }
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>

        <Stack.Screen name="Welcome" component={HomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} initialParams={{ auth: auth }} />
        <Stack.Screen name="SignUp" component={SignUpScreen} initialParams={{ auth: auth }} />
        <Stack.Screen name="SetUsername" component={SetUsernameScreen} />
        <Stack.Screen name="MainTabs" component={TabNavigator} />
        <Stack.Screen name="PostOTP" component={PostOTPScreen} />
        <Stack.Screen
          name="ProfileActivity"
          component={ProfileActivityScreen}
          options={{
            headerShown: true,
            headerStyle: { backgroundColor: '#14004c' },
            headerTitleStyle: { color: '#ffffff', fontWeight: 'bold' },
            headerTintColor: '#ffffff',
          }}
        />

      </Stack.Navigator>
    </NavigationContainer>
  );
}