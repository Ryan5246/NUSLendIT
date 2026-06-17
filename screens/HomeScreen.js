import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Image, TouchableOpacity, Platform, TextInput, Alert, KeyboardAvoidingView, ScrollView, SafeAreaView } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';

import { db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

// HomeScreen
export function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      
      <Image source={require('../assets/Logo1.png')} style={styles.logo} />
      <Text style={styles.title} >{'NUS LENDIT'}</Text>
      <Text style={styles.subtitle} >Need it now? LendIT.</Text>
      
      <TouchableOpacity style={styles.logInButton} onPress={() => navigation.navigate('Login')}>
        <Text style={styles.logInButtonText} >Log In</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.signUpButton} onPress={() => navigation.navigate('SignUp')}>
        <Text style={styles.signUpButtonText}>Sign Up</Text>
      </TouchableOpacity>
      
      <Image source={require('../assets/Skyline.png')} style={styles.skyline} resizeMode="contain"/>
      
      <StatusBar style="auto" />
    </View>
  );
}

// LoginScreen
export function LoginScreen({ navigation, route }) {
  
  // Extracts the secure auth bridge passed down from App.js
  const { auth } = route.params;
  
  // Track input
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const handleForgotPassword = async () => {
    if (!email) {
      return Alert.alert('Input Required', 'Please enter your email address first to receive a reset link.');
    }
    
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Alert.alert('Reset Email Sent', `A password reset link has been pushed to ${email}`);
    } catch (error) {
      Alert.alert('Reset Error', error.message);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      return Alert.alert('Missing Info', 'Please enter both email and password.');
    }

    try {
      // Check if credentials match
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // Check if the email link has been clicked
      if (!user.emailVerified) {
        // Force log them out
        await auth.signOut(); 
        return Alert.alert(
          'Account Unverified', 
          'Please check your inbox (or Microsoft Defender Quarantine) and click the verification link before logging in.'
        );
      }

      // Success
      const userDocRef = doc(db, 'username', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        // RETURNING STUDENT: Account has a username profile -> proceed straight to application
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      } else {
        // FIRST-TIME LOGGED IN STUDENT: Missing a handle profile -> route to onboarding gate
        navigation.reset({
          index: 0,
          routes: [{ name: 'SetUsername' }],
        });
      }
          
    } catch (error) {
      Alert.alert('Login Error', error.message);
    }
  };
  
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      
      <Image source={require('../assets/Logo1.png')} style={styles.logo} resizeMode="contain" />
      <Image source={require('../assets/Skyline.png')} style={styles.skyline} resizeMode="contain"/>

      <Text style={styles.title} >{'NUS LENDIT'}</Text>
      <Text style={styles.subtitle} >Need it now? LendIT.</Text>
      
      <TextInput style={styles.input} placeholder='Email' autoCapitalize='none' keyboardType='email-address' value={email} onChangeText={setEmail}></TextInput>
      
      <View style={styles.inputContainer}>
        <TextInput 
          style={styles.inlineInput} 
          placeholder='Password' 
          autoCapitalize='none' 
          secureTextEntry={!isPasswordVisible}
          value={password} 
          onChangeText={setPassword}
        />
        <TouchableOpacity 
          style={styles.toggleButton} 
          onPress={() => setIsPasswordVisible(!isPasswordVisible)}
        >
          <Text style={styles.toggleText}>{isPasswordVisible ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity onPress={handleForgotPassword} style={{ alignSelf: 'flex-end', marginRight: '11%', marginBottom: 15 }}>
        <Text style={{ color: '#ffffffb0', textDecorationLine: 'underline', fontSize: 14 }}>Forgot Password?</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.logInButton2} onPress={handleLogin}>
        <Text style={styles.logInButtonText2}>Log In</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 15 }}>
        <Text style={{ color: '#ffffff80', textDecorationLine: 'underline' }}>Go Back</Text>
      </TouchableOpacity>

      <StatusBar style="auto" />
    </KeyboardAvoidingView>
  );
}

