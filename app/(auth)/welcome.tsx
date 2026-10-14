// app/(auth)/welcome.tsx  — layar Selamat Datang
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
    Image,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../lib/theme';

// Ilustrasi hero: taruh file gambarnya di assets/images/merchant.png
const merchantImage = require('../../assets/images/merchant.png');

export default function WelcomeScreen() {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();

    // Hero ±52% tinggi layar (desain: 440 dari 844), dibatasi supaya aman di layar kecil/besar
    const heroHeight = Math.min(440, Math.max(340, height * 0.52));
    const heroTop = insets.top + 24;
    // Sisa ruang hero setelah baris brand (40) dan jarak (28 + 16)
    const imageH = Math.min(230, heroHeight - heroTop - 40 - 28 - 16);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.primaryTint} />

            {/* ── HERO ── */}
            <View style={[styles.hero, { height: heroHeight, paddingTop: heroTop }]}>

                <Image
                    source={merchantImage}
                    style={{ width: '80%', height: imageH }}
                    resizeMode="contain"
                    accessible={false}
                />
            </View>

            {/* ── TEKS ── */}
            <View style={styles.textBlock}>
                <Text style={styles.title}>Kelola warungmu, terima pesanan lebih mudah</Text>
                <Text style={styles.subtitle}>
                    Atur menu, buka dan tutup toko, lalu pantau pesanan pelanggan dari satu aplikasi.
                </Text>
            </View>

            <View style={{ flex: 1, minHeight: 24 }} />

            {/* ── TOMBOL ── */}
            <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
                <TouchableOpacity
                    style={styles.primaryButton}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    onPress={() => router.push('/(auth)/login' as any)}
                >
                    <Text style={styles.primaryButtonText}>Masuk</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.outlineButton}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    onPress={() => router.push('/(auth)/register' as any)}
                >
                    <Text style={styles.outlineButtonText}>Daftar sebagai Merchant</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.white },

    hero: {
        backgroundColor: COLORS.primaryTint,
        borderBottomLeftRadius: 40,
        borderBottomRightRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    logoBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandText: { fontSize: 18, fontWeight: '800', color: COLORS.ink, letterSpacing: -0.2 },

    textBlock: { paddingHorizontal: 28, paddingTop: 32, gap: 12 },
    title: {
        fontSize: 28,
        lineHeight: 34,
        fontWeight: '800',
        letterSpacing: -0.4,
        color: COLORS.ink,
    },
    subtitle: { fontSize: 15, lineHeight: 23, color: COLORS.muted },

    actions: { paddingHorizontal: 28, gap: 12 },
    primaryButton: {
        height: 54,
        borderRadius: 999,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    outlineButton: {
        height: 54,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: COLORS.primary,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    outlineButtonText: { color: COLORS.primary, fontSize: 16, fontWeight: '700' },
});