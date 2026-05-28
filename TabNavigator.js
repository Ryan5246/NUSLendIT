import React from 'react';
import { Platform, Image, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import DashboardScreen from './screens/DashboardScreen';
import SearchScreen from './screens/SearchScreen';
import PostScreen from './screens/PostScreen';
import MapsScreen from './screens/MapsScreen';
import ChatScreen from './screens/ChatScreen';
import PostOTPScreen from './screens/PostOTPScreen';
import OTPScreen from './screens/OTPScreen';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <Tab.Navigator screenOptions={{
        headerShown: false,
        /*headerStyle: { backgroundColor: '#14004c', borderBottomWidth: 1, borderBottomColor: '#ffffff15' },
        headerTitleStyle: { color: '#ffffff', fontWeight: 'bold', fontSize: 22 },*/
        tabBarStyle: { 
          backgroundColor: '#14004c', 
          borderTopWidth: 1, 
          borderTopColor: '#ffffff15',
          height: Platform.OS === 'ios' ? 60 : 70,
          paddingBottom: Platform.OS === 'ios' ? 30 : 12
        },
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: '#ffffff50',
        tabBarLabelStyle: { fontSize: 11 }
      }} >
        <Tab.Screen 
            name='Home' 
            component={DashboardScreen} 
            options={{title: 'Home', 
              tabBarIcon: ({focused}) => (
                <Image source={require('./assets/Home.png')} style={[styles.homeImage, { opacity: focused ? 1 : 0.6 }]} />
              )
            }}
        />

        <Tab.Screen 
            name='Search' 
            component={SearchScreen} 
            options={{title: 'Search', 
              tabBarIcon: ({focused}) => (
                <Image source={require('./assets/Search.png')} style={[styles.tabImage, { opacity: focused ? 1 : 0.6 }]} />
              )
            }}
        />

        <Tab.Screen 
            name='Post' 
            component={PostScreen} 
            options={{title: 'Post', 
              tabBarIcon: ({focused}) => (
                <Image source={require('./assets/Post.png')} style={[styles.tabImage, { opacity: focused ? 1 : 0.6 }]} />
              )
            }}
        />

        <Tab.Screen 
            name='Maps' 
            component={MapsScreen} 
            options={{title: 'Maps', 
              tabBarIcon: ({focused}) => (
                <Image source={require('./assets/Maps.png')} style={[styles.homeImage, { opacity: focused ? 1 : 0.6 }]} />
              )
            }}
        />

        <Tab.Screen 
            name='Chat' 
            component={ChatScreen} 
            options={{title: 'Chat', 
              tabBarIcon: ({focused}) => (
                <Image source={require('./assets/Chat.png')} style={[styles.tabImage, { opacity: focused ? 1 : 0.6 }]} />
              )
            }}
        />

        <Tab.Screen
          name='OTP'
          component={PostOTPScreen}
          options={{
            title: 'OTP',
            tabBarIcon: ({ focused }) => (
              <Image source={require('./assets/Verify.png')} style={[styles.tabImage, { opacity: focused ? 1 : 0.6 }]}/>
            )
          }}
        />

        <Tab.Screen
          name='Verify'
          component={OTPScreen}
          options={{
            title: 'Verify',
            tabBarIcon: ({ focused }) => (
              <Image source={require('./assets/Verify.png')} style={[styles.tabImage, { opacity: focused ? 1 : 0.6 }]}/>
            )
          }}
        />

    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  tabImage: {
    //backgroundColor: '#14004c',
    height: 25,
    width: 25,
    resizeMode: 'contain'
  },
  homeImage: {
    height: 30,
    width: 30,
    resizeMode: 'contain'
  }
})