// SignUpScreen
export function SignUpScreen({ navigation, route }) {
  
  const { auth } = route.params;
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const handleSignUp = async () => {
    if (!email || !password) {
      return Alert.alert('Missing Info', 'Please enter both email and password.');
    }

    // NUS email filter
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail.endsWith('@u.nus.edu')) {
      return Alert.alert(
        'Access Restricted', 
        'Only official NUS student accounts (@u.nus.edu) are allowed to register for LendIT.'
      );
    }

    if (password.length < 6) {
      return Alert.alert('Weak Password', 'Passwords to be at least 6 characters long.');
    }

    try {
      // Create the user credentials
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      
      // Verification email sent
      await sendEmailVerification(userCredential.user);
      
      Alert.alert(
        'Email Sent!', 
        'A verification link has been sent to your inbox (or Microsoft Defender Quarantine). Please verify before logging in.', 
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
      
      setEmail('');
      setPassword('');
    } catch (error) {
      Alert.alert('Registration Error', error.message);
    }
  };
  
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      
      <Image source={require('../assets/Logo1.png')} style={styles.logo} resizeMode="contain"/>
      <Image source={require('../assets/Skyline.png')} style={styles.skyline} resizeMode="contain"/>

      <Text style={styles.title} >{'NUS LENDIT'}</Text>
      <Text style={styles.subtitle} >Need it now? LendIT.</Text>
      
      <TextInput style={styles.input} placeholder='Email' autoCapitalize='none' keyboardType='email-address' value={email} onChangeText={setEmail}></TextInput>
      
      <View style={styles.inputContainer}>
        <TextInput 
          style={styles.inlineInput} 
          placeholder='Password' 
          autoCapitalize='none' 
          secureTextEntry={!isPasswordVisible}
          value={password} 
          onChangeText={setPassword}
        />
        <TouchableOpacity 
          style={styles.toggleButton} 
          onPress={() => setIsPasswordVisible(!isPasswordVisible)}
        >
          <Text style={styles.toggleText}>{isPasswordVisible ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity style={styles.logInButton2} onPress={handleSignUp}>
        <Text style={styles.logInButtonText2}>Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 15 }}>
        <Text style={{ color: '#ffffff80', textDecorationLine: 'underline' }}>Go Back</Text>
      </TouchableOpacity>

      <StatusBar style="auto" />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#14004c',
    alignItems: 'center',
    justifyContent: 'center', 
  },
  logo: {
    width:'50%',
    height:'22%',
    alignItems: 'center',
    justifyContent: 'center',
    //borderRadius: 30
  },
  title: {
    fontSize: 60,
    color: '#ffffff',
    letterSpacing: 2,
    textAlign: 'center',
    fontFamily: Platform.select({
      ios: 'Avenir Next',
      android: 'sans-serif-medium',
    })
  },
  subtitle: {
    fontSize: 30,
    color: '#ffffff9f',
    marginBottom: '15%',
    fontFamily: Platform.select({
      ios: 'Avenir Next',
      android: 'sans-serif-medium',
    })
  },
  logInButton: {
    width: '80%',
    height: '7.5%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#32007c',
    borderRadius: 50
  },
  logInButtonText: {
    fontSize: 40,
    color: '#ffffff',
    fontWeight: 'bold',
    fontFamily: Platform.select({
      ios: 'Avenir Next',
      android: 'sans-serif-medium',
    })
  },
  signUpButton: {
    width: '80%',
    height: '7.5%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 50,
    marginTop: '3.5%',
    marginBottom: '15%'
  },
  signUpButtonText: {
    fontSize: 40,
    color: '#32007c',
    fontWeight: 'bold',
    fontFamily: Platform.select({
      ios: 'Avenir Next',
      android: 'sans-serif-medium',
  })
  },
  skyline: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: '20%',
  },
  input: {
    height: '6%',
    width: '80%',
    borderWidth: 1,
    borderRadius: 25,
    backgroundColor: '#fff',
    padding: 10,
    marginTop: '1%',
    marginBottom: '1%'
  },
  logInButton2: {
    width: '50%',
    height: '5%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#32007c',
    borderRadius: 50,
    marginTop: '1%',
  },
  logInButtonText2: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: 'bold',
    fontFamily: Platform.select({
      ios: 'Avenir Next',
      android: 'sans-serif-medium',
    })
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '6%',
    width: '80%',
    borderWidth: 1,
    borderRadius: 25,
    backgroundColor: '#fff',
    marginTop: '1%',
    marginBottom: '1%',
    paddingRight: 15,
  },
  inlineInput: {
    flex: 1,
    height: '100%',
    padding: 10,
  },
  toggleButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleText: {
    color: '#32007c',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
