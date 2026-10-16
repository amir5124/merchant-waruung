// app/(tabs)/index.tsx  — Beranda merchant
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
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
import OrderCard from '../../components/OrderCard';
import ToggleSwitch from '../../components/ToggleSwitch';
import { useOrders } from '../../hooks/useOrders';
import { api, MerchantStore } from '../../lib/api';
import { greeting, rupiah } from '../../lib/format';
import { getOpenStatus } from '../../lib/openHours';
import { COLORS } from '../../lib/theme';

// ============================================================
// STAT CARD
// ============================================================
function StatCard({
    icon,
    iconColor,
    value,
    label,
    small,
}: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    iconColor: string;
    value: string;
    label: string;
    small?: boolean;
}) {
    return (
        <View style={styles.statCard}>
            <Ionicons name={icon} size={22} color={iconColor} />
            <Text
                style={[styles.statValue, small && { fontSize: 20 }]}
                numberOfLines={1}
            >
                {value}
            </Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

// ============================================================
// SCREEN
// ============================================================
export default function BerandaScreen() {
    const [store, setStore] = useState<MerchantStore | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [now, setNow] = useState(() => new Date());

    const orders = useOrders();

    // ============================================================
    // STATE: AlertSheet + LoadingModal
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

    // ✅ Loading state global (toggle, accept, reject dari parent)
    const [busyAction, setBusyAction] = useState<string | null>(null);

    // ============================================================
    // LOAD STORE
    // ============================================================
    const loadStore = useCallback(async () => {
        try {
            setError(null);
            const s = await api.merchant.getMyStore();
            if (!s) {
                router.replace('/lengkapi-toko' as any);
                return;
            }
            setStore(s);
        } catch (e: any) {
            setError(e?.message ?? 'Gagal memuat data toko');
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadStore();
            setNow(new Date());
            const timer = setInterval(() => setNow(new Date()), 60 * 1000);
            return () => clearInterval(timer);
        }, [loadStore])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([loadStore(), orders.refresh()]);
        setNow(new Date());
        setRefreshing(false);
    };

    // ============================================================
    // TOGGLE OPEN — pakai LoadingModal
    // ============================================================
    const toggleOpen = async (value: boolean) => {
        setBusyAction('toggle');
        try {
            const updated = await api.merchant.setOpen(value);
            setStore(updated);
        } catch (e: any) {
            showAlert(
                'Gagal mengubah status',
                e?.message ?? 'Coba lagi.',
                [{ text: 'OK', style: 'default' }]
            );
        } finally {
            setBusyAction(null);
        }
    };

    // ============================================================
    // LOADING / ERROR STATE
    // ============================================================
    if (loading) {
        return (
            <SafeAreaView
                edges={['top']}
                style={[styles.container, styles.center]}
            >
                <ActivityIndicator size="large" color={COLORS.primary} />
            </SafeAreaView>
        );
    }

    if (error && !store) {
        return (
            <SafeAreaView
                edges={['top']}
                style={[styles.container, styles.center]}
            >
                <Ionicons
                    name="cloud-offline-outline"
                    size={44}
                    color={COLORS.muted}
                />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={() => {
                        setLoading(true);
                        loadStore();
                    }}
                >
                    <Text style={styles.retryText}>Coba Lagi</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    if (!store) return null;

    const isOpen = store.is_open;
    const rating =
        store.rating_avg != null
            ? Number(store.rating_avg).toFixed(1).replace('.', ',')
            : '-';
    const hasLocation = store.latitude != null && store.longitude != null;

    const { hasSchedule, withinHours, todayLabel } = getOpenStatus(
        (store as any).open_hours,
        now
    );
    const outsideHours = isOpen && hasSchedule && !withinHours;
    const effectivelyClosed = !isOpen || outsideHours;

    const hoursText = todayLabel
        ? `Jam operasional hari ini ${todayLabel}`
        : 'Hari ini toko libur menurut jadwal operasional';

    return (
        <SafeAreaView edges={['top']} style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scroll}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                    />
                }
            >
                {/* ── Header ── */}
                <View style={styles.header}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.greet}>{greeting()}</Text>
                        <View style={styles.nameRow}>
                            <Text
                                style={styles.storeName}
                                numberOfLines={1}
                            >
                                {store.store_name}
                            </Text>
                            {effectivelyClosed && (
                                <View style={styles.closedBadge}>
                                    <View style={styles.closedDot} />
                                    <Text style={styles.closedBadgeText}>
                                        Tutup
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <TouchableOpacity
                        style={styles.bell}
                        onPress={() =>
                            router.push('/(tabs)/pesanan' as any)
                        }
                        accessibilityLabel="Lihat pesanan"
                    >
                        <Ionicons
                            name="notifications-outline"
                            size={20}
                            color={COLORS.ink}
                        />
                        {orders.baru.length > 0 && (
                            <View style={styles.bellDot} />
                        )}
                    </TouchableOpacity>
                </View>

                {/* ── Status toko ── */}
                <View
                    style={[
                        styles.statusCard,
                        {
                            backgroundColor: effectivelyClosed
                                ? '#3d4b58'
                                : COLORS.primary,
                        },
                    ]}
                >
                    <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.statusLabel}>Status toko</Text>
                        <Text style={styles.statusText}>
                            {!isOpen
                                ? 'Tutup, tidak menerima pesanan'
                                : outsideHours
                                    ? 'Di luar jam operasional'
                                    : 'Buka, menerima pesanan'}
                        </Text>
                        {hasSchedule && (
                            <Text style={styles.statusHours}>
                                {hoursText}
                            </Text>
                        )}
                    </View>
                    <ToggleSwitch
                        variant="onPrimary"
                        value={isOpen}
                        onValueChange={toggleOpen}
                        label={
                            isOpen
                                ? 'Status toko buka'
                                : 'Status toko tutup'
                        }
                    />
                </View>

                {/* ── Warning jam operasional ── */}
                {outsideHours && (
                    <View style={styles.warnCard}>
                        <Ionicons
                            name="time-outline"
                            size={20}
                            color={COLORS.warnText}
                        />
                        <Text style={styles.warnText}>
                            Saklar toko masih menyala, tapi saat ini di
                            luar jam operasional. Atur jadwal atau
                            matikan saklar kalau tidak ingin menerima
                            pesanan.
                        </Text>
                    </View>
                )}

                {/* ── Statistik ── */}
                <View style={styles.statsRow}>
                    <StatCard
                        icon="receipt-outline"
                        iconColor={COLORS.primary}
                        value={String(orders.todayCount)}
                        label="Pesanan hari ini"
                    />
                    <StatCard
                        icon="wallet-outline"
                        iconColor={COLORS.primary}
                        value={rupiah(orders.todayIncome)}
                        label="Pendapatan hari ini"
                        small
                    />
                </View>
                <View style={styles.statsRow}>
                    <StatCard
                        icon="star"
                        iconColor="#e68515"
                        value={rating}
                        label="Rating toko"
                    />
                    <StatCard
                        icon="time-outline"
                        iconColor="#e68515"
                        value={String(orders.baru.length)}
                        label="Perlu diproses"
                    />
                </View>

                {/* ── Lokasi warning ── */}
                {!hasLocation && (
                    <TouchableOpacity
                        style={styles.warnCard}
                        activeOpacity={0.8}
                        onPress={() =>
                            router.push('/lengkapi-toko' as any)
                        }
                    >
                        <Ionicons
                            name="location-outline"
                            size={20}
                            color={COLORS.warnText}
                        />
                        <Text style={styles.warnText}>
                            Lokasi toko belum diatur, tokomu belum muncul
                            di pencarian terdekat. Ketuk untuk mengatur.
                        </Text>
                    </TouchableOpacity>
                )}

                {/* ── Pesanan masuk ── */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>
                        Pesanan masuk
                    </Text>
                    <TouchableOpacity
                        style={styles.sectionLink}
                        onPress={() =>
                            router.push('/(tabs)/pesanan' as any)
                        }
                    >
                        <Text style={styles.sectionLinkText}>
                            Lihat semua
                        </Text>
                    </TouchableOpacity>
                </View>

                {orders.error && orders.orders.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyText}>
                            Pesanan belum bisa dimuat: {orders.error}
                        </Text>
                    </View>
                ) : orders.baru.length === 0 ? (
                    <View style={styles.emptyCard}>
                        <Ionicons
                            name="checkmark-circle-outline"
                            size={28}
                            color={COLORS.muted}
                        />
                        <Text style={styles.emptyText}>
                            Belum ada pesanan baru.
                        </Text>
                    </View>
                ) : (
                    <View style={{ gap: 12 }}>
                        {orders.baru.slice(0, 3).map((o) => (
                            <OrderCard
                                key={o.id}
                                order={o}
                                variant="compact"
                                // ✅ OrderCard handle loading & alert sendiri
                                onAccept={async () => {
                                    await orders.accept(o.id);
                                }}
                                onReject={async () => {
                                    await orders.reject(o.id);
                                }}
                            />
                        ))}
                    </View>
                )}
            </ScrollView>

            {/* ============================================================
                LOADING MODAL — untuk toggle dari parent
               ============================================================ */}
            <LoadingModal visible={!!busyAction} />

            {/* ============================================================
                ALERT SHEET — untuk alert dari parent
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

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.surface },
    center: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    scroll: { padding: 24, paddingBottom: 32 },

    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    greet: { fontSize: 13, color: COLORS.muted },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    storeName: {
        flexShrink: 1,
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: -0.3,
        color: COLORS.ink,
    },
    closedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 3,
        paddingHorizontal: 9,
        borderRadius: 999,
        backgroundColor: '#fdecea',
    },
    closedDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#d92d20',
    },
    closedBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#b42318',
    },
    bell: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: COLORS.line,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bellDot: {
        position: 'absolute',
        top: 9,
        right: 10,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#e68515',
        borderWidth: 2,
        borderColor: COLORS.white,
    },

    statusCard: {
        marginTop: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 18,
        paddingHorizontal: 20,
        borderRadius: 20,
    },
    statusLabel: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.9)',
    },
    statusText: {
        fontSize: 17,
        fontWeight: '800',
        color: '#ffffff',
    },
    statusHours: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
    },

    statsRow: { marginTop: 12, flexDirection: 'row', gap: 12 },
    statCard: {
        flex: 1,
        gap: 4,
        padding: 16,
        borderRadius: 18,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.line,
    },
    statValue: {
        marginTop: 6,
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.ink,
    },
    statLabel: { fontSize: 12, color: COLORS.muted },

    warnCard: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 14,
        borderRadius: 14,
        backgroundColor: COLORS.warnBg,
    },
    warnText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 19,
        color: COLORS.warnText,
    },

    sectionHeader: {
        marginTop: 22,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitle: { fontSize: 17, fontWeight: '800', color: COLORS.ink },
    sectionLink: { minHeight: 44, justifyContent: 'center' },
    sectionLinkText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.primary,
    },

    emptyCard: {
        alignItems: 'center',
        gap: 8,
        padding: 24,
        borderRadius: 18,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.line,
    },
    emptyText: {
        fontSize: 14,
        color: COLORS.muted,
        textAlign: 'center',
        lineHeight: 20,
    },

    errorText: {
        marginVertical: 12,
        fontSize: 14,
        color: COLORS.muted,
        textAlign: 'center',
    },
    retryBtn: {
        height: 48,
        paddingHorizontal: 28,
        borderRadius: 999,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    retryText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});