import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

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

        // Android notification channels
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

        console.log(
            'Expo push token:',
            tokenData.data
        );

        return tokenData.data;
    } catch (error) {
        console.error(
            'Push notification registration failed:',
            error
        );

        return null;
    }
}