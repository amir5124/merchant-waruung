// app/(tabs)/pendapatan.tsx — Pendapatan & saldo merchant
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertSheet, useAlertSheet } from '../../components/FeedbackModals';
import { useOrders } from '../../hooks/useOrders';
import { api } from '../../lib/api';
import { rupiah } from '../../lib/format';
import { COLORS } from '../../lib/theme';

const SECONDARY = '#e68515';
const SECONDARY_SOFT = '#FDF1E2';
const DANGER = '#e24c4c';
const DANGER_SOFT = '#FDEAEA';

const PAGE_SIZE = 30;

// ============================================================
// ADAPTER DATA — sesuaikan di sini kalau nama field backend berbeda
// ============================================================

const num = (v: any) => Number(v) || 0;

// ── Pendapatan dari pesanan ──
// Status order yang dianggap sudah selesai (huruf kecil)
const COMPLETED_STATUSES = new Set(['completed', 'selesai', 'done', 'delivered']);

type PayMethod = 'cash' | 'online' | null;

type Earning = {
    id: string | number;
    code: string;
    at: string; // ISO
    gross: number; // nilai penjualan (subtotal makanan)
    commission: number; // komisi platform untuk MERCHANT
    net: number; // yang diterima toko
    method: PayMethod; // tunai (uang di tangan toko) / online (masuk saldo)
};

function toEarning(o: any): Earning | null {
    if (!COMPLETED_STATUSES.has(String(o?.status ?? '').toLowerCase())) return null;
    // Halaman ini hanya untuk pesanan makanan (komisi merchant hanya berlaku di food)
    if (o?.type && String(o.type).toLowerCase() !== 'food') return null;

    const at = o.completed_at ?? o.updated_at ?? o.created_at;
    if (!at) return null;

    const gross = num(o.subtotal ?? o.food_total ?? o.total_price ?? o.total_amount ?? o.total);

    // PENTING: jangan pakai o.commission_amount — itu komisi DRIVER.
    // Komisi merchant disimpan di merchant_commission_amount (diisi saat settle).
    let commission = 0;
    if (o.merchant_commission_amount != null) {
        commission = num(o.merchant_commission_amount);
    } else if (o.merchant_commission != null) {
        commission = num(o.merchant_commission);
    } else if (o.merchant_earning != null && gross > 0 && num(o.merchant_earning) <= gross) {
        commission = gross - num(o.merchant_earning);
    }

    const net =
        o.merchant_earning != null ? num(o.merchant_earning) : Math.max(gross - commission, 0);

    const pm = String(o.payment_method ?? '').toLowerCase();
    const method: PayMethod = !pm ? null : pm === 'cash' ? 'cash' : 'online';

    return { id: o.id, code: String(o.order_code ?? o.id), at, gross, commission, net, method };
}

// ── Saldo toko ──
type Wallet = {
    balance: number; // saldo yang bisa ditarik
    pending: number; // penarikan yang sedang diproses
    cashDebt: number; // utang komisi order tunai
    debtLimit: number; // batas utang, lewat ini order tunai dihentikan
    canAcceptCash: boolean;
};

// Bentuk respons GET /api/wallet untuk role merchant (lihat merchant-wallet.service.ts)
type MerchantWalletResponse = {
    balance: number;
    cash_debt: number;
    net_balance: number;
    pending_payout: number;
    debt_limit: number;
    can_accept_cash_orders: boolean;
};

async function fetchWallet(): Promise<Wallet> {
    const w = (await api.wallet.get()) as unknown as MerchantWalletResponse;
    return {
        balance: num(w?.balance),
        pending: num(w?.pending_payout),
        cashDebt: num(w?.cash_debt),
        debtLimit: num(w?.debt_limit),
        canAcceptCash: w?.can_accept_cash_orders !== false,
    };
}

// ── Riwayat transaksi saldo (top up, tarik, komisi, pelunasan utang) ──
type TxKind = 'topup' | 'withdraw' | 'commission' | 'debt' | 'earning' | 'other';
type TxStatus = 'success' | 'pending' | 'failed';

