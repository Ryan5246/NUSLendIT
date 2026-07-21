import React, { useEffect, useState } from "react";
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';

import {
  View,
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";

import {
  doc,
  setDoc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";

import { db } from "../firebaseConfig";

import generateOTP from "../utils/generateOTP";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,

  }),
});

export default function OTPScreen() {

  const [transaction, setTransaction] = useState(null);

  const [enteredOtp, setEnteredOtp] = useState("");

  const createOTP = async () => {

    const otp = generateOTP();

    try {

      await setDoc(
        doc(db, "transactions", "testTransaction"),
        {
          lenderId: "user1",
          borrowerId: "user2",
          otp: otp,
          status: "approved",
          createdAt: Date.now(),
        }
      );

      await Notifications.scheduleNotificationAsync({
        content: {
          title: "OTP Generated",
          body: `Your OTP is ${otp}`,
        },
        trigger: null,
      });

      Alert.alert("OTP Generated", otp);

    } catch (error) {

      console.log(error);

    }
  };

  useEffect(() => {

    (async () => {
      const { status } =
        await Notifications.requestPermissionsAsync();

      if (status !== "granted") {
        Alert.alert("Notification permission denied");
      }
    })();



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

  const verifyOTP = async () => {

    if (!transaction) return;

    if (enteredOtp === transaction.otp) {

      await updateDoc(
        doc(db, "transactions", "testTransaction"),
        {
          status: "completed",
        }
      );

      Alert.alert("SUCCESSFUL");

    } else {

      Alert.alert("ERROR", "Wrong OTP");

    }
  };

  return (

    <View style={styles.container}>

      <Text style={styles.title}>
        Lender Verification
      </Text>

      <TouchableOpacity
        style={styles.generateButton}
        onPress={createOTP}
      >
        <Text style={styles.buttonText}>
          Generate OTP
        </Text>
      </TouchableOpacity>

      <TextInput
        placeholder="Enter OTP"
        placeholderTextColor="#999"
        value={enteredOtp}
        onChangeText={setEnteredOtp}
        keyboardType="numeric"
        style={styles.input}
      />

      <TouchableOpacity
        style={styles.verifyButton}
        onPress={verifyOTP}
      >
        <Text style={styles.buttonText}>
          Verify OTP
        </Text>
      </TouchableOpacity>

      <Text style={styles.status}>
        Status: {transaction?.status || "none"}
      </Text>

    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#14004c",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  title: {
    color: "white",
    fontSize: 30,
    fontWeight: "bold",
    marginBottom: 40,
  },

  generateButton: {
    backgroundColor: "#5E17EB",
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 15,
    marginBottom: 30,
  },

  verifyButton: {
    backgroundColor: "#00C851",
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 15,
    marginTop: 20,
  },

  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },

  input: {
    backgroundColor: "white",
    width: "80%",
    borderRadius: 15,
    padding: 15,
    fontSize: 20,
    color: "black",
    textAlign: "center",
  },

  status: {
    color: "white",
    marginTop: 30,
    fontSize: 20,
  },

});