// app/(tabs)/akun.tsx — profil & keluar
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
    AlertButton,
    AlertSheet,
    LoadingModal,
} from '../../components/FeedbackModals';
import {
    api,
    clearToken,
    getToken,
    MerchantStore,
} from '../../lib/api';
import { COLORS } from '../../lib/theme';

export default function AkunScreen() {
    const [store, setStore] = useState<MerchantStore | null>(null);
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [loggingOut, setLoggingOut] = useState(false);

    // ============================================================
    // ✅ STATE: AlertSheet
    // ============================================================
    const [alertState, setAlertState] = useState<{
        visible: boolean;
        title: string;
        message: string;
        buttons?: AlertButton[];
    }>({ visible: false, title: '', message: '' });

    const showAlert = (
        title: string,
        message: string,
        buttons?: AlertButton[]
    ) => setAlertState({ visible: true, title, message, buttons });

    const closeAlert = () =>
        setAlertState((p) => ({ ...p, visible: false }));

    // ============================================================
    // LOAD PROFILE
    // ============================================================
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

    // ============================================================
    // ✅ KONFIRMASI LOGOUT
    // ============================================================
    const confirmLogout = () => {
        if (loggingOut) return;
        showAlert(
            'Keluar dari akun?',
            'Anda perlu masuk lagi untuk menerima pesanan dan notifikasi.',
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Keluar',
                    style: 'destructive',
                    onPress: () => {
                        // Delay kecil supaya AlertSheet sempat nutup
                        setTimeout(() => {
                            doLogout();
                        }, 200);
                    },
                },
            ]
        );
    };

    // ============================================================
    // ✅ LOGOUT (dipanggil setelah konfirmasi)
    // ============================================================
    const doLogout = async () => {
        if (loggingOut) return;

        setLoggingOut(true);

        console.log('═══════════════════════════════════════════');
        console.log('🚪 [LOGOUT] START');
        console.log('═══════════════════════════════════════════');

        try {
            // ============================================================
            // 1. Verifikasi token ada
            // ============================================================
            const token = await getToken();
            console.log('🟡 [LOGOUT] Step 1: cek token:', {
                exists: !!token,
                length: token?.length ?? 0,
            });

            // ============================================================
            // 2. Clear FCM token di backend
            // ============================================================
            if (token) {
                console.log(
                    '🟡 [LOGOUT] Step 2: clear fcm_token di backend...'
                );

                try {
                    await api.updateProfile({
                        fcm_token: null as any,
                    });
                    console.log('🟢 [LOGOUT] Step 2 OK — FCM cleared');
                } catch (err: any) {
                    console.warn(
                        '⚠️ [LOGOUT] Gagal clear FCM (lanjut):',
                        err?.message
                    );
                }
            } else {
                console.log(
                    '⏭️ [LOGOUT] Step 2 skipped — token kosong'
                );
            }

            // ============================================================
            // 3. Clear JWT token di perangkat
            // ============================================================
            console.log('🟡 [LOGOUT] Step 3: clear JWT di perangkat...');
            await clearToken();

            const checkToken = await getToken();
            console.log('🟢 [LOGOUT] Step 3 OK — token sekarang:', {
                exists: !!checkToken,
            });

            // ============================================================
            // 4. Clear profil cache di AsyncStorage
            // ============================================================
            console.log('🟡 [LOGOUT] Step 4: clear profil cache...');
            await AsyncStorage.removeItem('profile');

            const cachedProfile = await AsyncStorage.getItem('profile');
            console.log('🟢 [LOGOUT] Step 4 OK — profil cache:', {
                exists: !!cachedProfile,
            });

            // ============================================================
            // 5. Redirect ke halaman login
            // ============================================================
            console.log('🟡 [LOGOUT] Step 5: redirect ke login...');

            router.replace('/(auth)/login' as any);

            console.log('═══════════════════════════════════════════');
            console.log('✅ [LOGOUT] SUKSES');
            console.log('═══════════════════════════════════════════');
        } catch (err: any) {
            console.error('═══════════════════════════════════════════');
            console.error('🔴 [LOGOUT] GAGAL');
            console.error('═══════════════════════════════════════════');
            console.error('[LOGOUT] Error:', err?.message);

            // ✅ Pakai AlertSheet, bukan Alert.alert
            showAlert(
                'Logout dengan catatan',
                err?.message ??
                'Terjadi kesalahan, tapi Anda tetap akan keluar.',
                [
                    {
                        text: 'OK',
                        style: 'default',
                        onPress: () => {
                            // Paksa redirect meski ada error
                            setTimeout(() => {
                                router.replace('/(auth)/login' as any);
                            }, 100);
                        },
                    },
                ]
            );

            // Kalau user tutup alert tanpa tekan OK, tetap paksa logout
            setTimeout(() => {
                router.replace('/(auth)/login' as any);
            }, 3000);
        } finally {
            setLoggingOut(false);
        }
    };

    // ============================================================
    // ROW COMPONENT
    // ============================================================
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
        <TouchableOpacity
            style={styles.row}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <Ionicons
                name={icon}
                size={22}
                color={danger ? COLORS.danger : COLORS.primary}
            />
            <Text
                style={[
                    styles.rowText,
                    danger && { color: COLORS.danger },
                ]}
            >
                {label}
            </Text>
            {!danger && (
                <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={COLORS.placeholder}
                />
            )}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Akun</Text>

                {/* Profil toko */}
                <View style={styles.profile}>
                    <View style={styles.logo}>
                        {store?.logo_url ? (
                            <Image
                                source={{ uri: store.logo_url }}
                                style={styles.logoImg}
                            />
                        ) : (
                            <Ionicons
                                name="storefront-outline"
                                size={30}
                                color={COLORS.primary}
                            />
                        )}
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.storeName} numberOfLines={1}>
                            {store?.store_name ?? 'Toko Anda'}
                        </Text>
                        {!!email && (
                            <Text style={styles.meta}>{email}</Text>
                        )}
                        {!!phone && (
                            <Text style={styles.meta}>{phone}</Text>
                        )}
                    </View>
                </View>

                {/* Menu */}
                <View style={styles.group}>
                    <Row
                        icon="create-outline"
                        label="Edit Profil Toko"
                        onPress={() =>
                            router.push('/lengkapi-toko' as any)
                        }
                    />
                </View>

                <View style={styles.group}>
                    <Row
                        icon="log-out-outline"
                        label="Keluar"
                        onPress={confirmLogout}
                        danger
                    />
                </View>
            </ScrollView>

            {/* ============================================================
                LOADING MODAL — saat logout berjalan
               ============================================================ */}
            <LoadingModal visible={loggingOut} />

            {/* ============================================================
                ALERT SHEET — konfirmasi + error
               ============================================================ */}
            <AlertSheet
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                buttons={alertState.buttons}
                onClose={closeAlert}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.surface },
    content: { padding: 20, gap: 16 },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.ink,
    },
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
    storeName: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.ink,
    },
    meta: { fontSize: 13, color: COLORS.muted },
    group: {
        borderRadius: 18,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.line,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        height: 56,
    },
    rowText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.ink,
    },
});