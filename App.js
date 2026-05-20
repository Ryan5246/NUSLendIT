import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// Firebase core app setups
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';

import { HomeScreen, LoginScreen, SignUpScreen } from './screens/HomeScreen';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAzDhiFXwj-vhWvzs3PlVcLSpijvhV2OKw",
  authDomain: "nus-lendit.firebaseapp.com",
  projectId: "nus-lendit",
  storageBucket: "nus-lendit.firebasestorage.app",
  messagingSenderId: "199776577441",
  appId: "1:199776577441:web:19ceca21d1a8d1f2df0de0",
  measurementId: "G-G5ZPTQH9Y1"
};

// Firebase initialisation
let app;
let auth;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} else {
  app = getApps()[0];
  auth = getAuth(getApps()[0]);
}

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

      </Stack.Navigator>
    </NavigationContainer>
  );
}