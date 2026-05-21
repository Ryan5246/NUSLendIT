import React, { useState } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, TextInput, ScrollView, FlatProps, Platform, SafeAreaView } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

export default function PostScreen() {
    return(
        <SafeAreaView style={styles.container}>
            <Text>Post Screen</Text>
        </SafeAreaView>
    );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#14004c',
    alignItems: 'center',
    //justifyContent: 'center', 
  },
})