import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';

export const MERCHANT_CHANNEL_ID = 'merchant-orders-v1';
export const MERCHANT_SOUND = 'merchant_order.mp3';

// Tampilkan notifikasi + bunyi saat app sedang terbuka (foreground)
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export async function registerPushToken(): Promise<string | null> {
    if (!Device.isDevice) return null; // emulator tidak mendukung push

    // Android: channel menentukan suara. Suara channel TIDAK bisa diubah
    // setelah dibuat, jadi kalau ganti suara, naikkan versi ID (v1 -> v2).
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(MERCHANT_CHANNEL_ID, {
            name: 'Pesanan Masuk',
            importance: Notifications.AndroidImportance.MAX,
            sound: MERCHANT_SOUND,
            vibrationPattern: [0, 500, 250, 500],
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
        status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return null;

    const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });

    // Kirim ke backend supaya server tahu ke mana harus mengirim notifikasi
    await api.registerPushToken(pushToken, Platform.OS);
    return pushToken;
}