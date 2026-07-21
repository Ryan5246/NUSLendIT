import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export async function registerForPushNotificationsAsync() {
    try {
        if (!Device.isDevice) {
            console.log(
                'Push notifications require a physical device.'
            );
            return null;
        }

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync(
                'default',
                {
                    name: 'Default Notifications',
                    importance:
                        Notifications.AndroidImportance.HIGH,
                    vibrationPattern: [0, 250, 250, 250],
                    sound: 'default',
                }
            );
            await Notifications.setNotificationChannelAsync(
                'chat-messages',
                {
                    name: 'Chat Messages',
                    description:
                        'Notifications when another student sends you a chat message.',
                    importance:
                        Notifications.AndroidImportance.HIGH,
                    vibrationPattern: [0, 250, 250, 250],
                    sound: 'default',
                }
            );

            await Notifications.setNotificationChannelAsync(
                'nearby-requests',
                {
                    name: 'Nearby Item Requests',
                    description:
                        'Notifications when someone nearby needs an item you listed.',
                    importance:
                        Notifications.AndroidImportance.HIGH,
                    vibrationPattern: [0, 250, 250, 250],
                    sound: 'default',
                }
            );

            await Notifications.setNotificationChannelAsync(
                'return-reminders',
                {
                    name: 'Return Reminders',
                    description:
                        'Reminders for returning borrowed items.',
                    importance:
                        Notifications.AndroidImportance.HIGH,
                    vibrationPattern: [0, 250, 250, 250],
                    sound: 'default',
                }
            );
        }

        const existingPermission =
            await Notifications.getPermissionsAsync();

        let finalStatus = existingPermission.status;

        if (finalStatus !== 'granted') {
            const requestedPermission =
                await Notifications.requestPermissionsAsync();

            finalStatus = requestedPermission.status;
        }

        if (finalStatus !== 'granted') {
            console.log(
                'Notification permission was denied.'
            );
            return null;
        }

        const projectId =
            Constants.expoConfig?.extra?.eas?.projectId ||
            Constants.easConfig?.projectId;

        if (!projectId) {
            console.log(
                'EAS project ID is missing from app.json/app.config.js.'
            );
            return null;
        }

        const tokenData =
            await Notifications.getExpoPushTokenAsync({
                projectId,
            });

        const expoPushToken = tokenData.data;

        console.log(
            'Expo push token:',
            expoPushToken
        );

        const currentUser = auth.currentUser;

        if (!currentUser) {
            console.log(
                'No logged-in user. Token was not saved.'
            );

            return expoPushToken;
        }

        await setDoc(
            doc(db, 'username', currentUser.uid),
            {
                expoPushToken: expoPushToken,
                notificationTokenUpdatedAt:
                    new Date().toISOString(),
            },
            {
                merge: true,
            }
        );

        console.log(
            'Expo push token saved under username/',
            currentUser.uid
        );

        return expoPushToken;
    } catch (error) {
        console.error(
            'Push notification registration failed:',
            error
        );

        return null;
    }
}

export async function scheduleReturnReminder({
    transactionId,
    itemTitle,
    returnDate,
    chatId,
    peerId,
    peerUsername,
}) {
    if (!(returnDate instanceof Date) || Number.isNaN(returnDate.getTime())) {
        throw new Error('A valid return date is required to schedule a reminder.');
    }

    const permissions = await Notifications.getPermissionsAsync();

    if (permissions.status !== 'granted') {
        return null;
    }

    const reminderDate = new Date(returnDate);
    reminderDate.setDate(reminderDate.getDate() - 1);
    reminderDate.setHours(0, 0, 0, 0);

    const scheduledNotifications =
        await Notifications.getAllScheduledNotificationsAsync();

    await Promise.all(
        scheduledNotifications
            .filter(notification =>
                notification.content.data?.type === 'return_reminder' &&
                notification.content.data?.transactionId === transactionId
            )
            .map(notification =>
                Notifications.cancelScheduledNotificationAsync(
                    notification.identifier
                )
            )
    );

    const reminderHasPassed = reminderDate.getTime() <= Date.now();
    const triggerDate = reminderHasPassed
        ? new Date(Date.now() + 1000)
        : reminderDate;

    return Notifications.scheduleNotificationAsync({
        content: {
            title: 'Return reminder',
            body: reminderHasPassed
                ? `${itemTitle || 'Your borrowed item'} is due back today.`
                : `${itemTitle || 'Your borrowed item'} is due back tomorrow.`,
            sound: 'default',
            data: {
                type: 'return_reminder',
                transactionId,
                chatId,
                peerId,
                peerUsername,
            },
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
            channelId: Platform.OS === 'android' ? 'return-reminders' : undefined,
        },
    });
}

export async function cancelReturnReminder(notificationId) {
    if (notificationId) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
    }
}

export async function cancelReturnRemindersForTransaction(transactionId) {
    const scheduledNotifications =
        await Notifications.getAllScheduledNotificationsAsync();

    await Promise.all(
        scheduledNotifications
            .filter(notification =>
                notification.content.data?.type === 'return_reminder' &&
                notification.content.data?.transactionId === transactionId
            )
            .map(notification =>
                Notifications.cancelScheduledNotificationAsync(
                    notification.identifier
                )
            )
    );
}
