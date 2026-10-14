// app/(tabs)/produk.tsx — daftar produk merchant
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertSheet, useAlertSheet } from '../../components/FeedbackModals';
import ToggleSwitch from '../../components/ToggleSwitch';
import { api, MenuCategory, MenuItem } from '../../lib/api';
import { confirmAction } from '../../lib/dialogs';
import { rupiah } from '../../lib/format';
import { COLORS } from '../../lib/theme';

export default function ProdukScreen() {
    const [items, setItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<MenuCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [activeCat, setActiveCat] = useState<number | null>(null); // null = Semua
    const [busyId, setBusyId] = useState<number | null>(null);
    const alert = useAlertSheet();

    const load = useCallback(async () => {
        try {
            const [menu, cats] = await Promise.all([
                api.merchant.listMenu(),
                api.merchant.listCategories(),
            ]);
            setItems(Array.isArray(menu) ? menu : []);
            setCategories(Array.isArray(cats) ? cats : []);
            setError(null);
        } catch (e: any) {
            setError(e?.message ?? 'Gagal memuat produk');
        } finally {
            setLoading(false);
        }
    }, []);

    // Muat ulang tiap layar fokus (mis. setelah kembali dari form produk)
    useFocusEffect(
        useCallback(() => {
            load();
        }, [load])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return items.filter((i) => {
            if (activeCat !== null && i.category_id !== activeCat) return false;
            if (q && !i.name.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [items, query, activeCat]);

    const toggle = async (item: MenuItem) => {
        setBusyId(item.id);
        try {
            const updated = await api.merchant.toggleMenu(item.id);
            // gabungkan agar relasi menu_categories tidak hilang
            setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, ...updated } : p)));
        } catch (e: any) {
            alert.show('Gagal mengubah status', e?.message ?? 'Coba lagi sebentar.');
        } finally {
            setBusyId(null);
        }
    };

    const remove = async (item: MenuItem) => {
        const ok = await confirmAction({
            title: 'Hapus produk?',
            message: `"${item.name}" akan dihapus dari menu toko.`,
            confirmText: 'Hapus',
            destructive: true,
        });
        if (!ok) return;
        setBusyId(item.id);
        try {
            await api.merchant.deleteMenuItem(item.id);
            setItems((prev) => prev.filter((p) => p.id !== item.id));
        } catch (e: any) {
            alert.show('Gagal menghapus', e?.message ?? 'Coba lagi sebentar.');
        } finally {
            setBusyId(null);
        }
    };

    const goForm = (id?: number) =>
        router.push({ pathname: '/produk-form', params: id ? { id: String(id) } : {} } as any);

    const catName = (i: MenuItem) =>
        i.menu_categories?.name ?? categories.find((c) => c.id === i.category_id)?.name ?? 'Tanpa kategori';

    const renderItem = ({ item }: { item: MenuItem }) => (
        <View style={styles.card}>
            <View style={styles.topRow}>
                <View style={styles.tile}>
                    {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={styles.tileImg} />
                    ) : (
                        <Ionicons name="fast-food-outline" size={26} color={COLORS.dashed} />
                    )}
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.name} numberOfLines={2}>
                        {item.name}
                    </Text>
                    <Text style={styles.price}>{rupiah(item.price)}</Text>
                    <Text style={styles.meta} numberOfLines={1}>
                        {catName(item)}
                        {item.stock !== null && item.stock !== undefined ? ` · Stok ${item.stock}` : ''}
                    </Text>
                </View>
            </View>

            <View style={styles.bottomRow}>
                <View style={styles.actions}>
                    <TouchableOpacity style={styles.editBtn} onPress={() => goForm(item.id)} activeOpacity={0.8}>
                        <Ionicons name="create-outline" size={16} color={COLORS.primary} />
                        <Text style={styles.editText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.delBtn}
                        onPress={() => remove(item)}
                        disabled={busyId === item.id}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                        <Text style={styles.delText}>Hapus</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.switchWrap}>
                    <Text style={[styles.stateText, { color: item.is_available ? COLORS.okText : COLORS.muted }]}>
                        {item.is_available ? 'Tersedia' : 'Habis'}
                    </Text>
                    <ToggleSwitch
                        value={item.is_available}
                        onValueChange={() => toggle(item)}
                        label={`Ketersediaan ${item.name}`}
                        disabled={busyId === item.id}
                    />
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.safe} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.title}>Produk</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => goForm()} activeOpacity={0.85}>
                    <Ionicons name="add" size={20} color="#ffffff" />
                    <Text style={styles.addText}>Tambah</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={20} color={COLORS.muted} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Cari produk"
                    placeholderTextColor={COLORS.placeholder}
                    value={query}
                    onChangeText={setQuery}
                />
                {!!query && (
                    <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
                        <Ionicons name="close-circle" size={18} color={COLORS.placeholder} />
                    </TouchableOpacity>
                )}
            </View>

            <View style={{ height: 52 }}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chips}
                >
                    {[{ id: null as number | null, name: 'Semua' }, ...categories].map((c) => {
                        const active = activeCat === c.id;
                        return (
                            <TouchableOpacity
                                key={String(c.id)}
                                style={[styles.chip, active && styles.chipActive]}
                                onPress={() => setActiveCat(c.id)}
                                activeOpacity={0.85}
                            >
                                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.name}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={(i) => String(i.id)}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
                    }
                    ListHeaderComponent={
                        error ? (
                            <View style={styles.errorBox}>
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="restaurant-outline" size={44} color={COLORS.dashed} />
                            <Text style={styles.emptyText}>
                                {items.length === 0 ? 'Belum ada produk. Tambahkan produk pertama Anda.' : 'Produk tidak ditemukan.'}
                            </Text>
                        </View>
                    }
                />
            )}

            <AlertSheet
                visible={alert.state.visible}
                title={alert.state.title}
                message={alert.state.message}
                onClose={alert.hide}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.surface },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 12,
    },
    title: { fontSize: 24, fontWeight: '800', color: COLORS.ink },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        height: 40,
        paddingHorizontal: 16,
        borderRadius: 999,
        backgroundColor: COLORS.primary,
    },
    addText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },

    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        height: 48,
        marginHorizontal: 20,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: COLORS.fieldBorder,
        backgroundColor: COLORS.white,
    },
    searchInput: { flex: 1, fontSize: 15, color: COLORS.ink, outlineStyle: 'none' as any },

    chips: { paddingHorizontal: 20, paddingVertical: 10, gap: 8, alignItems: 'center' },
    chip: {
        height: 34,
        paddingHorizontal: 16,
        borderRadius: 999,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.line,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { fontSize: 13, fontWeight: '700', color: COLORS.muted },
    chipTextActive: { color: '#ffffff' },

    list: { padding: 20, paddingTop: 8, paddingBottom: 32, flexGrow: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    card: {
        gap: 12,
        padding: 14,
        borderRadius: 18,
        backgroundColor: COLORS.white,
        borderWidth: 1,
        borderColor: COLORS.line,
    },
    topRow: { flexDirection: 'row', gap: 12 },
    tile: {
        width: 64,
        height: 64,
        borderRadius: 14,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    tileImg: { width: 64, height: 64 },
    name: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
    price: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
    meta: { fontSize: 12, color: COLORS.muted },

    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: COLORS.line,
    },
    actions: { flexDirection: 'row', gap: 8 },
    editBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        height: 36,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: COLORS.primaryTint,
    },
    editText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
    delBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        height: 36,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: '#fdecec',
    },
    delText: { fontSize: 13, fontWeight: '700', color: COLORS.danger },
    switchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    stateText: { fontSize: 12, fontWeight: '700' },

    empty: { alignItems: 'center', gap: 10, paddingVertical: 64, paddingHorizontal: 24 },
    emptyText: { fontSize: 14, color: COLORS.muted, textAlign: 'center' },
    errorBox: { padding: 12, borderRadius: 12, backgroundColor: '#fdecec', marginBottom: 12 },
    errorText: { fontSize: 13, color: COLORS.danger },
});