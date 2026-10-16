// app/(tabs)/pesanan.tsx — layar Pesanan merchant
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppAlert, { AlertButton } from '../../components/AppAlert';
import OrderCard from '../../components/OrderCard';
import { useOrders } from '../../hooks/useOrders';
import { COLORS } from '../../lib/theme';

type Tab = 'baru' | 'diproses' | 'selesai';

const EMPTY: Record<Tab, string> = {
    baru: 'Belum ada pesanan baru.',
    diproses: 'Tidak ada pesanan yang sedang diproses.',
    selesai: 'Belum ada pesanan selesai.',
};

export default function PesananScreen() {
    const [tab, setTab] = useState<Tab>('baru');
    const [refreshing, setRefreshing] = useState(false);
    const o = useOrders();

    // ============================================================
    // ALERT (AppAlert)
    // ============================================================
    const [alertState, setAlertState] = useState<{
        visible: boolean;
        title: string;
        message: string;
        buttons?: AlertButton[];
    }>({ visible: false, title: '', message: '' });

    const showAlert = (title: string, message: string, buttons?: AlertButton[]) =>
        setAlertState({ visible: true, title, message, buttons });

    const closeAlert = () => setAlertState((p) => ({ ...p, visible: false }));

    const data = tab === 'baru' ? o.baru : tab === 'diproses' ? o.diproses : o.selesai;

    const onRefresh = async () => {
        setRefreshing(true);
        await o.refresh();
        setRefreshing(false);
    };

    // ── Terima pesanan baru ──
    const handleAccept = async (id: number) => {
        try {
            await o.accept(id);
            setTab('diproses'); // pesanan pindah ke tab Diproses
        } catch (e: any) {
            showAlert('Gagal menerima pesanan', e?.message ?? 'Coba lagi sebentar.');
        }
    };

    // ── Tolak pesanan baru (dengan konfirmasi) ──
    const handleReject = (id: number) => {
        showAlert(
            'Tolak pesanan?',
            'Pesanan ini akan dibatalkan dan pelanggan akan diberi tahu.',
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Tolak',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await o.reject(id);
                        } catch (e: any) {
                            showAlert(
                                'Gagal menolak pesanan',
                                e?.message ?? 'Coba lagi sebentar.'
                            );
                        }
                    },
                },
            ] as AlertButton[]
        );
    };

    // ── Tandai pesanan siap diambil (driver diberi notifikasi) ──
    const handleReady = (id: number) => {
        showAlert(
            'Pesanan sudah siap?',
            'Driver akan diberi notifikasi bahwa pesanan siap diambil.',
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Ya, siap',
                    onPress: async () => {
                        try {
                            await o.ready(id);
                        } catch (e: any) {
                            showAlert(
                                'Gagal menandai siap',
                                e?.message ?? 'Coba lagi sebentar.'
                            );
                        }
                    },
                },
            ] as AlertButton[]
        );
    };

    const tabs: { key: Tab; label: string }[] = [
        { key: 'baru', label: `Baru (${o.baru.length})` },
        { key: 'diproses', label: `Diproses (${o.diproses.length})` },
        { key: 'selesai', label: 'Selesai' },
    ];

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.title}>Pesanan</Text>
            </View>

            <View style={styles.segment}>
                {tabs.map((t) => {
                    const active = tab === t.key;
                    return (
                        <TouchableOpacity
                            key={t.key}
                            style={[styles.segBtn, active && styles.segBtnActive]}
                            activeOpacity={0.85}
                            onPress={() => setTab(t.key)}
                        >
                            <Text
                                style={[styles.segText, active && styles.segTextActive]}
                                numberOfLines={1}
                            >
                                {t.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {o.loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={data}
                    extraData={o.busyId}
                    keyExtractor={(i) => String(i.id)}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={COLORS.primary}
                        />
                    }
                    ListHeaderComponent={
                        o.error ? (
                            <View style={styles.errorBox}>
                                <Text style={styles.errorText}>{o.error}</Text>
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="receipt-outline" size={44} color={COLORS.dashed} />
                            <Text style={styles.emptyText}>{EMPTY[tab]}</Text>
                        </View>
                    }
                    renderItem={({ item }) => (
                        <OrderCard
                            order={item}
                            variant="detail"
                            busy={o.busyId === item.id}
                            onAccept={() => handleAccept(item.id)}
                            onReject={() => handleReject(item.id)}
                            onReady={() => handleReady(item.id)}
                        />
                    )}
                    ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
                />
            )}

            <AppAlert
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
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
    title: { fontSize: 24, fontWeight: '800', color: COLORS.ink },
    segment: {
        flexDirection: 'row',
        marginHorizontal: 20,
        marginBottom: 12,
        padding: 4,
        gap: 4,
        borderRadius: 999,
        backgroundColor: '#e9eff4',
    },
    segBtn: {
        flex: 1,
        height: 44,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
    },
    segBtnActive: { backgroundColor: COLORS.primary },
    segText: { fontSize: 13, fontWeight: '700', color: COLORS.muted },
    segTextActive: { color: '#ffffff' },
    list: { padding: 20, paddingTop: 8, paddingBottom: 32, flexGrow: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty: { alignItems: 'center', gap: 10, paddingVertical: 64 },
    emptyText: { fontSize: 14, color: COLORS.muted },
    errorBox: { padding: 12, borderRadius: 12, backgroundColor: '#fdecec', marginBottom: 12 },
    errorText: { fontSize: 13, color: COLORS.danger },
});