import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  Alert,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';

import DateTimePicker from '@react-native-community/datetimepicker';

// Firebase requirements
import { db, auth } from '../firebaseConfig'; 
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Helper function to format date objects cleanly into string format
const formatDateString = (date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Requests page
function RequestForm() {
  const [item, setItem] = useState('');
  const [location, setLocation] = useState('');
  const [borrowDate, setBorrowDate] = useState(new Date());
  const [returnDate, setReturnDate] = useState(new Date());
  const [willingToPay, setWillingToPay] = useState('');
  const [deposit, setDeposit] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Visibility toggles for picker modals
  const [showBorrowPicker, setShowBorrowPicker] = useState(false);
  const [showReturnPicker, setShowReturnPicker] = useState(false);

  const handleBorrowDateChange = (event, selectedDate) => {
    // Android automatically closes the dialog on change event types
    if (Platform.OS === 'android') {
      setShowBorrowPicker(false);
    }
    if (selectedDate) {
      setBorrowDate(selectedDate);
    }
  };

  const handleReturnDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowReturnPicker(false);
    }
    if (selectedDate) {
      setReturnDate(selectedDate);
    }
  };

  const handlePostRequest = async () => {
    if (!item || !location || !borrowDate || !returnDate || !willingToPay || !deposit || !description) {
      return Alert.alert('Missing Fields', 'Please fill out all fields.');
    }

    setLoading(true);

    try {
      await addDoc(collection(db, 'requests'), {
        userId: auth.currentUser?.uid || 'anonymous_student', // Binds the post to the student account
        item: item,
        location: location,
        borrowdate: formatDateString(borrowDate),
        returndate: formatDateString(returnDate),
        willingToPay: willingToPay,
        deposit: deposit,
        description: description,
        createdAt: serverTimestamp()
      });

      Alert.alert('Success', 'Your borrow request has been posted!');
      
      // Clear form inputs on success
      setItem('');
      setLocation('');
      setBorrowDate(new Date());
      setReturnDate(new Date());
      setWillingToPay('');
      setDeposit('');
      setDescription('');

    } catch (error) {
      console.error("Firestore Error: ", error);
      Alert.alert('Database Error', 'Could not save your post. Make sure your internet is working.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.formContextTitle}>What do you need to borrow?</Text>

      <Text style={styles.label}>Item:</Text>
      <TextInput style={styles.input} placeholder="Eg: Calculator" placeholderTextColor="#a0a0a0" value={item} onChangeText={setItem} />

      <Text style={styles.label}>Location:</Text>
      <TextInput style={styles.input} placeholder="Eg: Temasek Hall" placeholderTextColor="#a0a0a0" value={location} onChangeText={setLocation} />

      {/* Borrow Date Row Trigger */}
      <Text style={styles.label}>Borrow Date:</Text>
      <TouchableOpacity 
        style={styles.dropdownInput} 
        onPress={() => {
          setShowBorrowPicker(true);
          setShowReturnPicker(false); // Mutually close the other picker
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.dropdownValueText}>{formatDateString(borrowDate)}</Text>
        <Text style={styles.dropdownArrow}>▼</Text>
      </TouchableOpacity>
      
      {/* iOS Specific Confirm Strip Bar */}
      {showBorrowPicker && Platform.OS === 'ios' && (
        <TouchableOpacity style={styles.pickerDoneStrip} onPress={() => setShowBorrowPicker(false)}>
          <Text style={styles.pickerDoneText}>Confirm Borrow Date</Text>
        </TouchableOpacity>
      )}
      {showBorrowPicker && (
        <DateTimePicker
          value={borrowDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={new Date()} 
          onChange={handleBorrowDateChange}
        />
      )}

      {/* Return Date Row Trigger */}
      <Text style={styles.label}>Return Date:</Text>
      <TouchableOpacity 
        style={styles.dropdownInput} 
        onPress={() => {
          setShowReturnPicker(true);
          setShowBorrowPicker(false); // Mutually close the other picker
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.dropdownValueText}>{formatDateString(returnDate)}</Text>
        <Text style={styles.dropdownArrow}>▼</Text>
      </TouchableOpacity>

      {/* iOS Specific Confirm Strip Bar */}
      {showReturnPicker && Platform.OS === 'ios' && (
        <TouchableOpacity style={styles.pickerDoneStrip} onPress={() => setShowReturnPicker(false)}>
          <Text style={styles.pickerDoneText}>Confirm Return Date</Text>
        </TouchableOpacity>
      )}
      {showReturnPicker && (
        <DateTimePicker
          value={returnDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={borrowDate} 
          onChange={handleReturnDateChange}
        />
      )}

      <Text style={styles.label}>Willing To Pay:</Text>
      <TextInput style={styles.input} placeholder="Eg: 1.70" placeholderTextColor="#a0a0a0" value={willingToPay} onChangeText={setWillingToPay} />

      <Text style={styles.label}>Security Deposit:</Text>
      <TextInput style={styles.input} placeholder="Eg: 12.00" placeholderTextColor="#a0a0a0" value={deposit} onChangeText={setDeposit} />

      <Text style={styles.label}>Description:</Text>
      <TextInput style={[styles.input, styles.textArea]} placeholder="Eg: Casio Model Ex-1312" placeholderTextColor="#a0a0a0" multiline={true} value={description} onChangeText={setDescription} />

      <TouchableOpacity style={styles.submitButton} onPress={handlePostRequest} disabled={loading}>
        {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitButtonText}>Post Request</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}


// Listing page
function ListingForm() {
  const [item, setItem] = useState('');
  const [location, setLocation] = useState('');
  const [costPerDay, setCostPerDay] = useState('');
  const [deposit, setDeposit] = useState('');
  const [returnConditions, setReturnConditions] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePostListing = async () => {
    if (!item || !location || !costPerDay || !deposit || !returnConditions) {
      return Alert.alert('Missing Fields', 'Please fill out all fields.');
    }

    setLoading(true);

    try {
      await addDoc(collection(db, 'listings'), {
        userId: auth.currentUser?.uid || 'anonymous_student',
        item: item,
        location: location,
        costPerDay: costPerDay,
        deposit: deposit,
        returnConditions: returnConditions,
        createdAt: serverTimestamp()
      });

      Alert.alert('Success', 'Your item listing has been posted!');
      
      setItem('');
      setLocation('');
      setCostPerDay('');
      setDeposit('');
      setReturnConditions('');

    } catch (error) {
      console.error("Firestore Error: ", error);
      Alert.alert('Database Error', 'Could not save your listing. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.formContextTitle}>What are you offering to lend?</Text>

      <Text style={styles.label}>Item:</Text>
      <TextInput style={styles.input} placeholder="Eg: Lab Coat" placeholderTextColor="#a0a0a0" value={item} onChangeText={setItem} />

      <Text style={styles.label}>Location</Text>
      <TextInput style={styles.input} placeholder="Eg: Central Library" placeholderTextColor="#a0a0a0" value={location} onChangeText={setLocation} />

      <Text style={styles.label}>Cost Per Day:</Text>
      <TextInput style={styles.input} placeholder="Eg: 0.50" placeholderTextColor="#a0a0a0" value={costPerDay} onChangeText={setCostPerDay} />

      <Text style={styles.label}>Security Deposit:</Text>
      <TextInput style={styles.input} placeholder="Eg: 10.25" placeholderTextColor="#a0a0a0" value={deposit} onChangeText={setDeposit} />

      <Text style={styles.label}>Return Requirements:</Text>
      <TextInput style={[styles.input, styles.textArea]} placeholder="Eg: Wash before returning. Must return by end of reading week." placeholderTextColor="#a0a0a0" multiline={true} value={returnConditions} onChangeText={setReturnConditions} />

      <TouchableOpacity style={[styles.submitButton, styles.listingSubmitBtn]} onPress={handlePostListing} disabled={loading}>
        {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitButtonText}>Post Listing</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

// Upper tab control
export default function PostScreen() {
  const [activeTab, setActiveTab] = useState('Request');

  return (
    <SafeAreaView style={styles.safeAreaContainer}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.toggleWrapper}>
          <View style={styles.toggleContainer}>
            <TouchableOpacity 
              style={[styles.toggleButton, activeTab === 'Request' && styles.toggleButtonActive]}
              onPress={() => setActiveTab('Request')}
              activeOpacity={0.9}
            >
              <Text style={[styles.toggleText, activeTab === 'Request' && styles.toggleTextActive]}>Request</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.toggleButton, activeTab === 'List' && styles.toggleButtonActive]}
              onPress={() => setActiveTab('List')}
              activeOpacity={0.9}
            >
              <Text style={[styles.toggleText, activeTab === 'List' && styles.toggleTextActive]}>List</Text>
            </TouchableOpacity>
          </View>
        </View>

        {activeTab === 'Request' ? <RequestForm /> : <ListingForm />}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Layout styling parameters
const styles = StyleSheet.create({
  safeAreaContainer: { 
    flex: 1, 
    backgroundColor: '#ffffff' 
  },
  container: { 
    flex: 1 
  },
  toggleWrapper: { 
    paddingHorizontal: 24, 
    paddingTop: 12, 
    paddingBottom: 8, 
    backgroundColor: '#ffffff' 
  },
  toggleContainer: { 
    flexDirection: 'row', 
    backgroundColor: '#f0f0f5', 
    borderRadius: 16, 
    padding: 4, 
    borderWidth: 1, 
    borderColor: '#e5e5ea' 
  },
  toggleButton: { 
    flex: 1, 
    paddingVertical: 12, 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderRadius: 12 
  },
  toggleButtonActive: { 
    backgroundColor: '#14004c', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.15, 
    shadowRadius: 4, 
    elevation: 2 
  },
  toggleText: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#636366' 
  },
  toggleTextActive: { 
    color: '#ffffff' 
  },
  formContextTitle: { 
    fontSize: 15, 
    color: '#8e8e93', 
    fontWeight: '600',  
  },
  scrollContent: { 
    paddingHorizontal: 24, 
    paddingTop: 15, 
    paddingBottom: 80 
  },
  label: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#14004c', 
    marginTop: 14, 
    marginBottom: 6 
  },
  input: { 
    width: '100%', 
    height: 50, 
    borderWidth: 1.5, 
    borderColor: '#e0e0e0', 
    borderRadius: 14, 
    paddingHorizontal: 16, 
    fontSize: 16, 
    color: '#333333', 
    backgroundColor: '#fafafa' 
  },
  textArea: { 
    height: 110, 
    paddingTop: 12, 
    textAlignVertical: 'top' 
  },
  submitButton: { 
    width: '100%', 
    height: 56, 
    backgroundColor: '#14004c', 
    borderRadius: 28, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 30 
  },
  listingSubmitBtn: { 
    backgroundColor: '#2e2270' 
  },
  submitButtonText: { 
    fontSize: 20, 
    fontWeight: 'bold', 
    color: '#ffffff' 
  },
  dropdownInput: {
    width: '100%',
    height: 50,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: '#fafafa',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  dropdownValueText: { 
    fontSize: 16, 
    color: '#333333' 
  },
  dropdownArrow: { 
    fontSize: 12, 
    color: '#14004c' 
  },
  pickerDoneStrip: {
    width: '100%',
    backgroundColor: '#f0f0f5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5ea',
    marginTop: 6,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  pickerDoneText: {
    color: '#14004c',
    fontWeight: 'bold',
    fontSize: 15,
  },
});