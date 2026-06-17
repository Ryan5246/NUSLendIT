import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { db, auth } from '../firebaseConfig';
import { doc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';

export default function SetUsernameScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSaveUsername = async () => {
    const cleanUsername = username.trim().toLowerCase();

    // 1. Structural Validation Regex Rules
    if (!cleanUsername) {
      return Alert.alert('Required', 'Please enter a username handle.');
    }
    if (cleanUsername.length < 3) {
      return Alert.alert('Too Short', 'Usernames must be at least 3 characters long.');
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      return Alert.alert('Invalid Characters', 'Usernames can only contain letters, numbers, and underscores.');
    }

    setLoading(true);

    try {
      const currentUserId = auth.currentUser?.uid;
      const currentUserEmail = auth.currentUser?.email;
      if (!currentUserId) return;

      // 2. Query Firestore to enforce absolute uniqueness across campus
      const q = query(collection(db, 'username'), where('username', '==', cleanUsername));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setLoading(false);
        return Alert.alert('Already Taken', 'This username is already claimed. Try another one!');
      }

      // 3. Write profile mapping record payload to Firestore
      await setDoc(doc(db, 'username', currentUserId), {
        username: cleanUsername,
        email: currentUserEmail,
        createdAt: Date.now(),
      });

      Alert.alert('Profile Configured', `Welcome to LendIT, @${cleanUsername}!`);
      
      // 4. Wipe history stack and push to MainTabs
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });

    } catch (error) {
      console.error('Error saving username handle: ', error);
      Alert.alert('Database Error', 'Could not configure your profile handle.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeAreaContainer}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Text style={styles.title}>Claim Your Handle</Text>
        <Text style={styles.subtitle}>Other students will identify your items, posts, and chats by this name.</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.atSymbol}>@</Text>
          <TextInput
            style={styles.input}
            placeholder="username"
            placeholderTextColor="#ffffff60"
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
          />
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSaveUsername} disabled={loading}>
          {loading ? <ActivityIndicator color="#14004c" /> : <Text style={styles.saveButtonText}>Confirm & Continue</Text>}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeAreaContainer: { flex: 1, backgroundColor: '#14004c' },
  container: { flex: 1, paddingHorizontal: 30, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#ffffff', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#ffffffa0', marginBottom: 30, lineHeight: 22 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: '#ffffff', marginBottom: 40 },
  atSymbol: { fontSize: 24, color: '#ffffffa0', fontWeight: 'bold', marginRight: 5, paddingBottom: 5 },
  input: { flex: 1, fontSize: 22, color: '#ffffff', paddingBottom: 8 },
  saveButton: { width: '100%', height: 56, backgroundColor: '#ffffff', borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  saveButtonText: { fontSize: 18, fontWeight: 'bold', color: '#14004c' }
});