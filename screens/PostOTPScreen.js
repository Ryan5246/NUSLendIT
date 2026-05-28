import React, { useEffect, useState } from 'react';

import {
  StyleSheet,
  Text,
  SafeAreaView,
  View,
} from 'react-native';

import {
  doc,
  onSnapshot,
} from 'firebase/firestore';

import { db } from '../firebaseConfig';

export default function PostOTPScreen() {

  const [transaction, setTransaction] = useState(null);

  useEffect(() => {

    const unsubscribe = onSnapshot(
      doc(db, "transactions", "testTransaction"),
      (docSnap) => {

        if (docSnap.exists()) {

          setTransaction(docSnap.data());

        }
      }
    );

    return () => unsubscribe();

  }, []);

  return (

    <SafeAreaView style={styles.container}>

      <Text style={styles.title}>
        Your OTP
      </Text>

      <View style={styles.otpBox}>

        <Text style={styles.otpText}>
          {transaction?.otp || "------"}
        </Text>

      </View>

      <Text style={styles.infoText}>
        Tell this OTP to the lender
      </Text>

      <Text style={styles.status}>
        Status: {transaction?.status || "pending"}
      </Text>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#14004c',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  title: {
    fontSize: 34,
    color: 'white',
    marginBottom: 40,
    fontWeight: 'bold',
  },

  otpBox: {
    backgroundColor: 'white',
    paddingVertical: 30,
    paddingHorizontal: 60,
    borderRadius: 25,
  },

  otpText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#14004c',
    letterSpacing: 6,
  },

  infoText: {
    marginTop: 30,
    color: '#ccc',
    fontSize: 18,
  },

  status: {
    marginTop: 40,
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
  },

});