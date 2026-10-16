// components/OrderCard.tsx
// Kartu pesanan: 'compact' (di Beranda) dan 'detail' (di tab Pesanan).
//
// Alur "merchant dulu":
//   1. pending + merchant_status 'waiting'  → toko Terima / Tolak
//   2. merchant_status 'accepted'           → toko menyiapkan; boleh tekan "Pesanan siap diambil"
//   3. in_progress / completed / cancelled  → tidak ada aksi
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Image,
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    AlertSheet,
    AlertButton,
    LoadingModal,
} from './FeedbackModals';
import { OrderResponse } from '../lib/api';
import { rupiah, timeAgo } from '../lib/format';
import { COLORS } from '../lib/theme';

// ============================================================
// TYPES
// ============================================================
type Chip = { label: string; bg: string; fg: string };

const STATUS: Record<string, Chip> = {
    pending: {
        label: 'Baru',
        bg: COLORS.primaryTint,
        fg: COLORS.primary,
    },
    accepted: {
        label: 'Driver menuju toko',
        bg: COLORS.primaryTint,
        fg: COLORS.primary,
    },
    arrived: {
        label: 'Driver di toko',
        bg: COLORS.warnBg,
        fg: COLORS.warnText,
    },
    in_progress: {
        label: 'Diantar',
        bg: COLORS.warnBg,
        fg: COLORS.warnText,
    },
    completed: {
        label: 'Selesai',
        bg: COLORS.okBg,
        fg: COLORS.okText,
    },
    cancelled: {
        label: 'Dibatalkan',
        bg: '#fdecec',
        fg: COLORS.danger,
    },
};

const READY_CHIP: Chip = {
    label: 'Siap diambil',
    bg: COLORS.okBg,
    fg: COLORS.okText,
};
const SEARCHING_CHIP: Chip = {
    label: 'Mencari driver',
    bg: COLORS.warnBg,
    fg: COLORS.warnText,
};

const READY_ALLOWED = ['pending', 'accepted', 'arrived'];

function statusChip(order: OrderResponse): Chip {
    const waiting =
        order.status === 'pending' && order.merchant_status === 'waiting';
    if (waiting) return STATUS.pending;

    if (order.status === 'pending')
        return order.merchant_ready_at ? READY_CHIP : SEARCHING_CHIP;

    if (
        (order.status === 'accepted' || order.status === 'arrived') &&
        order.merchant_ready_at
    ) {
        return READY_CHIP;
    }
    return STATUS[order.status] ?? STATUS.pending;
}

type Props = {
    order: OrderResponse;
    variant: 'compact' | 'detail';
    busy?: boolean;
    onAccept?: () => Promise<void> | void;
    onReject?: () => Promise<void> | void;
    onReady?: () => Promise<void> | void;
};

