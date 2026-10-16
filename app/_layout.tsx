// app/_layout.tsx
import { api, clearToken, getToken } from '../lib/api';
import { registerPushToken } from '../lib/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

const PRIMARY = '#40a3ea';

async function hasCachedProfile(): Promise<boolean> {
    try {
        return !!(await AsyncStorage.getItem('profile'));
    } catch {
        return false;
    }
}

// ✅ Extend mapping notifikasi merchant
function routeForNotification(data: Record<string, any> | undefined): string {
    switch (data?.type) {
        case 'merchant_new_order':
            return '/(tabs)';

        case 'merchant_order_cancelled':
        case 'merchant_order_status':
            return '/(tabs)/pesanan';

        case 'merchant_payout_approved':
        case 'merchant_payout_rejected':
            return '/(tabs)/keuangan';

        default:
            return '/(tabs)/pesanan';
    }
}

export default function RootLayout() {
    const router = useRouter();
    const segments = useSegments();
    const [ready, setReady] = useState(false);

    const validated = useRef(false);
    const pushRegistered = useRef(false);
    const handledNotifId = useRef<string | null>(null);

    const lastResponse = Notifications.useLastNotificationResponse();

    // ============================================================
    // ✅ EFFECT 1: Validasi sesi SEKALI saat mount
    // ============================================================
    useEffect(() => {
        let cancelled = false;

        (async () => {
            console.log('[LAYOUT] Validate session...');
            let token = await getToken();

            if (token && !validated.current) {
                validated.current = true;
                try {
                    const profile = await api.me();
                    await AsyncStorage.setItem(
                        'profile',
                        JSON.stringify(profile)
                    );
                    console.log('[LAYOUT] ✅ Session valid');
                } catch (err: any) {
                    console.warn(
                        '[LAYOUT] ⚠️ Session invalid:',
                        err?.message
                    );
                    if (!(await hasCachedProfile())) {
                        await clearToken();
                        token = null;
                    }
                }
            }

            if (!cancelled) setReady(true);
        })();

        return () => {
            cancelled = true;
        };
    }, []);   // ← mount sekali saja

    // ============================================================
    // ✅ EFFECT 2: Guard navigasi — runs saat segments berubah
    // ============================================================
    useEffect(() => {
        if (!ready) return;

        (async () => {
            const token = await getToken();
            const inAuthGroup = (segments as string[])[0] === '(auth)';
            const atRoot = (segments as string[]).length === 0;

            if (!token && !inAuthGroup) {
                console.log('[LAYOUT] → login (no token)');
                router.replace('/(auth)/login' as any);
            } else if (token && (inAuthGroup || atRoot)) {
                console.log('[LAYOUT] → (tabs) (logged in)');
                router.replace('/(tabs)' as any);
            }

            // Push notif — sekali per sesi
            if (token && !pushRegistered.current) {
                pushRegistered.current = true;
                console.log('[LAYOUT] Register push token...');
                registerPushToken().catch((e) =>
                    console.warn(
                        '[PUSH] Gagal registrasi:',
                        e?.message
                    )
                );
            }
            if (!token) {
                pushRegistered.current = false;
                validated.current = false;   // ✅ reset saat logout
            }
        })();
    }, [segments, ready]);

    // ============================================================
    // Tap notifikasi → redirect
    // ============================================================
    useEffect(() => {
        if (!ready || !lastResponse) return;
        if (
            lastResponse.actionIdentifier !==
            Notifications.DEFAULT_ACTION_IDENTIFIER
        )
            return;

        const id = lastResponse.notification.request.identifier;
        if (handledNotifId.current === id) return;
        handledNotifId.current = id;

        getToken().then((token) => {
            if (!token) return;
            const data = lastResponse.notification.request.content
                .data as Record<string, any>;
            const target = routeForNotification(data);
            console.log('[notif] Tap → redirect ke:', target);
            router.replace(target as any);
        });
    }, [lastResponse, ready]);

    return (
        <View style={{ flex: 1 }}>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }} />

            {!ready && (
                <View style={styles.splash}>
                    <ActivityIndicator size="large" color={PRIMARY} />
                </View>
            )}
        </View>
    );
}

// ============================================================
// ✅ HELPER: Logout (panggil dari halaman akun)
// ============================================================
export async function handleLogout(
    router: ReturnType<typeof useRouter>
) {
    try {
        // 1. Clear FCM token di backend
        try {
            await api.updateProfile({ fcm_token: null as any });
            console.log('[LOGOUT] ✅ FCM token cleared');
        } catch (e) {
            console.warn('[LOGOUT] ⚠️ Gagal clear fcm_token:', e);
        }

        // 2. Clear JWT & profil lokal
        await clearToken();
        await AsyncStorage.removeItem('profile');

        // 3. Redirect
        router.replace('/(auth)/login' as any);
    } catch (err) {
        console.error('[LOGOUT] Error:', err);
    }
}

const styles = StyleSheet.create({
    splash: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
});