// hooks/useOrders.ts
// Pesanan masuk untuk merchant: dimuat saat layar difokuskan, lalu dicek ulang berkala.
// Alur "merchant dulu": toko menerima / menolak lewat endpoint khusus,
// BUKAN lewat PUT /status (server menolak status 'accepted' di jalur itu).
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { api, OrderResponse } from '../lib/api';
import { isToday } from '../lib/format';

/** Status order yang sudah berjalan bersama driver. */
const ACTIVE = ['accepted', 'arrived', 'in_progress'];

/** Pesanan yang masih menunggu keputusan toko (terima / tolak). */
export const isWaitingMerchant = (o: OrderResponse) =>
    o.status === 'pending' && o.merchant_status === 'waiting';

export function useOrders(pollMs = 15000) {
    const [orders, setOrders] = useState<OrderResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);

    const refresh = useCallback(async () => {
        try {
            const data = await api.listOrders();
            // Server bisa mengirim `items` atau `order_items` — samakan jadi `items`
            const food = (Array.isArray(data) ? data : [])
                .filter((o) => o.type === 'food')
                .map((o) => ({ ...o, items: o.items ?? (o as any).order_items ?? [] }));
            food.sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            setOrders(food);
            setError(null);
        } catch (e: any) {
            setError(e?.message ?? 'Gagal memuat pesanan');
        } finally {
            setLoading(false);
        }
    }, []);

    // Muat saat layar fokus + cek ulang tiap `pollMs` selama layar fokus
    useFocusEffect(
        useCallback(() => {
            refresh();
            const t = setInterval(refresh, pollMs);
            return () => clearInterval(t);
        }, [refresh, pollMs])
    );

    /**
     * Jalankan aksi terhadap satu pesanan, lalu muat ulang daftar.
     * Kalau gagal (mis. 409 "sudah direspons" karena toko lambat dan pesanan
     * sudah ditolak otomatis), daftar tetap dimuat ulang supaya tampilan
     * langsung sesuai kondisi server, lalu errornya dilempar ke layar.
     */
    const run = useCallback(
        async (id: number, action: () => Promise<unknown>) => {
            setBusyId(id);
            try {
                await action();
                await refresh();
            } catch (e) {
                await refresh();
                throw e;
            } finally {
                setBusyId(null);
            }
        },
        [refresh]
    );

    /** Terima pesanan. `prepMinutes` = estimasi menit menyiapkan (1–180). */
    const accept = useCallback(
        (id: number, prepMinutes: number = 15) =>
            run(id, () => api.acceptOrder(id, prepMinutes)),
        [run]
    );

    /** Tolak pesanan. */
    const reject = useCallback(
        (id: number, reason: string = 'Ditolak oleh merchant') =>
            run(id, () => api.rejectOrder(id, reason)),
        [run]
    );

    /** Tandai pesanan siap diambil (driver & customer diberi notifikasi). */
    const ready = useCallback((id: number) => run(id, () => api.readyOrder(id)), [run]);

    const derived = useMemo(() => {
        // Baru: butuh keputusan toko
        const baru = orders.filter(isWaitingMerchant);

        // Diproses: sudah diterima toko (mencari driver) atau sudah berjalan.
        // Order 'pending' lama tanpa merchant_status (dibuat sebelum alur baru)
        // sudah terlanjur dikirim ke driver, jadi ikut di sini sebagai "mencari driver".
        const diproses = orders.filter(
            (o) =>
                (o.status === 'pending' && o.merchant_status !== 'waiting') ||
                ACTIVE.includes(o.status)
        );

        const selesai = orders.filter((o) => o.status === 'completed' || o.status === 'cancelled');

        const today = orders.filter((o) => isToday(o.created_at));
        const todayCount = today.filter((o) => o.status !== 'cancelled').length;
        const todayIncome = today
            .filter((o) => o.status === 'completed')
            .reduce((sum, o) => sum + Number(o.merchant_earning ?? 0), 0);

        return { baru, diproses, selesai, todayCount, todayIncome };
    }, [orders]);

    return { orders, loading, error, busyId, refresh, accept, reject, ready, ...derived };
}