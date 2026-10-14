// components/OrderCard.tsx
// Kartu pesanan: 'compact' (di Beranda) dan 'detail' (di tab Pesanan).
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { OrderResponse } from '../lib/api';
import { rupiah, timeAgo } from '../lib/format';
import { COLORS } from '../lib/theme';

const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
    pending: { label: 'Baru', bg: COLORS.primaryTint, fg: COLORS.primary },
    accepted: { label: 'Diterima', bg: COLORS.primaryTint, fg: COLORS.primary },
    arrived: { label: 'Driver tiba', bg: COLORS.warnBg, fg: COLORS.warnText },
    in_progress: { label: 'Diantar', bg: COLORS.warnBg, fg: COLORS.warnText },
    completed: { label: 'Selesai', bg: COLORS.okBg, fg: COLORS.okText },
    cancelled: { label: 'Dibatalkan', bg: '#fdecec', fg: COLORS.danger },
};

type Props = {
    order: OrderResponse;
    variant: 'compact' | 'detail';
    busy?: boolean;
    onAccept?: () => void;
    onReject?: () => void;
};

export default function OrderCard({ order, variant, busy, onAccept, onReject }: Props) {
    const total = (order.subtotal ?? 0) + (order.packaging_fee ?? 0);
    const items = order.items ?? [];
    const isNew = order.status === 'pending';

    const actions = (acceptLabel: string, compact: boolean) => (
        <View style={styles.actionsRow}>
            <TouchableOpacity
                style={[styles.rejectBtn, compact ? { width: 84 } : { flex: 1 }]}
                activeOpacity={0.8}
                onPress={onReject}
                disabled={busy}
            >
                <Text style={styles.rejectText}>Tolak</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.acceptBtn, compact ? { width: 96 } : { flex: 2 }, busy && { opacity: 0.7 }]}
                activeOpacity={0.85}
                onPress={onAccept}
                disabled={busy}
            >
                {busy ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                    <Text style={styles.acceptText}>{acceptLabel}</Text>
                )}
            </TouchableOpacity>
        </View>
    );

    // ───────────────── COMPACT ─────────────────
    if (variant === 'compact') {
        const summary = items.length
            ? items.map((i) => `${i.qty}x ${i.name}`).join(', ')
            : 'Rincian item belum tersedia';

        return (
            <View style={styles.card}>
                <View style={styles.rowBetween}>
                    <Text style={styles.code}>#{order.order_code}</Text>
                    <View style={[styles.chip, { backgroundColor: COLORS.warnBg }]}>
                        <Text style={[styles.chipText, { color: COLORS.warnText }]}>
                            {timeAgo(order.created_at)}
                        </Text>
                    </View>
                </View>
                <Text style={styles.summary} numberOfLines={2}>
                    {summary}
                </Text>
                <View style={styles.footerRow}>
                    <Text style={styles.totalCompact}>{rupiah(total)}</Text>
                    {actions('Terima', true)}
                </View>
            </View>
        );
    }

    // ───────────────── DETAIL ─────────────────
    const st = STATUS[order.status] ?? STATUS.pending;
    const customer = order.customer?.full_name ?? 'Pelanggan';

    return (
        <View style={styles.card}>
            <View style={styles.rowBetween}>
                <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.code}>#{order.order_code}</Text>
                    <Text style={styles.meta}>
                        {customer} · {timeAgo(order.created_at)}
                    </Text>
                </View>
                <View style={[styles.chip, { backgroundColor: st.bg }]}>
                    <Text style={[styles.chipText, { color: st.fg }]}>{st.label}</Text>
                </View>
            </View>

            <View style={styles.itemsBox}>
                {items.length ? (
                    items.map((i, idx) => (
                        <View key={`${i.menu_item_id}-${idx}`} style={styles.rowBetween}>
                            <Text style={styles.itemName} numberOfLines={2}>
                                {i.qty}x {i.name}
                                {i.variant ? ` (${i.variant})` : ''}
                            </Text>
                            <Text style={styles.itemPrice}>{rupiah(i.price * i.qty)}</Text>
                        </View>
                    ))
                ) : (
                    <Text style={styles.meta}>Rincian item belum tersedia.</Text>
                )}
                {(order.packaging_fee ?? 0) > 0 && (
                    <View style={styles.rowBetween}>
                        <Text style={styles.itemName}>Kemasan</Text>
                        <Text style={styles.itemPrice}>{rupiah(order.packaging_fee)}</Text>
                    </View>
                )}
            </View>

            {!!order.notes && (
                <View style={styles.noteBox}>
                    <Text style={styles.noteText}>Catatan: {order.notes}</Text>
                </View>
            )}

            {!isNew && !!order.driver && order.status !== 'cancelled' && (
                <View style={styles.driverRow}>
                    <Ionicons name="bicycle-outline" size={18} color={COLORS.muted} />
                    <Text style={styles.meta}>
                        Driver: {order.driver.full_name ?? '-'}
                        {order.driver.plate_number ? ` · ${order.driver.plate_number}` : ''}
                    </Text>
                </View>
            )}

            <View style={styles.rowBetween}>
                <Text style={styles.meta}>Total</Text>
                <Text style={styles.totalDetail}>{rupiah(total)}</Text>
            </View>

            {isNew && actions('Terima pesanan', false)}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        gap: 12,
        padding: 16,
        borderRadius: 18,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.line,
    },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    code: { fontSize: 15, fontWeight: '800', color: COLORS.ink },
    meta: { fontSize: 13, color: COLORS.muted, lineHeight: 18 },
    chip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999 },
    chipText: { fontSize: 12, fontWeight: '700' },
    summary: { fontSize: 13, lineHeight: 20, color: COLORS.muted, marginTop: -2 },

    footerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    totalCompact: { flex: 1, fontSize: 16, fontWeight: '800', color: COLORS.ink },
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
    rejectText: { fontSize: 14, fontWeight: '700', color: COLORS.danger },
    acceptBtn: {
        height: 44,
        borderRadius: 999,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    acceptText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },

    itemsBox: {
        gap: 8,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: COLORS.line,
    },
    itemName: { flex: 1, fontSize: 14, color: COLORS.ink },
    itemPrice: { fontSize: 14, fontWeight: '600', color: COLORS.ink },
    noteBox: { padding: 10, borderRadius: 12, backgroundColor: COLORS.warnBg },
    noteText: { fontSize: 13, lineHeight: 18, color: COLORS.warnText },
    driverRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    totalDetail: { fontSize: 18, fontWeight: '800', color: COLORS.ink },
});