type WalletTx = {
    id: string | number;
    kind: TxKind;
    status: TxStatus;
    amount: number; // bertanda: + masuk, − keluar
    at: string; // ISO
    note: string;
};

const SUCCESS_STATUSES = new Set(['success', 'paid', 'completed', 'settled', 'done', 'berhasil']);
const FAILED_STATUSES = new Set(['failed', 'expired', 'cancelled', 'canceled', 'rejected', 'gagal']);

function toWalletTx(t: any): WalletTx | null {
    const at = t?.created_at ?? t?.completed_at ?? t?.updated_at;
    if (!at) return null;

    // type dari backend = entry_type ledger merchant:
    // topup | withdraw | commission_cash | earning_gateway | debt_payment | adjustment
    const rawType = String(t.type ?? t.kind ?? t.transaction_type ?? '').toLowerCase();
    const kind: TxKind = /top.?up|deposit/.test(rawType)
        ? 'topup'
        : /withdraw|tarik|payout/.test(rawType)
            ? 'withdraw'
            : /commission|komisi/.test(rawType)
                ? 'commission'
                : /debt|utang/.test(rawType)
                    ? 'debt'
                    : /earning|pendapatan/.test(rawType)
                        ? 'earning'
                        : 'other';

    const rawStatus = String(t.status ?? '').toLowerCase();
    const status: TxStatus = SUCCESS_STATUSES.has(rawStatus)
        ? 'success'
        : FAILED_STATUSES.has(rawStatus)
            ? 'failed'
            : 'pending';

    const abs = Math.abs(num(t.amount));
    const amount =
        kind === 'withdraw' ? -abs : kind === 'topup' ? abs : num(t.amount); // lainnya: ikut tanda dari backend

    return {
        id: t.id ?? `${rawType}-${at}`,
        kind,
        status,
        amount,
        at,
        note: String(t.description ?? t.note ?? ''),
    };
}

// Memakai api.wallet.ledger(limit, offset) → array riwayat saldo.
async function fetchWalletTx(limit: number, offset: number): Promise<WalletTx[]> {
    const r: any = await api.wallet.ledger(limit, offset);
    const list: any[] = Array.isArray(r) ? r : (r?.data ?? []);
    return list.map(toWalletTx).filter((x): x is WalletTx => x !== null);
}

// ============================================================
// HELPERS WAKTU
// ============================================================
type Period = 'day' | 'week';
type HistoryTab = 'pendapatan' | 'saldo';

const PERIOD_TABS: { key: Period; label: string }[] = [
    { key: 'day', label: 'Harian' },
    { key: 'week', label: 'Mingguan' },
];

