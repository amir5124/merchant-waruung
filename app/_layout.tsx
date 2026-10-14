// app/_layout.tsx
import { api, clearToken, getToken } from '../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

const PRIMARY = '#40a3ea';

// Halaman tujuan setelah login, berdasarkan role
function homeForRole(role?: string | null): string {
    switch (role) {
        case 'driver':
            return '/driver-home';
        case 'merchant':
            return '/(tabs)';
        default:
            return '/(tabs)';
    }
}

async function getCachedRole(): Promise<string | null> {
    try {
        const raw = await AsyncStorage.getItem('profile');
        return raw ? JSON.parse(raw)?.role ?? null : null;
    } catch {
        return null;
    }
}

export default function RootLayout() {
    const router = useRouter();
    const segments = useSegments();
    const [ready, setReady] = useState(false);

    // Token divalidasi ke server sekali saja saat app dibuka
    const validated = useRef(false);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            let token = await getToken();

            // 1. Validasi sesi sekali saat app dibuka
            if (token && !validated.current) {
                validated.current = true;
                try {
                    const profile = await api.me();
                    await AsyncStorage.setItem('profile', JSON.stringify(profile));
                } catch (err: any) {
                    // Gagal (token kedaluwarsa atau jaringan putus).
                    // Kalau ada profil cache, anggap masih login (mode offline);
                    // kalau tidak, bersihkan sesi supaya diarahkan ke login.
                    const cachedRole = await getCachedRole();
                    if (!cachedRole) {
                        console.warn('[AUTH] Sesi tidak valid:', err?.message);
                        await clearToken();
                        token = null;
                    }
                }
            }

            if (cancelled) return;

            // 2. Guard: arahkan sesuai status login
            const inAuthGroup = (segments as string[])[0] === '(auth)';
            const atRoot = (segments as string[]).length === 0;

            if (!token && !inAuthGroup) {
                router.replace('/(auth)/login' as any);
            } else if (token && (inAuthGroup || atRoot)) {
                const role = await getCachedRole();
                if (!cancelled) router.replace(homeForRole(role) as any);
            }

            if (!cancelled) setReady(true);
        })();

        return () => {
            cancelled = true;
        };
        // Dijalankan ulang setiap pindah halaman, supaya setelah login/logout
        // (token berubah) guard langsung menyesuaikan.
    }, [segments]);

    return (
        <View style={{ flex: 1 }}>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }} />

            {/* Layar loading sampai status login diketahui,
                supaya halaman yang salah tidak sempat berkedip */}
            {!ready && (
                <View style={styles.splash}>
                    <ActivityIndicator size="large" color={PRIMARY} />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    splash: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
});