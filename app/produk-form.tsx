// app/produk-form.tsx — versi dengan foto produk
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertSheet, LoadingModal, useAlertSheet } from '../components/FeedbackModals';
import ToggleSwitch from '../components/ToggleSwitch';
import { api, MenuCategory } from '../lib/api';
import { thousands } from '../lib/format';
import { COLORS } from '../lib/theme';

export default function ProdukFormScreen() {
    const { id } = useLocalSearchParams<{ id?: string }>();
    const editId = id ? Number(id) : null;
    const isEdit = editId !== null && !Number.isNaN(editId);

    const [categories, setCategories] = useState<MenuCategory[]>([]);
    const [initLoading, setInitLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState<number | null>(null);
    const [price, setPrice] = useState('');
    const [stock, setStock] = useState('');
    const [description, setDescription] = useState('');
    const [available, setAvailable] = useState(true);

    // ===== FOTO PRODUK =====
    const [imageUrl, setImageUrl] = useState<string | null>(null); // URL final (server / local)
    const [uploading, setUploading] = useState(false);

    const [pickerOpen, setPickerOpen] = useState(false);
    const [newCat, setNewCat] = useState('');
    const [catBusy, setCatBusy] = useState(false);
    const [catError, setCatError] = useState('');

    const alert = useAlertSheet();

    useEffect(() => {
        (async () => {
            try {
                const cats = await api.merchant.listCategories();
                setCategories(Array.isArray(cats) ? cats : []);
                if (isEdit) {
                    const menu = await api.merchant.listMenu();
                    const it = menu.find((m) => m.id === editId);
                    if (it) {
                        setName(it.name);
                        setCategoryId(it.category_id ?? null);
                        setPrice(String(Math.round(it.price)));
                        setStock(it.stock !== null && it.stock !== undefined ? String(it.stock) : '');
                        setDescription(it.description ?? '');
                        setAvailable(!!it.is_available);
                        setImageUrl(it.image_url ?? null);
                    }
                }
            } catch (e: any) {
                alert.show('Gagal memuat', e?.message ?? 'Coba lagi sebentar.');
            } finally {
                setInitLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selectedCat = categories.find((c) => c.id === categoryId);

    // ===== PICK & UPLOAD FOTO =====
    const pickImage = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            alert.show('Izin ditolak', 'Aktifkan akses galeri untuk memilih foto produk.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (result.canceled || !result.assets?.[0]) return;

        const asset = result.assets[0];
        setImageUrl(asset.uri); // preview lokal dulu

        // Upload ke server
        setUploading(true);
        try {
            const res = await api.upload.product(asset.uri);
            setImageUrl(res.url); // ganti dengan URL server
        } catch (e: any) {
            setImageUrl(null);
            alert.show('Gagal upload foto', e?.message ?? 'Coba lagi sebentar.');
        } finally {
            setUploading(false);
        }
    };

    const removeImage = () => {
        setImageUrl(null);
    };

    const addCategory = async () => {
        const n = newCat.trim();
        if (!n) return;
        setCatBusy(true);
        setCatError('');
        try {
            const created = await api.merchant.addCategory(n);
            setCategories((prev) => [...prev, created]);
            setCategoryId(created.id);
            setNewCat('');
            setPickerOpen(false);
        } catch (e: any) {
            setCatError(e?.message ?? 'Gagal menambah kategori');
        } finally {
            setCatBusy(false);
        }
    };

    const save = async () => {
        if (!name.trim()) return alert.show('Nama produk kosong', 'Isi nama produk terlebih dahulu.');
        const priceNum = Number(price);
        if (!price || !(priceNum > 0)) return alert.show('Harga belum valid', 'Isi harga lebih dari 0.');
        if (uploading) return alert.show('Tunggu upload', 'Foto produk sedang diunggah.');

        setSaving(true);
        try {
            if (isEdit) {
                const payload: any = {
                    name: name.trim(),
                    price: priceNum,
                    category_id: categoryId,
                    description: description.trim() ? description.trim() : null,
                    stock: stock === '' ? null : Number(stock),
                    is_available: available,
                    image_url: imageUrl, // null = hapus foto
                };
                await api.merchant.updateMenuItem(editId as number, payload);
            } else {
                const payload: any = {
                    name: name.trim(),
                    price: priceNum,
                    image_url: imageUrl,
                };
                if (categoryId !== null) payload.category_id = categoryId;
                if (description.trim()) payload.description = description.trim();
                if (stock !== '') payload.stock = Number(stock);
                const created = await api.merchant.addMenuItem(payload);
                if (!available && created?.id) await api.merchant.toggleMenu(created.id);
            }
            router.back();
        } catch (e: any) {
            alert.show('Gagal menyimpan', e?.message ?? 'Coba lagi sebentar.');
        } finally {
            setSaving(false);
        }
    };

    if (initLoading) {
        return (
            <SafeAreaView style={[styles.safe, styles.center]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.ink} />
                </TouchableOpacity>
                <Text style={styles.title}>{isEdit ? 'Ubah produk' : 'Tambah produk'}</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    {/* ===== FOTO PRODUK ===== */}
                    <TouchableOpacity
                        style={styles.photoBox}
                        onPress={pickImage}
                        activeOpacity={0.85}
                        disabled={uploading}
                    >
                        {imageUrl ? (
                            <>
                                <Image source={{ uri: imageUrl }} style={styles.photoImg} />
                                {uploading && (
                                    <View style={styles.photoOverlay}>
                                        <ActivityIndicator color="#fff" />
                                        <Text style={styles.photoOverlayText}>Mengunggah…</Text>
                                    </View>
                                )}
                            </>
                        ) : (
                            <>
                                <Ionicons name="camera-outline" size={30} color={COLORS.dashed} />
                                <Text style={styles.photoText}>Tambah foto produk</Text>
                                <Text style={styles.photoHint}>Rasio 1:1 · Maks 5 MB</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {!!imageUrl && !uploading && (
                        <TouchableOpacity style={styles.removePhoto} onPress={removeImage} activeOpacity={0.8}>
                            <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                            <Text style={styles.removePhotoText}>Hapus foto</Text>
                        </TouchableOpacity>
                    )}

                    <Text style={styles.label}>Nama produk</Text>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="Contoh: Nasi Goreng Spesial"
                        placeholderTextColor={COLORS.placeholder}
                    />

                    <Text style={styles.label}>Kategori</Text>
                    <TouchableOpacity style={styles.select} onPress={() => setPickerOpen(true)} activeOpacity={0.85}>
                        <Text style={[styles.selectText, !selectedCat && { color: COLORS.placeholder }]}>
                            {selectedCat ? selectedCat.name : 'Pilih kategori'}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color={COLORS.muted} />
                    </TouchableOpacity>

                    <View style={styles.twoCol}>
                        <View style={{ flex: 3 }}>
                            <Text style={styles.label}>Harga (Rp)</Text>
                            <TextInput
                                style={styles.input}
                                value={thousands(price)}
                                onChangeText={(t) => setPrice(t.replace(/\D/g, '').slice(0, 9))}
                                keyboardType="number-pad"
                                placeholder="0"
                                placeholderTextColor={COLORS.placeholder}
                            />
                        </View>
                        <View style={{ flex: 2 }}>
                            <Text style={styles.label}>Stok</Text>
                            <TextInput
                                style={styles.input}
                                value={stock}
                                onChangeText={(t) => setStock(t.replace(/\D/g, '').slice(0, 6))}
                                keyboardType="number-pad"
                                placeholder="Tak terbatas"
                                placeholderTextColor={COLORS.placeholder}
                            />
                        </View>
                    </View>

                    <Text style={styles.label}>Deskripsi</Text>
                    <TextInput
                        style={[styles.input, styles.textarea]}
                        value={description}
                        onChangeText={setDescription}
                        placeholder="Ceritakan singkat tentang produk ini"
                        placeholderTextColor={COLORS.placeholder}
                        multiline
                        textAlignVertical="top"
                    />

                    <View style={styles.switchRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.switchTitle}>Tersedia untuk dijual</Text>
                            <Text style={styles.switchSub}>Matikan jika stok sedang habis</Text>
                        </View>
                        <ToggleSwitch value={available} onValueChange={setAvailable} label="Tersedia untuk dijual" />
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.saveBtn, (saving || uploading) && { opacity: 0.6 }]}
                        onPress={save}
                        activeOpacity={0.85}
                        disabled={saving || uploading}
                    >
                        <Text style={styles.saveText}>Simpan produk</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* Pemilih kategori */}
            <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback onPress={() => setPickerOpen(false)}>
                        <View style={{ flex: 1 }} />
                    </TouchableWithoutFeedback>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                        <View style={styles.sheet}>
                            <View style={styles.grabber} />
                            <Text style={styles.sheetTitle}>Pilih kategori</Text>

                            <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
                                {[{ id: null as number | null, name: 'Tanpa kategori' }, ...categories].map((c) => {
                                    const active = categoryId === c.id;
                                    return (
                                        <TouchableOpacity
                                            key={String(c.id)}
                                            style={styles.option}
                                            activeOpacity={0.8}
                                            onPress={() => {
                                                setCategoryId(c.id);
                                                setPickerOpen(false);
                                            }}
                                        >
                                            <Ionicons
                                                name={active ? 'radio-button-on' : 'radio-button-off'}
                                                size={22}
                                                color={active ? COLORS.primary : COLORS.dashed}
                                            />
                                            <Text style={[styles.optionText, active && { fontWeight: '700' }]}>{c.name}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            <View style={styles.newRow}>
                                <TextInput
                                    style={[styles.input, { flex: 1 }]}
                                    value={newCat}
                                    onChangeText={(t) => {
                                        setNewCat(t);
                                        setCatError('');
                                    }}
                                    placeholder="Nama kategori baru"
                                    placeholderTextColor={COLORS.placeholder}
                                    onSubmitEditing={addCategory}
                                />
                                <TouchableOpacity
                                    style={[styles.newBtn, (!newCat.trim() || catBusy) && { opacity: 0.5 }]}
                                    onPress={addCategory}
                                    disabled={!newCat.trim() || catBusy}
                                    activeOpacity={0.85}
                                >
                                    {catBusy ? (
                                        <ActivityIndicator size="small" color="#ffffff" />
                                    ) : (
                                        <Text style={styles.newBtnText}>Tambah</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                            {!!catError && <Text style={styles.catError}>{catError}</Text>}
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            <LoadingModal visible={saving} />
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
    safe: { flex: 1, backgroundColor: COLORS.white },
    center: { alignItems: 'center', justifyContent: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        height: 56,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.line,
    },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: '800', color: COLORS.ink },
    content: { padding: 20, paddingBottom: 32 },

    // ===== FOTO =====
    photoBox: {
        height: 180,
        borderRadius: 16,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: COLORS.dashed,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 8,
        overflow: 'hidden',
    },
    photoImg: { width: '100%', height: '100%' },
    photoOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    photoOverlayText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    photoText: { fontSize: 14, fontWeight: '600', color: COLORS.muted },
    photoHint: { fontSize: 12, color: COLORS.placeholder },
    removePhoto: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: '#fdecec',
        marginBottom: 4,
    },
    removePhotoText: { fontSize: 12, fontWeight: '700', color: COLORS.danger },

    label: { fontSize: 14, fontWeight: '700', color: COLORS.ink, marginTop: 16, marginBottom: 8 },
    input: {
        height: 54,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: COLORS.fieldBorder,
        backgroundColor: COLORS.white,
        paddingHorizontal: 16,
        fontSize: 16,
        color: COLORS.ink,
        outlineStyle: 'none' as any,
    },
    textarea: { height: 96, paddingTop: 14 },
    select: {
        height: 54,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: COLORS.fieldBorder,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    selectText: { fontSize: 16, color: COLORS.ink },
    twoCol: { flexDirection: 'row', gap: 12 },

    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 20,
        padding: 16,
        borderRadius: 16,
        backgroundColor: COLORS.surface,
    },
    switchTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
    switchSub: { fontSize: 13, color: COLORS.muted, marginTop: 2 },

    footer: { padding: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.line, backgroundColor: COLORS.white },
    saveBtn: {
        height: 54,
        borderRadius: 999,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveText: { fontSize: 16, fontWeight: '800', color: '#ffffff' },

    overlay: { flex: 1, backgroundColor: 'rgba(20,34,46,0.45)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        paddingBottom: 28,
    },
    grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.line, marginBottom: 14 },
    sheetTitle: { fontSize: 18, fontWeight: '800', color: COLORS.ink, marginBottom: 8 },
    option: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 52 },
    optionText: { fontSize: 15, color: COLORS.ink },
    newRow: { flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center' },
    newBtn: {
        height: 54,
        paddingHorizontal: 18,
        borderRadius: 999,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    newBtnText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
    catError: { marginTop: 8, fontSize: 13, color: COLORS.danger },
});