const HISTORY_TABS: { key: HistoryTab; label: string }[] = [
    { key: 'pendapatan', label: 'Pendapatan' },
    { key: 'saldo', label: 'Transaksi saldo' },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const pad = (n: number) => String(n).padStart(2, '0');

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfWeek = (d: Date) => {
    const diff = d.getDay() === 0 ? 6 : d.getDay() - 1; // minggu dimulai Senin
    const s = startOfDay(d);
    s.setDate(s.getDate() - diff);
    return s;
};
const inPeriod = (iso: string, period: Period) => {
    const from = period === 'day' ? startOfDay(new Date()) : startOfWeek(new Date());
    return new Date(iso).getTime() >= from.getTime();
};
const formatTime = (iso: string) => {
    const d = new Date(iso);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const dayLabel = (iso: string) => {
    const d = startOfDay(new Date(iso));
    const diff = Math.round((startOfDay(new Date()).getTime() - d.getTime()) / 86400000);
    if (diff === 0) return 'Hari ini';
    if (diff === 1) return 'Kemarin';
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

function groupByDay<T extends { at: string }>(items: T[]) {
    const map = new Map<string, T[]>();
    items.forEach((it) => {
        const label = dayLabel(it.at);
        if (!map.has(label)) map.set(label, []);
        map.get(label)!.push(it);
    });
    return Array.from(map.entries()).map(([label, list]) => ({ label, items: list }));
}

const TX_META: Record<TxKind, { icon: React.ComponentProps<typeof Ionicons>['name']; title: string }> = {
    topup: { icon: 'add-circle-outline', title: 'Top up saldo' },
    withdraw: { icon: 'arrow-down-circle-outline', title: 'Tarik ke bank' },
    commission: { icon: 'remove-circle-outline', title: 'Komisi pesanan' },
    debt: { icon: 'card-outline', title: 'Pelunasan utang komisi' },
    earning: { icon: 'receipt-outline', title: 'Pendapatan pesanan' },
    other: { icon: 'swap-horizontal-outline', title: 'Transaksi saldo' },
};

// Jenis transaksi yang judulnya lebih informatif kalau pakai keterangan dari backend
// (mis. "Komisi order #123 (12.0%)")
const USE_NOTE_AS_TITLE = new Set<TxKind>(['other', 'commission', 'earning', 'debt']);

const STATUS_META: Record<TxStatus, { label: string; bg: string; fg: string }> = {
    success: { label: 'Berhasil', bg: COLORS.okBg, fg: COLORS.okText },
    pending: { label: 'Menunggu', bg: COLORS.warnBg, fg: COLORS.warnText },
    failed: { label: 'Gagal', bg: DANGER_SOFT, fg: DANGER },
};

// ============================================================
// SCREEN
// ============================================================
export default function PendapatanScreen() {
    const orders = useOrders();
    const alert = useAlertSheet();
    const scrollRef = useRef<ScrollView>(null);
    const riwayatY = useRef(0);

    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [walletLoading, setWalletLoading] = useState(true);
    const [txs, setTxs] = useState<WalletTx[] | null>(null); // null = gagal dimuat
    const [txHasMore, setTxHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [period, setPeriod] = useState<Period>('day');
    const [filterPeriod, setFilterPeriod] = useState<Period | null>(null);
    const [historyTab, setHistoryTab] = useState<HistoryTab>('pendapatan');

    const loadWallet = useCallback(async () => {
        const [w, t] = await Promise.allSettled([fetchWallet(), fetchWalletTx(PAGE_SIZE, 0)]);

        if (w.status === 'fulfilled') {
            setWallet(w.value);
        } else {
            console.warn('[PENDAPATAN] Gagal memuat saldo:', (w.reason as any)?.message);
            setWallet(null);
        }

        if (t.status === 'fulfilled') {
            setTxs(t.value);
            setTxHasMore(t.value.length === PAGE_SIZE);
        } else {
            console.warn('[PENDAPATAN] Gagal memuat transaksi saldo:', (t.reason as any)?.message);
        }

        setWalletLoading(false);
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadWallet();
        }, [loadWallet])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([loadWallet(), orders.refresh()]);
        setRefreshing(false);
    };

    const loadMoreTx = async () => {
        if (loadingMore || !txHasMore || !txs) return;
        setLoadingMore(true);
        try {
            const next = await fetchWalletTx(PAGE_SIZE, txs.length);
            setTxs((prev) => {
                const ids = new Set((prev ?? []).map((x) => String(x.id)));
                return [...(prev ?? []), ...next.filter((x) => !ids.has(String(x.id)))];
            });
            setTxHasMore(next.length === PAGE_SIZE);
        } catch (e: any) {
            console.warn('[PENDAPATAN] Gagal memuat transaksi lagi:', e?.message);
        } finally {
            setLoadingMore(false);
        }
    };

    // ── Data turunan: pendapatan ──
    const earnings = useMemo(
        () =>
            (orders.orders ?? [])
                .map(toEarning)
                .filter((e: Earning | null): e is Earning => e !== null)
                .sort((a: Earning, b: Earning) => new Date(b.at).getTime() - new Date(a.at).getTime()),
        [orders.orders]
    );

    const stats = useMemo(() => {
        const list = earnings.filter((e) => inPeriod(e.at, period));
        const cash = list.filter((e) => e.method === 'cash');
        const online = list.filter((e) => e.method === 'online');
        return {
            count: list.length,
            gross: list.reduce((s, e) => s + e.gross, 0),
            commission: list.reduce((s, e) => s + e.commission, 0),
            net: list.reduce((s, e) => s + e.net, 0),
            cashGross: cash.reduce((s, e) => s + e.gross, 0), // uang tunai yang sudah di tangan toko
            onlineNet: online.reduce((s, e) => s + e.net, 0), // yang masuk ke saldo toko
        };
    }, [earnings, period]);

    const earningSections = useMemo(
        () =>
            groupByDay(
                filterPeriod ? earnings.filter((e) => inPeriod(e.at, filterPeriod)) : earnings
            ),
        [earnings, filterPeriod]
    );

    const txSections = useMemo(() => groupByDay(txs ?? []), [txs]);

    // ── Handlers ──
    const scrollToRiwayat = () =>
        scrollRef.current?.scrollTo({ y: Math.max(riwayatY.current - 12, 0), animated: true });

    const handleLihatDetail = () => {
        setHistoryTab('pendapatan');
        setFilterPeriod(period);
        setTimeout(scrollToRiwayat, 50);
    };

    const showInfo = () =>
        alert.show(
            period === 'day' ? 'Pendapatan hari ini' : 'Pendapatan minggu ini',
            'Total yang diterima tokomu dari pesanan makanan yang sudah selesai pada periode ini, setelah dipotong komisi platform. ' +
            'Pesanan tunai: uang sudah kamu terima langsung, komisinya dipotong dari saldo toko atau dicatat sebagai utang. ' +
            'Pesanan online: pendapatan bersih masuk ke saldo toko.'
        );

    const showDebtInfo = () =>
        alert.show(
            'Utang komisi',
            'Untuk pesanan tunai, uang diterima langsung oleh tokomu sehingga komisi platform ditagih dari saldo toko. ' +
            'Kalau saldo tidak cukup, komisi dicatat sebagai utang dan dilunasi otomatis dari top up atau pendapatan online berikutnya. ' +
            (wallet && wallet.debtLimit > 0
                ? `Jika utang mencapai ${rupiah(wallet.debtLimit)}, toko tidak bisa menerima pesanan tunai baru sampai dilunasi.`
                : '')
        );

    const handleTopUp = () => {
        if (!wallet) {
            alert.show('Segera Hadir', 'Top up saldo toko belum tersedia.');
            return;
        }
        router.push('/topup' as any);
    };

    const handleWithdraw = () => {
        if (!wallet) {
            alert.show('Segera Hadir', 'Penarikan saldo toko belum tersedia.');
            return;
        }
        if (wallet.cashDebt > 0) {
            alert.show(
                'Ada Utang Komisi',
                `Lunasi utang komisi ${rupiah(wallet.cashDebt)} lebih dulu lewat top up sebelum menarik saldo.`
            );
            return;
        }
        if (wallet.balance <= 0) {
            alert.show('Saldo Kosong', 'Belum ada saldo toko yang bisa ditarik.');
            return;
        }
        router.push('/tarik' as any);
    };

    // ── Render: item ──
    const renderEarning = (e: Earning) => (
        <View key={String(e.id)} style={s.itemCard}>
            <View style={s.itemIcon}>
                <Ionicons name="receipt-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={s.itemTitle} numberOfLines={1}>
                    Pesanan #{e.code}
                </Text>
                <Text style={s.itemSub}>
                    {formatTime(e.at)}
                    {e.method ? ` · ${e.method === 'cash' ? 'Tunai' : 'Online'}` : ''}
                </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.itemAmount}>+{rupiah(e.net)}</Text>
                {e.commission > 0 && (
                    <Text style={s.itemCommission}>komisi -{rupiah(e.commission)}</Text>
                )}
            </View>
        </View>
    );

    const renderTx = (t: WalletTx) => {
        const meta = TX_META[t.kind];
        const st = STATUS_META[t.status];
        const positive = t.amount >= 0;
        const orange = t.kind === 'withdraw' || t.kind === 'commission';
        const red = t.kind === 'debt';
        return (
            <View key={String(t.id)} style={s.itemCard}>
                <View
                    style={[
                        s.itemIcon,
                        {
                            backgroundColor: red
                                ? DANGER_SOFT
                                : orange
                                    ? SECONDARY_SOFT
                                    : COLORS.primaryTint,
                        },
                    ]}
                >
                    <Ionicons
                        name={meta.icon}
                        size={24}
                        color={red ? DANGER : orange ? SECONDARY : COLORS.primary}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={s.itemTitle} numberOfLines={2}>
                        {USE_NOTE_AS_TITLE.has(t.kind) && t.note ? t.note : meta.title}
                    </Text>
                    <View style={s.txMetaRow}>
                        <Text style={s.itemSub}>{formatTime(t.at)}</Text>
                        <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                            <Text style={[s.statusBadgeText, { color: st.fg }]}>{st.label}</Text>
                        </View>
                    </View>
                </View>
                <Text
                    style={[
                        s.txAmount,
                        positive ? { color: COLORS.primary } : { color: COLORS.ink },
                        t.kind === 'commission' && { color: DANGER },
                        t.status === 'failed' && { color: COLORS.muted, textDecorationLine: 'line-through' },
                    ]}
                >
                    {positive ? '+' : '-'}
                    {rupiah(Math.abs(t.amount))}
                </Text>
            </View>
        );
    };

    const emptyBox = (title: string, desc: string) => (
        <View style={s.emptyWrap}>
            <View style={s.emptyIcon}>
                <Ionicons name="receipt-outline" size={36} color={COLORS.muted} />
            </View>
            <Text style={s.emptyTitle}>{title}</Text>
            <Text style={s.emptyDesc}>{desc}</Text>
        </View>
    );

    // ── Render ──
    return (
        <SafeAreaView edges={['top']} style={s.container}>
            <ScrollView
                ref={scrollRef}
                contentContainerStyle={s.scroll}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[COLORS.primary]}
                        tintColor={COLORS.primary}
                    />
                }
            >
                <Text style={s.pageTitle}>Pendapatan</Text>

                {/* ── Ringkasan ── */}
                <View style={s.summaryCard}>
                    <View style={s.periodRow}>
                        {PERIOD_TABS.map((t) => {
                            const active = period === t.key;
                            return (
                                <Pressable
                                    key={t.key}
                                    style={[s.periodTab, active && s.periodTabActive]}
                                    onPress={() => setPeriod(t.key)}
                                >
                                    <Text style={[s.periodText, active && s.periodTextActive]}>
                                        {t.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    <View style={s.summaryBody}>
                        <View style={s.labelRow}>
                            <Text style={s.summaryLabel}>
                                {period === 'day' ? 'Hari ini' : 'Minggu ini'}
                            </Text>
                            <Pressable onPress={showInfo} hitSlop={8} accessibilityLabel="Info pendapatan">
                                <Ionicons name="information-circle" size={16} color={COLORS.muted} />
                            </Pressable>
                        </View>

                        <View style={s.summaryRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.summaryAmount}>{rupiah(stats.net)}</Text>
                                <Text style={s.summaryTrips}>{stats.count} pesanan selesai</Text>
                            </View>
                            <Pressable
                                style={({ pressed }) => [s.detailBtn, pressed && { opacity: 0.85 }]}
                                onPress={handleLihatDetail}
                            >
                                <Text style={s.detailBtnText}>Lihat detail</Text>
                            </Pressable>
                        </View>

                        <View style={s.breakdown}>
                            <View style={s.breakRow}>
                                <Text style={s.breakLabel}>Penjualan</Text>
                                <Text style={s.breakValue}>{rupiah(stats.gross)}</Text>
                            </View>
                            {stats.commission > 0 && (
                                <View style={s.breakRow}>
                                    <Text style={s.breakLabel}>Komisi platform</Text>
                                    <Text style={[s.breakValue, { color: DANGER }]}>
                                        -{rupiah(stats.commission)}
                                    </Text>
                                </View>
                            )}
                            {stats.cashGross > 0 && (
                                <View style={s.breakRow}>
                                    <Text style={s.breakLabel}>Tunai (diterima di toko)</Text>
                                    <Text style={s.breakValue}>{rupiah(stats.cashGross)}</Text>
                                </View>
                            )}
                            {stats.onlineNet > 0 && (
                                <View style={s.breakRow}>
                                    <Text style={s.breakLabel}>Online (masuk saldo)</Text>
                                    <Text style={s.breakValue}>{rupiah(stats.onlineNet)}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                {/* ── Saldo toko ── */}
                <View style={s.walletCard}>
                    <View style={s.walletTop}>
                        <View style={s.walletCol}>
                            <Text style={s.walletLabel}>Saldo toko</Text>
                            <View style={s.walletValueRow}>
                                <View style={s.walletIcon}>
                                    <Ionicons name="wallet" size={14} color="#fff" />
                                </View>
                                <Text style={s.walletValue}>{rupiah(wallet?.balance ?? 0)}</Text>
                            </View>
                        </View>
                        <View style={s.walletCol}>
                            <Text style={s.walletLabel}>Menunggu</Text>
                            <Text style={s.walletValue}>{rupiah(wallet?.pending ?? 0)}</Text>
                        </View>
                    </View>

                    {walletLoading && (
                        <ActivityIndicator
                            size="small"
                            color={COLORS.primary}
                            style={{ marginTop: 12 }}
                        />
                    )}

                    {!walletLoading && !wallet && (
                        <Text style={s.walletNote}>
                            Data saldo toko belum bisa dimuat. Tarik ke bawah untuk coba lagi.
                        </Text>
                    )}

                    {!!wallet && wallet.cashDebt > 0 && (
                        <Pressable style={s.debtBanner} onPress={showDebtInfo}>
                            <Ionicons
                                name="alert-circle"
                                size={18}
                                color={DANGER}
                                style={{ marginTop: 1 }}
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={s.debtTitle}>
                                    Utang komisi {rupiah(wallet.cashDebt)}
                                </Text>
                                <Text style={s.debtDesc}>
                                    {wallet.canAcceptCash
                                        ? 'Top up saldo untuk melunasi. Penarikan saldo ditahan sampai lunas.'
                                        : 'Pesanan tunai dihentikan sementara. Top up untuk melunasi utang dan menerima pesanan tunai lagi.'}
                                </Text>
                            </View>
                        </Pressable>
                    )}
                </View>

                {/* ── Card Top up & Tarik ── */}
                <View style={s.actionCards}>
                    <Pressable
                        style={({ pressed }) => [s.actionCard, pressed && { opacity: 0.85 }]}
                        onPress={handleTopUp}
                        accessibilityLabel="Top up saldo"
                    >
                        <View style={[s.actionCardIcon, { backgroundColor: COLORS.primaryTint }]}>
                            <Ionicons name="add" size={24} color={COLORS.primary} />
                        </View>
                        <Text style={s.actionCardTitle}>Top up</Text>
                        <Text style={s.actionCardDesc}>
                            {wallet && wallet.cashDebt > 0
                                ? 'Lunasi utang komisi'
                                : 'Tambah saldo toko'}
                        </Text>
                    </Pressable>

                    <Pressable
                        style={({ pressed }) => [s.actionCard, pressed && { opacity: 0.85 }]}
                        onPress={handleWithdraw}
                        accessibilityLabel="Tarik saldo ke bank"
                    >
                        <View style={[s.actionCardIcon, { backgroundColor: SECONDARY_SOFT }]}>
                            <Ionicons name="arrow-down" size={22} color={SECONDARY} />
                        </View>
                        <Text style={s.actionCardTitle}>Tarik</Text>
                        <Text style={s.actionCardDesc}>
                            {wallet && wallet.cashDebt > 0
                                ? 'Tersedia setelah utang lunas'
                                : 'Cairkan ke rekening bank'}
                        </Text>
                    </Pressable>
                </View>

                {/* ── Riwayat ── */}
                <View
                    onLayout={(e) => {
                        riwayatY.current = e.nativeEvent.layout.y;
                    }}
                    style={s.riwayatWrap}
                >
                    <View style={s.riwayatHeader}>
                        <View style={s.accentBar} />
                        <Text style={s.riwayatTitle}>Riwayat</Text>
                    </View>

                    <View style={s.segment}>
                        {HISTORY_TABS.map((t) => {
                            const active = historyTab === t.key;
                            return (
                                <Pressable
                                    key={t.key}
                                    style={[s.segmentItem, active && s.segmentItemActive]}
                                    onPress={() => setHistoryTab(t.key)}
                                >
                                    <Text style={[s.segmentText, active && s.segmentTextActive]}>
                                        {t.label}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    {historyTab === 'pendapatan' ? (
                        <>
                            {!!filterPeriod && (
                                <Pressable style={s.filterChip} onPress={() => setFilterPeriod(null)}>
                                    <Text style={s.filterChipText}>
                                        {filterPeriod === 'day' ? 'Hari ini' : 'Minggu ini'}
                                    </Text>
                                    <Ionicons name="close" size={16} color={SECONDARY} />
                                </Pressable>
                            )}

                            {earningSections.length === 0
                                ? emptyBox(
                                    'Belum ada pendapatan',
                                    orders.error && (orders.orders ?? []).length === 0
                                        ? `Data belum bisa dimuat: ${orders.error}`
                                        : filterPeriod
                                            ? 'Belum ada pesanan selesai pada periode ini.'
                                            : 'Pendapatan dari pesanan yang selesai akan muncul di sini.'
                                )
                                : earningSections.map((sec) => (
                                    <View key={sec.label}>
                                        <Text style={s.dateLabel}>{sec.label}</Text>
                                        {sec.items.map(renderEarning)}
                                    </View>
                                ))}
                        </>
                    ) : txs === null ? (
                        emptyBox(
                            'Riwayat saldo belum bisa dimuat',
                            'Tarik ke bawah untuk mencoba lagi.'
                        )
                    ) : txSections.length === 0 ? (
                        emptyBox(
                            'Belum ada transaksi saldo',
                            'Riwayat top up, penarikan, dan potongan komisi akan muncul di sini.'
                        )
                    ) : (
                        <>
                            {txSections.map((sec) => (
                                <View key={sec.label}>
                                    <Text style={s.dateLabel}>{sec.label}</Text>
                                    {sec.items.map(renderTx)}
                                </View>
                            ))}

                            {txHasMore && (
                                <Pressable style={s.moreBtn} onPress={loadMoreTx} disabled={loadingMore}>
                                    {loadingMore ? (
                                        <ActivityIndicator size="small" color={COLORS.primary} />
                                    ) : (
                                        <Text style={s.moreText}>Muat lebih banyak</Text>
                                    )}
                                </Pressable>
                            )}
                        </>
                    )}
                </View>
            </ScrollView>

            <AlertSheet
                visible={alert.state.visible}
                title={alert.state.title}
                message={alert.state.message}
                onClose={alert.hide}
            />
        </SafeAreaView>
    );
}

// ============================================================
// STYLES
// ============================================================
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.surface },
    scroll: { padding: 24, paddingBottom: 40 },
    pageTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.3, color: COLORS.ink, marginBottom: 16 },

    // Ringkasan
    summaryCard: {
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.line,
        backgroundColor: COLORS.white,
        overflow: 'hidden',
    },
    periodRow: { flexDirection: 'row' },
    periodTab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    periodTabActive: { borderBottomColor: COLORS.primary },
    periodText: { fontSize: 15, fontWeight: '700', color: COLORS.muted },
    periodTextActive: { color: COLORS.ink },

    summaryBody: {
        padding: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: COLORS.line,
    },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    summaryLabel: { fontSize: 14, fontWeight: '600', color: COLORS.muted },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginTop: 12,
    },
    summaryAmount: { fontSize: 28, fontWeight: '800', color: COLORS.ink },
    summaryTrips: { fontSize: 14, color: COLORS.muted, marginTop: 8 },
    detailBtn: {
        backgroundColor: COLORS.primary,
        borderRadius: 24,
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    detailBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },

    breakdown: {
        marginTop: 16,
        paddingTop: 12,
        gap: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: COLORS.line,
    },
    breakRow: { flexDirection: 'row', justifyContent: 'space-between' },
    breakLabel: { fontSize: 13, color: COLORS.muted },
    breakValue: { fontSize: 13, fontWeight: '700', color: COLORS.ink },

    // Saldo
    walletCard: {
        marginTop: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.line,
        backgroundColor: COLORS.white,
        paddingVertical: 18,
        paddingHorizontal: 16,
    },
    walletTop: { flexDirection: 'row', justifyContent: 'space-around' },
    walletCol: { alignItems: 'center', gap: 8 },
    walletLabel: { fontSize: 13, color: COLORS.muted, fontWeight: '600' },
    walletValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    walletIcon: {
        width: 22,
        height: 22,
        borderRadius: 6,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    walletValue: { fontSize: 17, fontWeight: '800', color: COLORS.ink },
    walletNote: { marginTop: 12, textAlign: 'center', fontSize: 12, color: COLORS.muted },

    // Banner utang komisi
    debtBanner: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 16,
        padding: 12,
        borderRadius: 14,
        backgroundColor: DANGER_SOFT,
    },
    debtTitle: { fontSize: 14, fontWeight: '800', color: DANGER },
    debtDesc: { marginTop: 2, fontSize: 12, lineHeight: 18, color: DANGER },

    // Card Top up & Tarik
    actionCards: { marginTop: 12, flexDirection: 'row', gap: 12 },
    actionCard: {
        flex: 1,
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: COLORS.line,
        backgroundColor: COLORS.white,
    },
    actionCardIcon: {
        width: 44,
        height: 44,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    actionCardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
    actionCardDesc: { marginTop: 2, fontSize: 12, lineHeight: 17, color: COLORS.muted },

    // Riwayat
    riwayatWrap: { marginTop: 28 },
    riwayatHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    accentBar: { width: 5, height: 24, borderRadius: 3, backgroundColor: SECONDARY },
    riwayatTitle: { fontSize: 18, fontWeight: '800', color: COLORS.ink },

    segment: {
        flexDirection: 'row',
        padding: 4,
        gap: 4,
        borderRadius: 14,
        backgroundColor: COLORS.line,
        marginBottom: 14,
    },
    segmentItem: {
        flex: 1,
        height: 38,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    segmentItemActive: { backgroundColor: COLORS.white },
    segmentText: { fontSize: 13, fontWeight: '700', color: COLORS.muted },
    segmentTextActive: { color: COLORS.ink },

    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        backgroundColor: SECONDARY_SOFT,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginBottom: 12,
    },
    filterChipText: { fontSize: 13, fontWeight: '700', color: SECONDARY },

    dateLabel: { fontSize: 13, fontWeight: '800', color: COLORS.muted, marginTop: 8, marginBottom: 10 },
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.line,
        borderRadius: 16,
        padding: 14,
        marginBottom: 10,
    },
    itemIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primaryTint,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemTitle: { fontSize: 15, fontWeight: '800', color: COLORS.ink },
    itemSub: { fontSize: 12, color: COLORS.muted },
    itemAmount: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
    itemCommission: { fontSize: 11, fontWeight: '700', color: DANGER, marginTop: 2 },

    txMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    txAmount: { fontSize: 15, fontWeight: '800' },
    statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
    statusBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },

    moreBtn: {
        height: 46,
        borderRadius: 23,
        borderWidth: 1.5,
        borderColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 6,
    },
    moreText: { color: COLORS.primary, fontWeight: '800', fontSize: 14 },

    // Kosong
    emptyWrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
    emptyIcon: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: COLORS.line,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
    },
    emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.ink, marginBottom: 6 },
    emptyDesc: { fontSize: 13, color: COLORS.muted, textAlign: 'center', lineHeight: 20 },
});