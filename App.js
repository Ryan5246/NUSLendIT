import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Firebase core app setups
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
  setDoc
} from 'firebase/firestore';

import {
  registerForPushNotificationsAsync
} from './utils/notifications';

const Stack = createStackNavigator();
const navigationRef = createNavigationContainerRef();
let activeRouteName = null;
let activeRouteParams = {};
let pendingNotificationData = null;

const updateActiveRoute = () => {
  const currentRoute = navigationRef.getCurrentRoute();
  activeRouteName = currentRoute?.name || null;
  activeRouteParams = currentRoute?.params || {};
};

const isViewingNotifiedChat = (data) => {
  return (
    data?.type === 'chat_message' &&
    activeRouteName === 'ChatConversation' &&
    activeRouteParams?.chatId === data.chatId
  );
};

const openNotificationTarget = (data) => {
  if (!data) {
    return;
  }

  if (!navigationRef.isReady()) {
    pendingNotificationData = data;
    return;
  }

  if (data.type === 'nearby_item_request') {
    navigationRef.navigate('MainTabs', {
      screen: 'Maps',
      params: {
        initialTab: 'Request',
        focusRequestId: data.requestId,
        focusLocation: data.requestLocation
      }
    });
    return;
  }

  if (data.type === 'chat_message') {
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
  }
};

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data || {};

    if (data.foregroundCopy) {
      return {
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      };
    }

    return {
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    };
  },
});

export default function App() {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          return;
        }

        try {
          const pushToken =
            await registerForPushNotificationsAsync();

          if (!pushToken) {
            console.log(
              'No Expo push token generated.'
            );
            return;
          }

          await setDoc(
            doc(db, 'username', user.uid),
            {
              expoPushToken: pushToken,
              pushTokenUpdatedAt: Date.now(),
            },
            {
              merge: true,
            }
          );

          console.log(
            'Push token saved to Firestore.'
          );
        } catch (error) {
          console.error(
            'Could not save push token:',
            error
          );
        }
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const receivedSubscription =
      Notifications.addNotificationReceivedListener(
        async (notification) => {
          const content = notification.request.content;
          const data = content.data || {};

          if (data.foregroundCopy || isViewingNotifiedChat(data)) {
            return;
          }

          await Notifications.scheduleNotificationAsync({
            content: {
              title: content.title || 'NUSLendIT',
              body: content.body || '',
              sound: 'default',
              data: {
                ...data,
                foregroundCopy: true
              }
            },
            trigger: null
          });
        }
      );

    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener(
        (response) => {
          openNotificationTarget(
            response.notification.request.content.data
          );
        }
      );

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
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  }, []);

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        updateActiveRoute();
        if (pendingNotificationData) {
          const data = pendingNotificationData;
          pendingNotificationData = null;
          openNotificationTarget(data);
        }
      }}
      onStateChange={updateActiveRoute}
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
