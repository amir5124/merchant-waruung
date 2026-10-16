// components/DebtBanner.tsx
// Banner utang komisi + bottom sheet rincian
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { rupiah } from '../lib/format';
import { COLORS } from '../lib/theme';

const DANGER = '#e24c4c';
const DANGER_SOFT = '#FDEAEA';

export type DebtEntry = {
    id: string | number;
    note: string; // mis. "Komisi order #182 (12.0%)"
    amount: number; // nilai komisi (positif)
    at: string; // ISO
};

type Props = {
    debt: number;
    limit: number;
    canAcceptCash: boolean;
    entries: DebtEntry[];
    onTopUp: () => void;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function DebtBanner({ debt, limit, canAcceptCash, entries, onTopUp }: Props) {
    const [open, setOpen] = useState(false);
    const insets = useSafeAreaInsets();

    if (debt <= 0) return null;

    const pct = limit > 0 ? Math.min(debt / limit, 1) : 0;
    const remaining = Math.max(limit - debt, 0);

    return (
        <>
            <Pressable style={s.banner} onPress={() => setOpen(true)} accessibilityLabel="Rincian utang komisi">
                <Ionicons name="alert-circle" size={18} color={DANGER} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                    <Text style={s.title}>Utang komisi {rupiah(debt)}</Text>
                    <Text style={s.desc}>
                        {canAcceptCash
                            ? 'Top up saldo untuk melunasi. Penarikan saldo ditahan sampai lunas.'
                            : 'Pesanan tunai dihentikan sementara. Top up untuk melunasi utang dan menerima pesanan tunai lagi.'}
                    </Text>
                    <Text style={s.link}>Lihat rincian</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={DANGER} style={{ marginTop: 1 }} />
            </Pressable>

            <Modal
                visible={open}
                transparent
                animationType="slide"
                onRequestClose={() => setOpen(false)}
                statusBarTranslucent
            >
                <View style={s.overlay}>
                    <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} />
                    <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
                        <View style={s.handle} />
                        <Text style={s.sheetTitle}>Rincian utang komisi</Text>

                        <View style={s.sumBox}>
                            <Text style={s.sumLabel}>Total utang</Text>
                            <Text style={s.sumValue}>{rupiah(debt)}</Text>

                            {limit > 0 && (
                                <>
                                    <View style={s.barBg}>
                                        <View
                                            style={[
                                                s.barFill,
                                                { width: `${Math.round(pct * 100)}%` },
                                            ]}
                                        />
                                    </View>
                                    <Text style={s.barText}>
                                        {canAcceptCash
                                            ? `Batas ${rupiah(limit)} · sisa ${rupiah(remaining)} sebelum pesanan tunai dihentikan`
                                            : `Sudah mencapai batas ${rupiah(limit)}`}
                                    </Text>
                                </>
                            )}
                        </View>

                        <Text style={s.listTitle}>Komisi pesanan tunai</Text>
                        <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
                            {entries.length === 0 ? (
                                <Text style={s.empty}>
                                    Rincian per pesanan belum tersedia. Buka tab Transaksi saldo untuk melihat riwayat.
                                </Text>
                            ) : (
                                entries.map((e, i) => (
                                    <View
                                        key={String(e.id)}
                                        style={[s.row, i > 0 && s.rowBorder]}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.rowTitle} numberOfLines={2}>
                                                {e.note || 'Komisi pesanan'}
                                            </Text>
                                            <Text style={s.rowSub}>{fmt(e.at)}</Text>
                                        </View>
                                        <Text style={s.rowAmount}>{rupiah(e.amount)}</Text>
                                    </View>
                                ))
                            )}
                        </ScrollView>

                        <Text style={s.note}>
                            Pada pesanan tunai, uang sudah kamu terima langsung. Komisi platform dipotong dari saldo
                            toko, dan kekurangannya dicatat sebagai utang. Utang dilunasi otomatis dari top up atau
                            pendapatan pesanan online berikutnya.
                        </Text>

                        <Pressable
                            style={s.btn}
                            onPress={() => {
                                setOpen(false);
                                onTopUp();
                            }}
                        >
                            <Text style={s.btnText}>Top up untuk melunasi</Text>
                        </Pressable>
                        <Pressable style={s.btnGhost} onPress={() => setOpen(false)}>
                            <Text style={s.btnGhostText}>Tutup</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const s = StyleSheet.create({
    banner: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
        padding: 12,
        borderRadius: 14,
        backgroundColor: DANGER_SOFT,
    },
    title: { fontSize: 14, fontWeight: '800', color: DANGER },
    desc: { marginTop: 2, fontSize: 12, lineHeight: 18, color: DANGER },
    link: { marginTop: 6, fontSize: 12, fontWeight: '800', color: DANGER, textDecorationLine: 'underline' },

    overlay: { flex: 1, backgroundColor: 'rgba(17,24,39,0.5)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    handle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.line,
        marginBottom: 14,
    },
    sheetTitle: { fontSize: 18, fontWeight: '800', color: COLORS.ink, marginBottom: 14 },

    sumBox: { padding: 14, borderRadius: 14, backgroundColor: DANGER_SOFT },
    sumLabel: { fontSize: 12, fontWeight: '700', color: DANGER },
    sumValue: { fontSize: 26, fontWeight: '900', color: DANGER, marginTop: 2 },
    barBg: {
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(226,76,76,0.18)',
        marginTop: 12,
        overflow: 'hidden',
    },
    barFill: { height: 8, borderRadius: 4, backgroundColor: DANGER },
    barText: { fontSize: 12, color: DANGER, marginTop: 8, lineHeight: 17 },

    listTitle: { fontSize: 14, fontWeight: '800', color: COLORS.ink, marginTop: 18, marginBottom: 6 },
    empty: { fontSize: 13, color: COLORS.muted, lineHeight: 19, paddingVertical: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line },
    rowTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
    rowSub: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
    rowAmount: { fontSize: 14, fontWeight: '800', color: DANGER },

    note: { fontSize: 12, lineHeight: 18, color: COLORS.muted, marginTop: 14 },

    btn: {
        height: 50,
        borderRadius: 25,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
    },
    btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    btnGhost: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    btnGhostText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
});