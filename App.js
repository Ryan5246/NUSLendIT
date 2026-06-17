import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';


// Firebase core app setups
import { auth } from './firebaseConfig';
import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { HomeScreen, LoginScreen, SignUpScreen } from './screens/HomeScreen';
import DashboardScreen from './screens/DashboardScreen';
import SetUsernameScreen from './screens/SetUsernameScreen';
import PostOTPScreen from './screens/PostOTPScreen';

import TabNavigator from './TabNavigator';


const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>

        <Stack.Screen name="Home" component={HomeScreen} />

        <Stack.Screen
          name="Login"
          component={LoginScreen}
          initialParams={{ auth: auth }}
        />

        <Stack.Screen
          name="SignUp"
          component={SignUpScreen}
          initialParams={{ auth: auth }}
        />

        <Stack.Screen name="SetUsername" component={SetUsernameScreen} />
        <Stack.Screen name="MainTabs" component={TabNavigator} />
        <Stack.Screen name="PostOTP" component={PostOTPScreen} />

      </Stack.Navigator>
    </NavigationContainer>
  );
}