// hooks/useOrders.ts
// Pesanan masuk untuk merchant: dimuat saat layar difokuskan, lalu dicek ulang berkala.
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { api, OrderResponse } from '../lib/api';
import { isToday } from '../lib/format';

const ACTIVE = ['accepted', 'arrived', 'in_progress'];

export function useOrders(pollMs = 15000) {
    const [orders, setOrders] = useState<OrderResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);

    const refresh = useCallback(async () => {
        try {
            const data = await api.listOrders();
            const food = (Array.isArray(data) ? data : []).filter((o) => o.type === 'food');
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

    const updateStatus = useCallback(
        async (id: number, status: 'accepted' | 'cancelled', reason?: string) => {
            setBusyId(id);
            try {
                await api.updateOrderStatus(id, status, reason);
                await refresh();
            } finally {
                setBusyId(null);
            }
        },
        [refresh]
    );

    const accept = useCallback((id: number) => updateStatus(id, 'accepted'), [updateStatus]);
    const reject = useCallback(
        (id: number) => updateStatus(id, 'cancelled', 'Ditolak oleh merchant'),
        [updateStatus]
    );

    const derived = useMemo(() => {
        const baru = orders.filter((o) => o.status === 'pending');
        const diproses = orders.filter((o) => ACTIVE.includes(o.status));
        const selesai = orders.filter((o) => o.status === 'completed' || o.status === 'cancelled');

        const today = orders.filter((o) => isToday(o.created_at));
        const todayCount = today.filter((o) => o.status !== 'cancelled').length;
        const todayIncome = today
            .filter((o) => o.status === 'completed')
            .reduce((sum, o) => sum + Number(o.merchant_earning ?? 0), 0);

        return { baru, diproses, selesai, todayCount, todayIncome };
    }, [orders]);

    return { orders, loading, error, busyId, refresh, accept, reject, ...derived };
}