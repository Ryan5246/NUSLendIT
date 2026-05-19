import '@react-native-firebase/app';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, Image, SafeAreaView, Button, TouchableOpacity, Platform } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Image source={require('./assets/Logo.png')} style={styles.logo} />
      <Text style={styles.title} >{'NUS LENDIT'}</Text>
      <Text style={styles.subtitle} >Need it now? LendIT.</Text>
      <TouchableOpacity style={styles.logInButton}>
        <Text style={styles.buttonText}>Log In</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.signUpButton}>
        <Text style={styles.signUpButtonText}>Sign Up</Text>
      </TouchableOpacity>
      <Image source={require('./assets/Skyline.png')} style={styles.skyline} resizeMode="contain"/>
      <StatusBar style="auto" />
    </View>
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
    borderRadius: 30
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
  buttonText: {
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
});

