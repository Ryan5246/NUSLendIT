import React, { useEffect, useState } from "react";
import * as Notifications from "expo-notifications";

import {
    View,
    Alert,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Platform,
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

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

const requestNotificationPermission = async () => {
    if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync(
            "return-reminders",
            {
                name: "Return Reminders",
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                sound: "default",
            }
        );
    }

    const existingPermission =
        await Notifications.getPermissionsAsync();

    let finalStatus = existingPermission.status;

    if (finalStatus !== "granted") {
        const requestedPermission =
            await Notifications.requestPermissionsAsync();

        finalStatus = requestedPermission.status;
    }

    return finalStatus === "granted";
};

const scheduleReturnReminders = async (
    transactionId,
    itemTitle,
    returnDate
) => {
    const permissionGranted =
        await requestNotificationPermission();

    if (!permissionGranted) {
        Alert.alert(
            "Notifications Disabled",
            "Enable notifications in your phone settings to receive return reminders."
        );

        return [];
    }

    const returnTime = returnDate.getTime();
    const now = Date.now();

    const reminders = [
        {
            type: "return_24_hours_before",
            date: new Date(returnTime - ONE_DAY),
            title: "📦 Return Reminder",
            body: `${itemTitle || "Your borrowed item"} is due in 24 hours.`,
        },
        {
            type: "return_1_hour_before",
            date: new Date(returnTime - ONE_HOUR),
            title: "⏰ Return Due Soon",
            body: `${itemTitle || "Your borrowed item"} is due in 1 hour.`,
        },
        {
            type: "return_1_hour_overdue",
            date: new Date(returnTime + ONE_HOUR),
            title: "⚠️ Item Overdue",
            body: `${itemTitle || "Your borrowed item"} is now 1 hour overdue.`,
        },
        {
            type: "return_24_hours_overdue",
            date: new Date(returnTime + ONE_DAY),
            title: "🚨 Item Seriously Overdue",
            body: `${itemTitle || "Your borrowed item"} is more than 24 hours overdue.`,
        },
    ];

    const scheduledNotificationIds = [];

    for (const reminder of reminders) {
        if (reminder.date.getTime() <= now) {
            continue;
        }

        const notificationId =
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: reminder.title,
                    body: reminder.body,
                    sound: "default",
                    data: {
                        type: reminder.type,
                        transactionId,
                    },
                },

                trigger: {
                    type:
                        Notifications
                            .SchedulableTriggerInputTypes.DATE,
                    date: reminder.date,
                    channelId:
                        Platform.OS === "android"
                            ? "return-reminders"
                            : undefined,
                },
            });

        scheduledNotificationIds.push(notificationId);
    }

    return scheduledNotificationIds;
};

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

        if (
            transaction.otpCreatedAt &&
            Date.now() - transaction.otpCreatedAt >
            5 * 60 * 1000
        ) {
            Alert.alert(
                "OTP Expired",
                "Please ask the lender to generate a new OTP."
            );
            return;
        }

        if (enteredOtp.trim() !== transaction.otp) {
            Alert.alert("Error", "Wrong OTP");
            return;
        }

        try {
            if (!transaction.returnDateTimestamp) {
                Alert.alert(
                    "Return Date Missing",
                    "This transaction does not have a return date."
                );
                return;
            }

            const returnDate =
                transaction.returnDateTimestamp.toDate();

            if (returnDate.getTime() <= Date.now()) {
                Alert.alert(
                    "Invalid Return Date",
                    "The return date has already passed."
                );
                return;
            }

            const notificationIds =
                await scheduleReturnReminders(
                    transaction.id,
                    transaction.itemTitle,
                    returnDate
                );

            await updateDoc(
                doc(db, "transactions", transaction.id),
                {
                    status: "pending",
                    otp: null,
                    otpCreatedAt: null,

                    borrowedAt: Date.now(),

                    borrowerNotificationIds:
                        notificationIds,

                    returnRemindersScheduled: true,
                    returnRemindersScheduledAt:
                        Date.now(),
                }
            );

            Alert.alert(
                "Borrowing Confirmed",
                `Return reminders scheduled for ${returnDate.toLocaleString()}.`
            );

            setEnteredOtp("");
        } catch (err) {
            console.log(
                "OTP verification error:",
                err
            );

            Alert.alert(
                "Error",
                "Verification failed. Please try again."
            );
        }
    };

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