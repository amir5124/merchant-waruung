// hooks/useMerchant.ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { merchantService } from '../services/merchantService';
import {
    MenuCategory,
    MenuItem,
    MerchantProfile,
} from '../types/merchant';

/**
 * Hook untuk merchant mengelola tokonya sendiri.
 */
export function useMyStore() {
    const [store, setStore] = useState<MerchantProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await merchantService.getMyStore();
            setStore(data);
        } catch (e: any) {
            setError(e.message ?? 'Gagal memuat toko');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const toggleOpen = useCallback(async (isOpen: boolean) => {
        const updated = await merchantService.setOpen(isOpen);
        setStore(updated);
        return updated;
    }, []);

    const saveStore = useCallback(
        async (payload: Parameters<typeof merchantService.upsertStore>[0]) => {
            const updated = await merchantService.upsertStore(payload);
            setStore(updated);
            return updated;
        },
        []
    );

    return { store, loading, error, refresh, toggleOpen, saveStore };
}

/**
 * Hook untuk merchant mengelola menu & kategori.
 */
export function useMyMenu() {
    const [items, setItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<MenuCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // silent = true: tidak menampilkan spinner (dipakai setelah tambah/ubah/hapus)
    const refresh = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const [menu, cats] = await Promise.all([
                merchantService.listMenu(),
                merchantService.listCategories(),
            ]);
            setItems(menu);
            setCategories(cats);
        } catch (e: any) {
            setError(e.message ?? 'Gagal memuat menu');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    // Bungkus aksi: jalankan, lalu muat ulang daftar
    const actions = useMemo(() => {
        const wrap =
            <A extends any[], R>(fn: (...args: A) => Promise<R>) =>
                async (...args: A): Promise<R> => {
                    const result = await fn(...args);
                    await refresh(true);
                    return result;
                };

        return {
            addMenuItem: wrap(merchantService.addMenuItem),
            updateMenuItem: wrap(merchantService.updateMenuItem),
            deleteMenuItem: wrap(merchantService.deleteMenuItem),
            toggleMenu: wrap(merchantService.toggleMenuAvailability),
            addCategory: wrap(merchantService.addCategory),
            deleteCategory: wrap(merchantService.deleteCategory),
        };
    }, [refresh]);

    return { items, categories, loading, error, refresh, ...actions };
}