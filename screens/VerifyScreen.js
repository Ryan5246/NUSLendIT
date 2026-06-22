import React, { useEffect, useState } from "react";
import * as Notifications from "expo-notifications";

import {
    View,
    Alert,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
} from "react-native";

import {
    collection,
    query,
    doc,
    onSnapshot,
    updateDoc,
} from "firebase/firestore";

import { db, auth } from "../firebaseConfig";
import generateOTP from "../utils/generateOTP";

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export default function VerifyScreen() {
    const [transaction, setTransaction] = useState(null);
    const [enteredOtp, setEnteredOtp] = useState("");

    const currentUserId = auth.currentUser?.uid;

    useEffect(() => {

        if (!currentUserId) return;

        const q = query(
            collection(db, "transactions")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {

            let found = null;

            snapshot.forEach(doc => {

                const data = doc.data();

                if (
                    data.status !== "completed" &&
                    (
                        data.lenderId === currentUserId ||
                        data.borrowerId === currentUserId
                    )
                ) {

                    found = {
                        id: doc.id,
                        ...data
                    };

                }

            });

            setTransaction(found);

        });

        return unsubscribe;

    }, []);

    const createOTP = async () => {
        const otp = generateOTP();

        try {
            await updateDoc(
                doc(db, "transactions", transaction.id),
                {
                    otp,
                    status: "approved",
                    otpCreatedAt: Date.now(),
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
        } catch (err) {
            console.log(err);
        }
    };

    const verifyOTP = async () => {
        if (!transaction) return;
        // OTP expires after 5 minutes
        if (
            transaction.otpCreatedAt &&
            Date.now() - transaction.otpCreatedAt > 5 * 60 * 1000
        ) {
            Alert.alert("OTP Expired", "Please ask the lender to generate a new OTP.");
            return;
        }

        if (enteredOtp === transaction.otp) {
            await updateDoc(
                doc(db, "transactions", transaction.id),
                {
                    status: "completed",
                    otp: null,
                    otpCreatedAt: null,
                }
            );

            Alert.alert("Success", "Verification Successful");
            setEnteredOtp("");
        } else {
            Alert.alert("Error", "Wrong OTP");
        }
    };

    // No transaction
    if (!transaction) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>Verification</Text>
                <Text style={styles.status}>Nothing to verify.</Text>
            </View>
        );
    }

    const isLender = transaction.lenderId === currentUserId;
    const isBorrower = transaction.borrowerId === currentUserId;

    // Lender Screen
    if (isLender) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>Lender Verification</Text>

                <TouchableOpacity
                    style={[
                        styles.generateButton,
                        transaction.otp && { opacity: 0.5 }
                    ]}
                    disabled={!!transaction.otp}
                    onPress={createOTP}
                >
                    <Text style={styles.buttonText}>Generate OTP</Text>
                </TouchableOpacity>

                <Text style={styles.status}>
                    Status: {transaction.status}
                </Text>
            </View >
        );
    }

    // Borrower Screen
    if (isBorrower) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>Borrower Verification</Text>

                {transaction.otp ? (
                    <>
                        <TextInput
                            placeholder="Enter OTP"
                            placeholderTextColor="#999"
                            value={enteredOtp}
                            onChangeText={setEnteredOtp}
                            keyboardType="numeric"
                            style={styles.input}
                        />

                        <TouchableOpacity
                            style={[
                                styles.verifyButton,
                                enteredOtp.length !== 6 && { opacity: 0.5 }
                            ]}
                            disabled={enteredOtp.length !== 6}
                            onPress={verifyOTP}
                        >
                            <Text style={styles.buttonText}>Verify OTP</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <Text style={styles.status}>
                        Waiting for lender to generate OTP...
                    </Text>
                )}

                <Text style={styles.status}>
                    Status: {transaction.status}
                </Text>
            </View>
        );
    }

    // User not involved
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Verification</Text>
            <Text style={styles.status}>Nothing to verify.</Text>
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