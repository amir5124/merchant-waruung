// app/lengkapi-toko.tsx  — layar Lengkapi Profil Toko (langkah 2 dari 2)
// Disimpan di app/ (di luar grup (auth)) karena user sudah punya token di layar ini.
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertSheet, LoadingModal, useAlertSheet } from '../components/FeedbackModals';
import OpenHoursEditor, {
    OpenHoursState,
    scheduleFromOpenHours,
    scheduleToOpenHours,
    validateSchedule,
} from '../components/OpenHoursEditor';
import StoreLocationPicker, { PickedStoreLocation } from '../components/StoreLocationPicker';
import { api, MerchantStore } from '../lib/api';
import { COLORS } from '../lib/theme';

export default function LengkapiTokoScreen() {
    const [initializing, setInitializing] = useState(true);
    const [existing, setExisting] = useState<MerchantStore | null>(null);

    const [storeName, setStoreName] = useState('');
    const [description, setDescription] = useState('');
    const [address, setAddress] = useState('');
    const [lat, setLat] = useState<number | null>(null);
    const [lng, setLng] = useState<number | null>(null);
    const [hours, setHours] = useState<OpenHoursState>(() => scheduleFromOpenHours(null));

    // ── Logo: uri lokal yang baru dipilih, atau url server ──
    const [logoUri, setLogoUri] = useState<string | null>(null);
    const [logoMime, setLogoMime] = useState('image/jpeg');
    const [uploadingLogo, setUploadingLogo] = useState(false);

    // ── Cover: uri lokal yang baru dipilih, atau url server ──
    const [coverUri, setCoverUri] = useState<string | null>(null);
    const [coverMime, setCoverMime] = useState('image/jpeg');
    const [uploadingCover, setUploadingCover] = useState(false);

    const [locating, setLocating] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const alert = useAlertSheet();

    // ── Muat data awal: toko yang sudah ada, atau nama dari profil hasil registrasi ──
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const store = await api.merchant.getMyStore();
                if (cancelled) return;
                if (store) {
                    setExisting(store);
                    setStoreName(store.store_name ?? '');
                    setDescription(store.description ?? '');
                    setAddress(store.address ?? '');
                    setLat(store.latitude ?? null);
                    setLng(store.longitude ?? null);
                    setHours(scheduleFromOpenHours((store as any).open_hours));

                    // Prefill media dari server
                    if (store.logo_url) setLogoUri(store.logo_url);
                    if (store.cover_url) setCoverUri(store.cover_url);
                } else {
                    await prefillNameFromProfile();
                }
            } catch (e: any) {
                console.warn('[TOKO] Gagal memuat toko:', e?.message);
                await prefillNameFromProfile();
            } finally {
                if (!cancelled) setInitializing(false);
            }
        })();

        // Saat registrasi, "Nama toko" disimpan sebagai full_name
        async function prefillNameFromProfile() {
            try {
                const raw = await AsyncStorage.getItem('profile');
                const p = raw ? JSON.parse(raw) : null;
                if (!cancelled && p?.full_name) setStoreName(p.full_name);
            } catch {
                // abaikan
            }
        }

        return () => {
            cancelled = true;
        };
    }, []);

    // ============================================================
    // FOTO — LOGO
    // ============================================================
    const pickLogo = async () => {
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                alert.show('Izin ditolak', 'Aktifkan akses galeri untuk memilih logo toko.');
                return;
            }

            const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
            });
            if (res.canceled || !res.assets?.length) return;

            const asset = res.assets[0];
            setLogoUri(asset.uri); // preview lokal dulu
            setLogoMime(asset.mimeType ?? 'image/jpeg');

            setUploadingLogo(true);
            try {
                const up = await api.upload.merchantLogo(asset.uri);
                setLogoUri(up.url); // URL server
            } catch (e: any) {
                setLogoUri(existing?.logo_url ?? null); // balik ke nilai lama
                alert.show('Gagal upload logo', e?.message ?? 'Coba lagi sebentar.');
            } finally {
                setUploadingLogo(false);
            }
        } catch (e: any) {
            alert.show('Gagal memilih foto', e?.message ?? 'Coba lagi.');
        }
    };

    const removeLogo = () => setLogoUri(null);

    // ============================================================
    // FOTO — COVER
    // ============================================================
    const pickCover = async () => {
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                alert.show('Izin ditolak', 'Aktifkan akses galeri untuk memilih foto sampul.');
                return;
            }

            const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [16, 9],
                quality: 0.8,
            });
            if (res.canceled || !res.assets?.length) return;

            const asset = res.assets[0];
            setCoverUri(asset.uri); // preview lokal
            setCoverMime(asset.mimeType ?? 'image/jpeg');

            setUploadingCover(true);
            try {
                const up = await api.upload.merchantCover(asset.uri);
                setCoverUri(up.url); // URL server
            } catch (e: any) {
                setCoverUri(existing?.cover_url ?? null); // balik ke nilai lama
                alert.show('Gagal upload foto sampul', e?.message ?? 'Coba lagi sebentar.');
            } finally {
                setUploadingCover(false);
            }
        } catch (e: any) {
            alert.show('Gagal memilih foto', e?.message ?? 'Coba lagi.');
        }
    };

    const removeCover = () => setCoverUri(null);

    // ============================================================
    // LOKASI
    // ============================================================
    const useMyLocation = async () => {
        setLocating(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                alert.show(
                    'Izin ditolak',
                    'Izinkan akses lokasi agar tokomu bisa ditemukan pelanggan terdekat.'
                );
                return;
            }
            const pos = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            setLat(pos.coords.latitude);
            setLng(pos.coords.longitude);
        } catch (e: any) {
            alert.show(
                'Gagal mengambil lokasi',
                e?.message ?? 'Pastikan GPS aktif. Di web, buka lewat localhost atau HTTPS.'
            );
        } finally {
            setLocating(false);
        }
    };

    // Hasil dari pencarian alamat / pilih lewat peta
    const handlePicked = (p: PickedStoreLocation) => {
        setLat(p.latitude);
        setLng(p.longitude);
        setAddress(p.address);
        setPickerOpen(false);
    };

    // ============================================================
    // SIMPAN
    // ============================================================
    const handleSave = async () => {
        if (!storeName.trim()) {
            alert.show('Data belum lengkap', 'Nama toko wajib diisi.');
            return;
        }

        const hoursError = validateSchedule(hours);
        if (hoursError) {
            alert.show('Jam operasional belum valid', hoursError);
            return;
        }

        if (uploadingLogo || uploadingCover) {
            alert.show('Tunggu upload', 'Foto sedang diunggah. Tunggu sebentar.');
            return;
        }

        setSaving(true);
        console.log('[TOKO] Menyimpan profil toko...');

        try {
            // ── Logo: pakai URL server kalau sudah ada, kalau masih lokal berarti
            //    upload gagal (sudah ditangani di pickLogo), jadi fallback ke existing.
            let logoUrl: string | null | undefined = existing?.logo_url ?? undefined;
            if (logoUri === null) {
                logoUrl = null; // user hapus
            } else if (logoUri.startsWith('http')) {
                logoUrl = logoUri; // URL server
            }

            // ── Cover: sama polanya.
            let coverUrl: string | null | undefined = existing?.cover_url ?? undefined;
            if (coverUri === null) {
                coverUrl = null; // user hapus
            } else if (coverUri.startsWith('http')) {
                coverUrl = coverUri; // URL server
            }

            // ── Simpan toko (upsert menimpa semua kolom, jadi kirim ulang
            //    nilai yang sudah ada agar tidak ter-reset).
            await api.merchant.saveStore({
                store_name: storeName.trim(),
                description: description.trim() || undefined,
                address: address.trim() || undefined,
                latitude: lat ?? undefined,
                longitude: lng ?? undefined,
                logo_url: logoUrl,
                cover_url: coverUrl,
                is_open: existing?.is_open ?? false,
                open_hours: scheduleToOpenHours(hours),
            } as any);

            console.log('[TOKO] Profil toko tersimpan');

            // Masuk ke tab utama
            router.replace('/(tabs)' as any);
        } catch (e: any) {
            console.error('[TOKO] Gagal:', e?.message);
            alert.show('Gagal menyimpan', e?.message ?? 'Terjadi kesalahan, coba lagi.');
        } finally {
            setSaving(false);
        }
    };

    if (initializing) {
        return (
            <SafeAreaView style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </SafeAreaView>
        );
    }

    const logoShown = logoUri ?? existing?.logo_url ?? null;
    const coverShown = coverUri ?? existing?.cover_url ?? null;
    const hasLocation = lat != null && lng != null;
    const canGoBack = router.canGoBack();
    const anyUploading = uploadingLogo || uploadingCover;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* ── Baris atas: kembali + indikator langkah ── */}
                    <View style={styles.topRow}>
                        {canGoBack ? (
                            <TouchableOpacity
                                style={styles.backButton}
                                onPress={() => router.back()}
                                accessibilityLabel="Kembali"
                            >
                                <Ionicons name="chevron-back" size={20} color={COLORS.ink} />
                            </TouchableOpacity>
                        ) : (
                            <View style={styles.backPlaceholder} />
                        )}
                        <View style={styles.stepRow}>
                            <View style={styles.stepBar} />
                            <View style={styles.stepBar} />
                            <Text style={styles.stepText}>Langkah 2 dari 2</Text>
                        </View>
                    </View>

                    {/* ── Judul ── */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Lengkapi profil toko</Text>
                        <Text style={styles.subtitle}>
                            Isi data toko supaya pelanggan bisa menemukan dan memesan dari tokomu.
                        </Text>
                    </View>

                    {/* ── Foto sampul + logo ── */}
                    <View style={styles.mediaWrap}>
                        {/* Cover */}
                        <TouchableOpacity
                            style={styles.cover}
                            activeOpacity={0.8}
                            onPress={pickCover}
                            disabled={uploadingCover}
                            accessibilityLabel="Tambah foto sampul"
                        >
                            {coverShown ? (
                                <>
                                    <Image source={{ uri: coverShown }} style={styles.coverImage} />
                                    {uploadingCover && (
                                        <View style={styles.coverOverlay}>
                                            <ActivityIndicator color="#fff" />
                                            <Text style={styles.coverOverlayText}>Mengunggah…</Text>
                                        </View>
                                    )}
                                </>
                            ) : (
                                <>
                                    <Ionicons name="camera-outline" size={24} color={COLORS.muted} />
                                    <Text style={styles.coverText}>Tambah foto sampul</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        {/* Tombol hapus cover */}
                        {!!coverShown && !uploadingCover && (
                            <TouchableOpacity
                                style={styles.removeCoverBtn}
                                onPress={removeCover}
                                accessibilityLabel="Hapus foto sampul"
                            >
                                <Ionicons name="close" size={14} color="#fff" />
                            </TouchableOpacity>
                        )}

                        {/* Logo */}
                        <TouchableOpacity
                            style={styles.logoButton}
                            activeOpacity={0.8}
                            onPress={pickLogo}
                            disabled={uploadingLogo}
                            accessibilityLabel="Tambah logo toko"
                        >
                            {logoShown ? (
                                <Image source={{ uri: logoShown }} style={styles.logoImage} />
                            ) : (
                                <Ionicons name="storefront-outline" size={24} color={COLORS.primary} />
                            )}
                            {uploadingLogo && (
                                <View style={styles.logoOverlay}>
                                    <ActivityIndicator size="small" color="#fff" />
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* ── Form ── */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Nama toko</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Nama toko kamu"
                            placeholderTextColor={COLORS.placeholder}
                            value={storeName}
                            onChangeText={setStoreName}
                            editable={!saving}
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.label}>Deskripsi</Text>
                        <TextInput
                            style={[styles.input, styles.textArea, { height: 84 }]}
                            placeholder="Ceritakan singkat tentang tokomu"
                            placeholderTextColor={COLORS.placeholder}
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            editable={!saving}
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.label}>Alamat</Text>
                        <TextInput
                            style={[styles.input, styles.textArea, { height: 72 }]}
                            placeholder="Alamat lengkap toko"
                            placeholderTextColor={COLORS.placeholder}
                            value={address}
                            onChangeText={setAddress}
                            multiline
                            editable={!saving}
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.label}>Lokasi toko</Text>
                        <TouchableOpacity
                            style={styles.pickButton}
                            activeOpacity={0.85}
                            onPress={() => setPickerOpen(true)}
                            disabled={saving}
                        >
                            <Ionicons name="search" size={20} color="#fff" />
                            <Text style={styles.pickButtonText}>
                                {hasLocation ? 'Ubah lewat pencarian / peta' : 'Cari alamat & pilih di peta'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.locButton, { marginTop: 10 }]}
                            activeOpacity={0.8}
                            onPress={useMyLocation}
                            disabled={locating || saving}
                        >
                            {locating ? (
                                <ActivityIndicator size="small" color={COLORS.primary} />
                            ) : (
                                <Ionicons name="locate-outline" size={20} color={COLORS.primary} />
                            )}
                            <Text style={styles.locButtonText}>
                                {hasLocation ? 'Perbarui lokasi saat ini' : 'Gunakan lokasi saat ini'}
                            </Text>
                        </TouchableOpacity>

                        {hasLocation ? (
                            <View style={[styles.notice, { backgroundColor: COLORS.okBg }]}>
                                <Ionicons name="checkmark-circle" size={18} color={COLORS.okText} />
                                <Text style={[styles.noticeText, { color: COLORS.okText }]}>
                                    Lokasi tersimpan: {lat!.toFixed(6)}, {lng!.toFixed(6)}
                                </Text>
                            </View>
                        ) : (
                            <View style={[styles.notice, { backgroundColor: COLORS.warnBg }]}>
                                <Ionicons name="location-outline" size={18} color={COLORS.warnText} />
                                <Text style={[styles.noticeText, { color: COLORS.warnText }]}>
                                    Lokasi belum diatur. Toko belum muncul di pencarian terdekat.
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* ── Jam operasional ── */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Jam operasional</Text>
                        <OpenHoursEditor value={hours} onChange={setHours} disabled={saving} />
                    </View>

                    <View style={{ flex: 1, minHeight: 24 }} />

                    {/* ── Simpan ── */}
                    <TouchableOpacity
                        style={[styles.primaryButton, (saving || anyUploading) && { opacity: 0.6 }]}
                        activeOpacity={0.85}
                        onPress={handleSave}
                        disabled={saving || anyUploading}
                    >
                        <Text style={styles.primaryButtonText}>Simpan dan mulai jualan</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>

            <StoreLocationPicker
                visible={pickerOpen}
                initial={hasLocation ? { latitude: lat!, longitude: lng! } : null}
                initialAddress={address}
                onClose={() => setPickerOpen(false)}
                onConfirm={handlePicked}
            />

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
    container: { flex: 1, backgroundColor: COLORS.white },
    center: { alignItems: 'center', justifyContent: 'center' },
    scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 28 },

    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: COLORS.line,
        alignItems: 'center',
        justifyContent: 'center',
    },
    backPlaceholder: { width: 44, height: 44 },
    stepRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    stepBar: { width: 28, height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
    stepText: { marginLeft: 6, fontSize: 13, fontWeight: '600', color: COLORS.muted },

    header: { marginTop: 20, gap: 8 },
    title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.4, color: COLORS.ink },
    subtitle: { fontSize: 15, lineHeight: 22, color: COLORS.muted },

    // ── Foto sampul + logo (wrapper 160 = sampul 132 + logo menjorok 28) ──
    mediaWrap: { marginTop: 20, height: 160 },
    cover: {
        height: 132,
        borderRadius: 16,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: COLORS.dashed,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        overflow: 'hidden',
    },
    coverImage: { width: '100%', height: '100%' },
    coverOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    coverOverlayText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    coverText: { fontSize: 13, fontWeight: '600', color: COLORS.muted },
    removeCoverBtn: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    logoButton: {
        position: 'absolute',
        left: 16,
        top: 88,
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 4,
        borderColor: COLORS.white,
        backgroundColor: COLORS.primaryTint,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    logoImage: { width: '100%', height: '100%' },
    logoOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    field: { marginTop: 16 },
    label: { fontSize: 13, fontWeight: '600', color: COLORS.ink, marginBottom: 8 },
    input: {
        height: 54,
        backgroundColor: COLORS.white,
        borderWidth: 1.5,
        borderColor: COLORS.fieldBorder,
        borderRadius: 14,
        paddingHorizontal: 14,
        fontSize: 15,
        fontWeight: '500',
        color: COLORS.ink,
    },
    textArea: { paddingTop: 14, paddingBottom: 14, textAlignVertical: 'top' },

    pickButton: {
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 14,
        backgroundColor: COLORS.primary,
    },
    pickButtonText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    locButton: {
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1.5,
        borderColor: COLORS.primary,
        borderRadius: 14,
        backgroundColor: COLORS.white,
    },
    locButtonText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
    notice: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
    },
    noticeText: { flex: 1, fontSize: 13, lineHeight: 18 },

    primaryButton: {
        height: 54,
        borderRadius: 999,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});