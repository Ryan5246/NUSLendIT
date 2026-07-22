import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { HeaderBackButton } from '@react-navigation/elements'; 
import { Alert, TouchableOpacity, Text, StyleSheet, View } from 'react-native';

import ChatListScreen from './screens/ChatListScreen';
import ChatScreen from './screens/ChatScreen';

const ChatStack = createStackNavigator();

export default function ChatStackNavigator() {
  return (
    <ChatStack.Navigator 
      screenOptions={{ 
        headerShown: true, 
        headerStyle: { backgroundColor: '#14004c', borderBottomWidth: 1, borderBottomColor: '#ffffff15' },
        headerTitleStyle: { color: '#ffffff', fontWeight: 'bold' },
        headerTintColor: '#ffffff', 
        headerTruncatedBackTitle: '<'
      }}
    >
      <ChatStack.Screen 
        name="ChatList" 
        component={ChatListScreen} 
        options={{ title: 'LendIT Inbox', headerShown: false }} 
      />
      <ChatStack.Screen 
        name="ChatConversation" 
        component={ChatScreen} 
        options={({ route, navigation }) => ({
          title: route.params?.peerUsername ? `@${route.params.peerUsername}` : 'Chat', 
          headerBackTitle: 'Inbox',
          headerBackTitleStyle: { fontSize: 18, fontWeight: '400' },

          headerRight: () => (
            <TouchableOpacity 
              style={{ paddingHorizontal: 16 }}
              onPress={() => {
                Alert.alert(
                  "Chat Options",
                  "What would you like to do?",
                  [
                    { text: "Cancel", style: "cancel" },
                    { 
                      text: "Delete Chat Thread", 
                      style: "destructive",
                      onPress: () => navigation.navigate('ChatConversation', { performAction: 'delete' }) 
                    },
                    { 
                      text: "Block User", 
                      style: "destructive",
                      onPress: () => navigation.navigate('ChatConversation', { performAction: 'block' }) 
                    },
                  ]
                );
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: 'bold' }}>•••</Text>
            </TouchableOpacity>
          ),
          
          headerLeft: (props) => (
            <HeaderBackButton
              {...props}
              onPress={() => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                } else {
                  navigation.navigate('ChatList');
                }
              }}
            />
          )
        })}
      />
    </ChatStack.Navigator>
  );
}