// ============================================================
// COMPONENT
// ============================================================
export default function OrderCard({
    order,
    variant,
    busy: busyProp,
    onAccept,
    onReject,
    onReady,
}: Props) {
    const total = (order.subtotal ?? 0) + (order.packaging_fee ?? 0);

    const items = order.items ?? (order as any).order_items ?? [];

    const waiting =
        order.status === 'pending' && order.merchant_status === 'waiting';
    const searchingDriver =
        order.status === 'pending' && order.merchant_status !== 'waiting';
    const canReady =
        order.type === 'food' &&
        order.merchant_status === 'accepted' &&
        READY_ALLOWED.includes(order.status) &&
        !order.merchant_ready_at;
    const readyMarked =
        !!order.merchant_ready_at && READY_ALLOWED.includes(order.status);

    // ============================================================
    // LOCAL STATE
    // ============================================================
    const [busyLocal, setBusyLocal] = useState(false);
    const busy = busyProp ?? busyLocal;

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
    // WRAPPER: Handle async + loading + alert
    // ============================================================
    const runAction = async (
        action: (() => Promise<void> | void) | undefined,
        opts: {
            successTitle?: string;
            successMessage?: string;
            errorTitle?: string;
        } = {}
    ) => {
        if (!action) return;
        if (busyLocal) return;

        setBusyLocal(true);
        try {
            await action();
            if (opts.successTitle) {
                showAlert(
                    opts.successTitle,
                    opts.successMessage ?? '',
                    [{ text: 'OK', style: 'default' }]
                );
            }
        } catch (e: any) {
            console.error('[OrderCard] action failed:', e);
            showAlert(
                opts.errorTitle ?? 'Gagal',
                e?.message ?? 'Terjadi kesalahan. Coba lagi.',
                [{ text: 'OK', style: 'default' }]
            );
        } finally {
            setBusyLocal(false);
        }
    };

    // ============================================================
    // HANDLERS
    // ============================================================
    const handleAccept = () => {
        if (!onAccept) return;
        runAction(onAccept, {
            successTitle: 'Pesanan Diterima',
            successMessage:
                'Pesanan sudah kamu konfirmasi. Silakan siapkan makanan untuk driver.',
            errorTitle: 'Gagal Menerima',
        });
    };

    const handleReject = () => {
        if (!onReject) return;
        showAlert(
            'Tolak Pesanan?',
            'Pesanan akan ditolak dan customer akan diberi tahu. Yakin?',
            [
                { text: 'Batal', style: 'cancel' },
                {
                    text: 'Ya, Tolak',
                    style: 'destructive',
                    onPress: () => {
                        // Delay kecil supaya alert konfirmasi sempat nutup
                        setTimeout(() => {
                            runAction(onReject, {
                                successTitle: 'Pesanan Ditolak',
                                successMessage:
                                    'Pesanan sudah ditolak dan customer akan diberi tahu.',
                                errorTitle: 'Gagal Menolak',
                            });
                        }, 200);
                    },
                },
            ]
        );
    };

    const handleReady = () => {
        if (!onReady) return;
        runAction(onReady, {
            successTitle: 'Pesanan Siap',
            successMessage: order.driver
                ? 'Driver sudah diberi tahu bahwa pesanan siap diambil.'
                : 'Customer sudah diberi tahu bahwa pesanan siap diambil.',
            errorTitle: 'Gagal Menandai',
        });
    };

    // ============================================================
    // ACTIONS ROW (Reusable)
    // ============================================================
    const actions = (acceptLabel: string, compact: boolean) => (
        <View style={styles.actionsRow}>
            <TouchableOpacity
                style={[
                    styles.rejectBtn,
                    compact ? { width: 84 } : { flex: 1 },
                    busy && { opacity: 0.7 },
                ]}
                activeOpacity={0.8}
                onPress={handleReject}
                disabled={busy}
            >
                <Text style={styles.rejectText}>Tolak</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[
                    styles.acceptBtn,
                    compact ? { width: 96 } : { flex: 2 },
                    busy && { opacity: 0.7 },
                ]}
                activeOpacity={0.85}
                onPress={handleAccept}
                disabled={busy}
            >
                <Text style={styles.acceptText}>{acceptLabel}</Text>
            </TouchableOpacity>
        </View>
    );

    // ============================================================
    // COMPACT VARIANT
    // ============================================================
    if (variant === 'compact') {
        const summary = items.length
            ? items.map((i: any) => `${i.qty}x ${i.name}`).join(', ')
            : 'Rincian item belum tersedia';

        return (
            <>
                <View style={styles.card}>
                    <View style={styles.rowBetween}>
                        <Text style={styles.code}>#{order.order_code}</Text>
                        <View
                            style={[
                                styles.chip,
                                { backgroundColor: COLORS.warnBg },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.chipText,
                                    { color: COLORS.warnText },
                                ]}
                            >
                                {timeAgo(order.created_at)}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.summary} numberOfLines={2}>
                        {summary}
                    </Text>
                    <View style={styles.footerRow}>
                        <Text style={styles.totalCompact}>
                            {rupiah(total)}
                        </Text>
                        {waiting ? (
                            actions('Terima', true)
                        ) : (
                            <Text style={styles.meta}>
                                {statusChip(order).label}
                            </Text>
                        )}
                    </View>
                </View>

                <LoadingModal visible={busy} />
                <AlertSheet
                    visible={alertState.visible}
                    title={alertState.title}
                    message={alertState.message}
                    buttons={alertState.buttons}
                    onClose={closeAlert}
                />
            </>
        );
    }

    // ============================================================
    // DETAIL VARIANT
    // ============================================================
    const st = statusChip(order);
    const customer = order.customer?.full_name ?? 'Pelanggan';
    const driver = order.driver as
        | {
            full_name?: string | null;
            phone?: string | null;
            avatar_url?: string | null;
            plate_number?: string | null;
            vehicle_brand?: string | null;
        }
        | null
        | undefined;

    return (
        <>
            <View style={styles.card}>
                <View style={styles.rowBetween}>
                    <View style={{ flex: 1, gap: 2 }}>
                        <Text style={styles.code}>#{order.order_code}</Text>
                        <Text style={styles.meta}>
                            {customer} · {timeAgo(order.created_at)}
                        </Text>
                    </View>
                    <View style={[styles.chip, { backgroundColor: st.bg }]}>
                        <Text style={[styles.chipText, { color: st.fg }]}>
                            {st.label}
                        </Text>
                    </View>
                </View>

                <View style={styles.itemsBox}>
                    {items.length ? (
                        items.map((i: any, idx: number) => (
                            <View
                                key={`${i.menu_item_id}-${idx}`}
                                style={{ gap: 2 }}
                            >
                                <View style={styles.rowBetween}>
                                    <Text
                                        style={styles.itemName}
                                        numberOfLines={2}
                                    >
                                        {i.qty}x {i.name}
                                        {i.variant
                                            ? ` (${i.variant})`
                                            : ''}
                                    </Text>
                                    <Text style={styles.itemPrice}>
                                        {rupiah(i.price * i.qty)}
                                    </Text>
                                </View>
                                {!!i.notes && (
                                    <Text style={styles.itemNote}>
                                        Catatan: {i.notes}
                                    </Text>
                                )}
                            </View>
                        ))
                    ) : (
                        <Text style={styles.meta}>
                            Rincian item belum tersedia.
                        </Text>
                    )}
                    {(order.packaging_fee ?? 0) > 0 && (
                        <View style={styles.rowBetween}>
                            <Text style={styles.itemName}>Kemasan</Text>
                            <Text style={styles.itemPrice}>
                                {rupiah(order.packaging_fee)}
                            </Text>
                        </View>
                    )}
                </View>

                {!!order.notes && (
                    <View style={styles.noteBox}>
                        <Text style={styles.noteText}>
                            Catatan: {order.notes}
                        </Text>
                    </View>
                )}

                {searchingDriver && (
                    <View style={styles.infoRow}>
                        <Ionicons
                            name="search-outline"
                            size={18}
                            color={COLORS.muted}
                        />
                        <Text style={[styles.meta, { flex: 1 }]}>
                            Pesanan diterima
                            {order.prep_minutes
                                ? ` · siap ±${order.prep_minutes} menit`
                                : ''}
                            . Sedang mencari driver.
                        </Text>
                    </View>
                )}

                {!waiting &&
                    !searchingDriver &&
                    !!driver &&
                    order.status !== 'cancelled' && (
                        <View style={styles.driverRow}>
                            {driver.avatar_url ? (
                                <Image
                                    source={{ uri: driver.avatar_url }}
                                    style={styles.driverAvatar}
                                />
                            ) : (
                                <View
                                    style={[
                                        styles.driverAvatar,
                                        styles.driverAvatarEmpty,
                                    ]}
                                >
                                    <Ionicons
                                        name="person"
                                        size={20}
                                        color="#ffffff"
                                    />
                                </View>
                            )}
                            <View style={{ flex: 1 }}>
                                <Text
                                    style={styles.driverName}
                                    numberOfLines={1}
                                >
                                    {driver.full_name ?? 'Driver'}
                                </Text>
                                <Text
                                    style={styles.meta}
                                    numberOfLines={1}
                                >
                                    {[
                                        driver.vehicle_brand,
                                        driver.plate_number,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ') || '-'}
                                </Text>
                            </View>
                            {!!driver.phone &&
                                order.status !== 'completed' && (
                                    <TouchableOpacity
                                        style={styles.callBtn}
                                        activeOpacity={0.85}
                                        onPress={() =>
                                            Linking.openURL(
                                                `tel:${driver.phone}`
                                            )
                                        }
                                        accessibilityLabel="Telepon driver"
                                    >
                                        <Ionicons
                                            name="call"
                                            size={18}
                                            color="#ffffff"
                                        />
                                    </TouchableOpacity>
                                )}
                        </View>
                    )}

                {readyMarked && (
                    <View style={styles.readyDone}>
                        <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color={COLORS.okText}
                        />
                        <Text style={styles.readyDoneText}>
                            Ditandai siap{' '}
                            {timeAgo(order.merchant_ready_at as string)}
                            {order.driver
                                ? ' · driver sudah diberi tahu'
                                : ''}
                        </Text>
                    </View>
                )}

                <View style={styles.rowBetween}>
                    <Text style={styles.meta}>Total</Text>
                    <Text style={styles.totalDetail}>{rupiah(total)}</Text>
                </View>

                {waiting && (
                    <>
                        <Text style={styles.hint}>
                            Segera konfirmasi. Pesanan otomatis ditolak jika
                            tidak direspons dalam 5 menit.
                        </Text>
                        {actions('Terima pesanan', false)}
                    </>
                )}

                {canReady && (
                    <>
                        <Text style={styles.hint}>
                            {order.driver
                                ? 'Tekan kalau pesanan sudah jadi. Driver akan diberi notifikasi.'
                                : 'Tekan kalau pesanan sudah jadi. Pelanggan akan diberi tahu.'}
                        </Text>
                        <TouchableOpacity
                            style={[
                                styles.readyBtn,
                                busy && { opacity: 0.7 },
                            ]}
                            activeOpacity={0.85}
                            onPress={handleReady}
                            disabled={busy}
                        >
                            <Ionicons
                                name="checkmark-done"
                                size={18}
                                color="#ffffff"
                            />
                            <Text style={styles.acceptText}>
                                Pesanan siap diambil
                            </Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>

            <LoadingModal visible={busy} />
            <AlertSheet
                visible={alertState.visible}
                title={alertState.title}
                message={alertState.message}
                buttons={alertState.buttons}
                onClose={closeAlert}
            />
        </>
    );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
    card: {
        gap: 12,
        padding: 16,
        borderRadius: 18,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.line,
    },
    rowBetween: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    code: { fontSize: 15, fontWeight: '800', color: COLORS.ink },
    meta: { fontSize: 13, color: COLORS.muted, lineHeight: 18 },
    hint: {
        fontSize: 12,
        color: COLORS.muted,
        lineHeight: 17,
        marginBottom: -2,
    },
    chip: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 999,
    },
    chipText: { fontSize: 12, fontWeight: '700' },
    summary: {
        fontSize: 13,
        lineHeight: 20,
        color: COLORS.muted,
        marginTop: -2,
    },

    footerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    totalCompact: {
        flex: 1,
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.ink,
    },
    actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

    rejectBtn: {
        height: 44,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: COLORS.danger,
        backgroundColor: COLORS.white,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rejectText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.danger,
    },
    acceptBtn: {
        height: 44,
        borderRadius: 999,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    acceptText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#ffffff',
    },
    readyBtn: {
        height: 46,
        borderRadius: 999,
        backgroundColor: COLORS.primary,
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },

    itemsBox: {
        gap: 8,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: COLORS.line,
    },
    itemName: { flex: 1, fontSize: 14, color: COLORS.ink },
    itemPrice: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
    itemNote: { fontSize: 12, color: COLORS.muted },
    noteBox: {
        padding: 10,
        borderRadius: 12,
        backgroundColor: COLORS.warnBg,
    },
    noteText: {
        fontSize: 13,
        lineHeight: 18,
        color: COLORS.warnText,
    },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },

    driverRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    driverAvatar: { width: 40, height: 40, borderRadius: 20 },
    driverAvatarEmpty: {
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    driverName: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
    callBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },

    readyDone: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 10,
        borderRadius: 12,
        backgroundColor: COLORS.okBg,
    },
    readyDoneText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.okText,
    },
    totalDetail: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.ink,
    },
});