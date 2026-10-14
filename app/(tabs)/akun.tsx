// app/(tabs)/akun.tsx — profil & keluar
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, clearToken, MerchantStore } from '../../lib/api';
import { confirmAction } from '../../lib/dialogs';
import { COLORS } from '../../lib/theme';

export default function AkunScreen() {
    const [store, setStore] = useState<MerchantStore | null>(null);
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    useFocusEffect(
        useCallback(() => {
            (async () => {
                try {
                    const raw = await AsyncStorage.getItem('profile');
                    if (raw) {
                        const p = JSON.parse(raw);
                        setEmail(p?.email ?? '');
                        setPhone(p?.phone ?? '');
                    }
                } catch { }
                try {
                    setStore(await api.merchant.getMyStore());
                } catch { }
            })();
        }, [])
    );

    const logout = async () => {
        const ok = await confirmAction({
            title: 'Keluar dari akun?',
            message: 'Anda perlu masuk lagi untuk menerima pesanan.',
            confirmText: 'Keluar',
            destructive: true,
        });
        if (!ok) return;
        await clearToken();
        await AsyncStorage.removeItem('profile');
        router.replace('/(auth)/welcome' as any);
    };

    const Row = ({
        icon,
        label,
        onPress,
        danger,
    }: {
        icon: React.ComponentProps<typeof Ionicons>['name'];
        label: string;
        onPress: () => void;
        danger?: boolean;
    }) => (
        <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.8}>
            <Ionicons name={icon} size={22} color={danger ? COLORS.danger : COLORS.primary} />
            <Text style={[styles.rowText, danger && { color: COLORS.danger }]}>{label}</Text>
            {!danger && <Ionicons name="chevron-forward" size={20} color={COLORS.placeholder} />}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Akun</Text>

                <View style={styles.profile}>
                    <View style={styles.logo}>
                        {store?.logo_url ? (
                            <Image source={{ uri: store.logo_url }} style={styles.logoImg} />
                        ) : (
                            <Ionicons name="storefront-outline" size={30} color={COLORS.primary} />
                        )}
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.storeName} numberOfLines={1}>
                            {store?.store_name ?? 'Toko Anda'}
                        </Text>
                        {!!email && <Text style={styles.meta}>{email}</Text>}
                        {!!phone && <Text style={styles.meta}>{phone}</Text>}
                    </View>
                </View>

                <View style={styles.group}>
                    <Row icon="create-outline" label="Edit Profil Toko" onPress={() => router.push('/lengkapi-toko' as any)} />
                </View>
                <View style={styles.group}>
                    <Row icon="log-out-outline" label="Keluar" onPress={logout} danger />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.surface },
    content: { padding: 20, gap: 16 },
    title: { fontSize: 24, fontWeight: '800', color: COLORS.ink },
    profile: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        borderRadius: 18,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.line,
    },
    logo: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: COLORS.primaryTint,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    logoImg: { width: 64, height: 64 },
    storeName: { fontSize: 18, fontWeight: '800', color: COLORS.ink },
    meta: { fontSize: 13, color: COLORS.muted },
    group: {
        borderRadius: 18,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.line,
        overflow: 'hidden',
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, height: 56 },
    rowText: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.ink },
});