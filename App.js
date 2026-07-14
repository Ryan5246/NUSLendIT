import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Firebase core app setups
import { auth, db } from './firebaseConfig';


import { HomeScreen, LoginScreen, SignUpScreen } from './screens/HomeScreen';
import DashboardScreen from './screens/DashboardScreen';
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
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
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

  return (
    <NavigationContainer>
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

