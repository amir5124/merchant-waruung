// components/StoreLocationPicker.tsx
// Modal layar penuh: cari alamat (Google Autocomplete) + pilih titik di peta (pin tengah) → lat/lng toko.
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Keyboard,
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../lib/theme';
import {
    autocomplete,
    hasPlacesKey,
    LatLng,
    newSessionToken,
    placeDetails,
    PlaceSuggestion,
    reverseGeocode,
} from '../services/places';

// ============================================================
// TYPES
// ============================================================
export type PickedStoreLocation = {
    latitude: number;
    longitude: number;
    address: string;
    name: string;
};

type Props = {
    visible: boolean;
    initial?: LatLng | null;
    initialAddress?: string;
    onClose: () => void;
    onConfirm: (p: PickedStoreLocation) => void;
    customMapStyle?: any[];
};

// ============================================================
// CONSTANTS
// ============================================================
const DEFAULT_CENTER: LatLng = { latitude: -6.9426, longitude: 109.7937 };
const DELTA_FAR = 0.04;
const DELTA_NEAR = 0.006;
const PIN_HEIGHT = 58;

export default function StoreLocationPicker({
    visible,
    initial,
    initialAddress,
    onClose,
    onConfirm,
    customMapStyle,
}: Props) {
    const insets = useSafeAreaInsets();
    const mapRef = useRef<MapView>(null);

    // ---------- State: Search ----------
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    // ---------- State: Location ----------
    const [picked, setPicked] = useState<{
        coords: LatLng;
        name: string;
        address: string;
    } | null>(null);
    const [resolving, setResolving] = useState(false);
    const [locating, setLocating] = useState(false);
    const [userPos, setUserPos] = useState<LatLng | null>(null);

    // ---------- State: GPS & Permission ----------
    const [gpsEnabled, setGpsEnabled] = useState<boolean | null>(null);
    const [permissionStatus, setPermissionStatus] = useState<
        'unknown' | 'granted' | 'denied' | 'blocked'
    >('unknown');

    // ---------- Refs ----------
    const session = useRef(newSessionToken());
    const searchAbort = useRef<AbortController | null>(null);
    const geoAbort = useRef<AbortController | null>(null);
    const reqId = useRef(0);
    const skipNextRegion = useRef(false);
    const ready = useRef(false);
    const lift = useSharedValue(0);

    const start = initial ?? null;

    // ============================================================
    // 🔧 HELPER 1: Pastikan GPS aktif (prompt kalau mati)
    // ============================================================
    const ensureGpsEnabled = async (): Promise<boolean> => {
        console.log('[StoreLocationPicker] 🔵 Cek GPS aktif...');

        try {
            const enabled = await Location.hasServicesEnabledAsync();
            console.log('[StoreLocationPicker] GPS enabled?', enabled);

            // ✅ Update state
            setGpsEnabled(enabled);

            if (enabled) return true;

            // GPS mati
            if (Platform.OS === 'android') {
                console.log(
                    '[StoreLocationPicker] 🟡 GPS mati → prompt aktifkan...'
                );

                return new Promise<boolean>((resolve) => {
                    Alert.alert(
                        'GPS Belum Aktif',
                        'Nyalakan GPS untuk menentukan lokasi tokomu.',
                        [
                            {
                                text: 'Batal',
                                style: 'cancel',
                                onPress: () => resolve(false),
                            },
                            {
                                text: 'Nyalakan GPS',
                                onPress: async () => {
                                    try {
                                        await Location.enableNetworkProviderAsync();

                                        // Tunggu sejenak supaya sistem selesai
                                        await new Promise((r) =>
                                            setTimeout(r, 500)
                                        );

                                        const nowEnabled =
                                            await Location.hasServicesEnabledAsync();
                                        console.log(
                                            '[StoreLocationPicker] GPS after prompt:',
                                            nowEnabled
                                        );

                                        // ✅ Update state
                                        setGpsEnabled(nowEnabled);
                                        resolve(nowEnabled);
                                    } catch (err: any) {
                                        console.warn(
                                            '[StoreLocationPicker] ❌ Gagal aktifkan GPS:',
                                            err
                                        );
                                        setGpsEnabled(false);
                                        resolve(false);
                                    }
                                },
                            },
                        ],
                        { cancelable: false }
                    );
                });
            } else {
                // iOS
                console.log(
                    '[StoreLocationPicker] 🟡 GPS mati (iOS) → Settings'
                );

                return new Promise<boolean>((resolve) => {
                    Alert.alert(
                        'GPS Belum Aktif',
                        'Nyalakan lokasi di Pengaturan untuk menentukan lokasi tokomu.',
                        [
                            {
                                text: 'Batal',
                                style: 'cancel',
                                onPress: () => resolve(false),
                            },
                            {
                                text: 'Buka Pengaturan',
                                onPress: () => {
                                    Linking.openSettings();
                                    resolve(false);
                                },
                            },
                        ],
                        { cancelable: false }
                    );
                });
            }
        } catch (err: any) {
            console.warn('[StoreLocationPicker] ❌ Cek GPS error:', err);
            setGpsEnabled(false);
            return false;
        }
    };

    // ============================================================
    // 🔧 HELPER 2: Pastikan izin lokasi (prompt kalau belum)
    // ============================================================
    const ensureLocationPermission = async (): Promise<boolean> => {
        console.log('[StoreLocationPicker] 🔵 Cek izin lokasi...');

        try {
            const current = await Location.getForegroundPermissionsAsync();
            console.log(
                '[StoreLocationPicker] Status izin:',
                current.status,
                '| canAskAgain:',
                current.canAskAgain
            );

            if (current.granted) {
                setPermissionStatus('granted');
                return true;
            }

            if (!current.canAskAgain) {
                setPermissionStatus('blocked');
                console.warn('[StoreLocationPicker] ⚠️ Izin diblokir');
                return false;
            }

            console.log('[StoreLocationPicker] 🟡 Prompt izin lokasi...');
            const asked = await Location.requestForegroundPermissionsAsync();

            if (asked.granted) {
                console.log('[StoreLocationPicker] ✅ Izin diberikan');
                setPermissionStatus('granted');
                return true;
            }

            console.log('[StoreLocationPicker] ❌ Izin ditolak');
            setPermissionStatus('denied');
            return false;
        } catch (err: any) {
            console.warn('[StoreLocationPicker] ❌ Izin error:', err);
            setPermissionStatus('denied');
            return false;
        }
    };

    // ============================================================
    // 🔧 HELPER 3: Ambil posisi user
    // ============================================================
    const getCurrentPosition = async (
        silent = false
    ): Promise<LatLng | null> => {
        setLocating(true);
        try {
            const pos = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const c = {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
            };
            console.log('[StoreLocationPicker] 📍 Posisi user:', c);

            // ✅ Simpan userPos → banner GPS hilang
            setUserPos(c);
            return c;
        } catch (err: any) {
            console.warn('[StoreLocationPicker] ❌ Gagal ambil posisi:', err);
            if (!silent) {
                setSearchError(err?.message ?? 'Gagal mengambil lokasi');
            }
            return null;
        } finally {
            setLocating(false);
        }
    };

    // ============================================================
    // 🔧 HELPER 4: Pindah peta dengan aman (tunggu map ready)
    // ============================================================
    const animateToLocation = async (c: LatLng) => {
        // Tunggu supaya MapView siap (hindari animateToRegion tidak jalan)
        await new Promise((r) => setTimeout(r, 300));

        console.log(
            '[StoreLocationPicker] 🎯 Pindah peta ke:',
            c.latitude.toFixed(6),
            c.longitude.toFixed(6)
        );

        skipNextRegion.current = false;
        mapRef.current?.animateToRegion(
            {
                ...c,
                latitudeDelta: DELTA_NEAR,
                longitudeDelta: DELTA_NEAR,
            },
            800
        );
    };

    // ============================================================
    // 🚀 FULL FLOW: GPS → Izin → Posisi → Pindah Peta
    // ============================================================
    const bootstrapLocation = async (silent = false) => {
        console.log(
            '[StoreLocationPicker] 🚀 Bootstrap lokasi, silent:',
            silent
        );

        // 1. Pastikan GPS aktif
        const gpsOk = await ensureGpsEnabled();
        if (!gpsOk) {
            console.warn('[StoreLocationPicker] ⚠️ GPS belum aktif → stop');
            if (!silent) {
                setSearchError('GPS belum aktif. Nyalakan lokasi di perangkat.');
            }
            return;
        }

        // 2. Pastikan izin granted
        const granted = await ensureLocationPermission();
        if (!granted) {
            if (!silent) {
                setSearchError(
                    permissionStatus === 'blocked'
                        ? 'Izin lokasi diblokir. Aktifkan di pengaturan aplikasi.'
                        : 'Izin lokasi diperlukan untuk menampilkan lokasi toko.'
                );
            }
            return;
        }

        // 3. Ambil posisi
        const c = await getCurrentPosition(silent);
        if (!c) return;

        // 4. Pindah peta
        await animateToLocation(c);

        // 5. Set picked
        setPicked((p) => p ?? { coords: c, name: '', address: '' });
    };

    // ============================================================
    // RESET saat modal dibuka
    // ============================================================
    useEffect(() => {
        if (!visible) return;

        console.log('═══════════════════════════════════════════');
        console.log('🔵 [StoreLocationPicker] MODAL DIBUKA');
        console.log('   initial:', start);
        console.log('   has initial?', !!start);
        console.log('═══════════════════════════════════════════');

        ready.current = false;
        setQuery('');
        setSuggestions([]);
        setSearchError(null);
        setGpsEnabled(null);
        setUserPos(null);
        session.current = newSessionToken();

        setPicked(
            start
                ? { coords: start, name: '', address: initialAddress ?? '' }
                : null
        );

        // ✅ Cek izin + GPS saat modal dibuka
        (async () => {
            try {
                // 1. Cek izin (tanpa prompt)
                const perm = await Location.getForegroundPermissionsAsync();

                console.log(
                    '[StoreLocationPicker] Status izin awal:',
                    perm.status,
                    '| canAskAgain:',
                    perm.canAskAgain
                );

                if (perm.granted) {
                    setPermissionStatus('granted');
                } else if (!perm.canAskAgain) {
                    setPermissionStatus('blocked');
                } else {
                    setPermissionStatus('denied');
                }

                // 2. Cek GPS langsung
                const gpsOk = await Location.hasServicesEnabledAsync();
                setGpsEnabled(gpsOk);
                console.log('[StoreLocationPicker] GPS enabled awal?', gpsOk);

                // 3. Ambil keputusan
                if (!start) {
                    // Tidak ada initial → bootstrap (prompt GPS + izin)
                    console.log(
                        '[StoreLocationPicker] ✅ Tidak ada initial → bootstrap'
                    );
                    void bootstrapLocation(true);
                } else {
                    // Ada initial → fokus ke lokasi toko
                    console.log(
                        '[StoreLocationPicker] Ada initial → fokus ke lokasi toko'
                    );
                    setTimeout(() => {
                        mapRef.current?.animateToRegion(
                            {
                                ...start,
                                latitudeDelta: DELTA_NEAR,
                                longitudeDelta: DELTA_NEAR,
                            },
                            600
                        );
                    }, 400);
                }
            } catch (err: any) {
                console.warn('[StoreLocationPicker] ❌ Error:', err);
            }
        })();

        const t = setTimeout(() => (ready.current = true), 600);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    // ============================================================
    // Autocomplete (debounce 350 ms)
    // ============================================================
    useEffect(() => {
        if (!visible) return;
        const q = query.trim();
        if (q.length < 3) {
            setSuggestions([]);
            setSearching(false);
            return;
        }
        const t = setTimeout(async () => {
            searchAbort.current?.abort();
            const ctrl = new AbortController();
            searchAbort.current = ctrl;
            setSearching(true);
            setSearchError(null);
            try {
                const list = await autocomplete(q, session.current, {
                    bias:
                        picked?.coords ??
                        userPos ??
                        start ??
                        DEFAULT_CENTER,
                    signal: ctrl.signal,
                });
                if (!ctrl.signal.aborted) setSuggestions(list);
            } catch (e: any) {
                if (e?.name !== 'AbortError') {
                    setSearchError(e?.message ?? 'Gagal mencari alamat');
                }
            } finally {
                if (!ctrl.signal.aborted) setSearching(false);
            }
        }, 350);
        return () => clearTimeout(t);
    }, [query, visible]);

    // Cleanup abort
    useEffect(
        () => () => {
            searchAbort.current?.abort();
            geoAbort.current?.abort();
        },
        []
    );

    // ============================================================
    // Pilih saran → pindah peta ke koordinatnya
    // ============================================================
    const pickSuggestion = async (s: PlaceSuggestion) => {
        Keyboard.dismiss();
        setSuggestions([]);
        setQuery(s.main);
        setResolving(true);
        try {
            const d = await placeDetails(s.placeId, session.current);
            session.current = newSessionToken();
            skipNextRegion.current = true;
            setPicked({
                coords: d.coords,
                name: d.name || s.main,
                address: d.address || s.description,
            });
            mapRef.current?.animateToRegion(
                {
                    ...d.coords,
                    latitudeDelta: DELTA_NEAR,
                    longitudeDelta: DELTA_NEAR,
                },
                600
            );
        } catch (e: any) {
            setSearchError(e?.message ?? 'Gagal mengambil lokasi');
        } finally {
            setResolving(false);
        }
    };

    // ============================================================
    // Tombol "Lokasi Saya" — manual
    // ============================================================
    const goToMyLocation = async (silent = false) => {
        console.log('[StoreLocationPicker] 🎯 Tombol "Lokasi Saya"');

        // 1. Pastikan GPS
        const gpsOk = await ensureGpsEnabled();
        if (!gpsOk) {
            console.log('[StoreLocationPicker] ⚠️ GPS belum aktif');
            return;
        }

        // 2. Pastikan izin
        if (permissionStatus !== 'granted') {
            const granted = await ensureLocationPermission();
            if (!granted) {
                if (!silent && permissionStatus === 'blocked') {
                    Alert.alert(
                        'Izin Lokasi Diblokir',
                        'Aktifkan izin lokasi di pengaturan aplikasi.',
                        [
                            { text: 'Batal', style: 'cancel' },
                            {
                                text: 'Buka Pengaturan',
                                onPress: () => Linking.openSettings(),
                            },
                        ]
                    );
                }
                return;
            }
        }

        // 3. Ambil posisi
        const c = await getCurrentPosition(silent);
        if (!c) return;

        // 4. Pindah peta
        await animateToLocation(c);

        // 5. Set picked (paksa update biar re-resolve alamat)
        setPicked({ coords: c, name: '', address: '' });
    };

    // ============================================================
    // Peta selesai digeser → alamat dari titik tengah
    // ============================================================
    const resolve = async (c: LatLng) => {
        const id = ++reqId.current;
        geoAbort.current?.abort();
        const ctrl = new AbortController();
        geoAbort.current = ctrl;
        setResolving(true);
        setPicked({ coords: c, name: '', address: '' });
        try {
            const r = await reverseGeocode(c, ctrl.signal);
            if (id !== reqId.current) return;
            setPicked({ coords: c, name: r.name, address: r.address });
        } catch {
            if (id !== reqId.current) return;
            setPicked({
                coords: c,
                name: 'Lokasi dipilih',
                address: `${c.latitude.toFixed(6)}, ${c.longitude.toFixed(6)}`,
            });
        } finally {
            if (id === reqId.current) setResolving(false);
        }
    };

    const onRegionComplete = (r: Region) => {
        lift.value = withSpring(0, { damping: 14 });
        if (!ready.current) return;
        const c = { latitude: r.latitude, longitude: r.longitude };
        if (skipNextRegion.current) {
            skipNextRegion.current = false;
            return;
        }
        void resolve(c);
    };

    const pinStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: -PIN_HEIGHT / 2 + lift.value }],
    }));

    const region: Region = {
        ...(start ?? DEFAULT_CENTER),
        latitudeDelta: start ? DELTA_NEAR : DELTA_FAR,
        longitudeDelta: start ? DELTA_NEAR : DELTA_FAR,
    };

    const canConfirm = !!picked && !resolving && !!picked.address;

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <Modal
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={s.root}>
                <MapView
                    ref={mapRef}
                    style={StyleSheet.absoluteFill}
                    provider={
                        Platform.OS === 'web' ? undefined : PROVIDER_GOOGLE
                    }
                    customMapStyle={customMapStyle}
                    initialRegion={region}
                    showsUserLocation={permissionStatus === 'granted'}
                    showsMyLocationButton={false}
                    toolbarEnabled={false}
                    rotateEnabled={false}
                    onMapReady={() => {
                        console.log('[StoreLocationPicker] 🗺️ Map ready');
                    }}
                    onPanDrag={() => {
                        Keyboard.dismiss();
                        setSuggestions([]);
                        lift.value = withSpring(-14, { damping: 14 });
                    }}
                    onRegionChangeComplete={onRegionComplete}
                />

                {/* Pin tengah */}
                <View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFill, s.pinWrap]}
                >
                    <Animated.View
                        style={[{ alignItems: 'center' }, pinStyle]}
                    >
                        <View style={s.bubble}>
                            <View style={s.bubbleIcon}>
                                <Ionicons
                                    name="storefront"
                                    size={15}
                                    color="#fff"
                                />
                            </View>
                            <Text style={s.bubbleText}>Lokasi toko</Text>
                        </View>
                        <View style={s.stem} />
                    </Animated.View>
                    <View style={s.shadowDot} />
                </View>

                {/* Bar atas: kembali + kolom cari */}
                <View style={[s.top, { top: insets.top + 12 }]}>
                    <View style={s.searchRow}>
                        <Pressable
                            onPress={onClose}
                            style={s.circle}
                            accessibilityLabel="Tutup"
                        >
                            <Ionicons
                                name="arrow-back"
                                size={22}
                                color={COLORS.ink}
                            />
                        </Pressable>
                        <View style={s.searchBox}>
                            <Ionicons
                                name="search"
                                size={18}
                                color={COLORS.muted}
                            />
                            <TextInput
                                style={s.searchInput}
                                placeholder="Cari alamat atau nama tempat"
                                placeholderTextColor={COLORS.placeholder}
                                value={query}
                                onChangeText={setQuery}
                                returnKeyType="search"
                                autoCorrect={false}
                            />
                            {searching ? (
                                <ActivityIndicator
                                    size="small"
                                    color={COLORS.primary}
                                />
                            ) : !!query ? (
                                <Pressable
                                    onPress={() => {
                                        setQuery('');
                                        setSuggestions([]);
                                    }}
                                    hitSlop={8}
                                >
                                    <Ionicons
                                        name="close-circle"
                                        size={18}
                                        color={COLORS.muted}
                                    />
                                </Pressable>
                            ) : null}
                        </View>
                    </View>

                    {(suggestions.length > 0 ||
                        !!searchError ||
                        !hasPlacesKey()) && (
                            <View style={s.dropdown}>
                                <ScrollView
                                    keyboardShouldPersistTaps="handled"
                                    style={{ maxHeight: 280 }}
                                >
                                    {!hasPlacesKey() && (
                                        <Text style={s.errorText}>
                                            EXPO_PUBLIC_GOOGLE_MAPS_API_KEY belum
                                            diatur di .env (restart Expo setelah
                                            mengubahnya).
                                        </Text>
                                    )}
                                    {!!searchError && (
                                        <Text style={s.errorText}>
                                            {searchError}
                                        </Text>
                                    )}
                                    {suggestions.map((sg, i) => (
                                        <Pressable
                                            key={sg.placeId}
                                            onPress={() => pickSuggestion(sg)}
                                            style={[
                                                s.sugRow,
                                                i > 0 && s.sugBorder,
                                            ]}
                                        >
                                            <Ionicons
                                                name="location-outline"
                                                size={20}
                                                color={COLORS.primary}
                                            />
                                            <View style={{ flex: 1 }}>
                                                <Text
                                                    style={s.sugMain}
                                                    numberOfLines={1}
                                                >
                                                    {sg.main}
                                                </Text>
                                                {!!sg.secondary && (
                                                    <Text
                                                        style={s.sugSub}
                                                        numberOfLines={2}
                                                    >
                                                        {sg.secondary}
                                                    </Text>
                                                )}
                                            </View>
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                </View>

                {/* Tombol lokasi saya */}
                <View style={[s.locate, { bottom: 290 + insets.bottom }]}>
                    <Pressable
                        onPress={() => goToMyLocation(false)}
                        style={s.circle}
                        accessibilityLabel="Lokasi saya"
                    >
                        {locating ? (
                            <ActivityIndicator
                                size="small"
                                color={COLORS.primary}
                            />
                        ) : (
                            <Ionicons
                                name="locate"
                                size={22}
                                color={COLORS.primary}
                            />
                        )}
                    </Pressable>
                </View>

                {/* Panel bawah */}
                <View
                    style={[
                        s.panel,
                        { paddingBottom: insets.bottom + 16 },
                    ]}
                >
                    <Text style={s.panelTitle}>Set lokasi toko</Text>
                    <Text style={s.panelHint}>
                        Geser peta sampai pin tepat di depan tokomu.
                    </Text>

                    {/* ✅ Banner: GPS mati */}
                    {gpsEnabled === false && (
                        <Pressable
                            style={s.permBanner}
                            onPress={() => goToMyLocation(false)}
                        >
                            <Ionicons
                                name="navigate-outline"
                                size={18}
                                color="#b3261e"
                            />
                            <Text style={s.permText}>
                                GPS belum aktif. Ketuk untuk menyalakan.
                            </Text>
                            <Ionicons
                                name="chevron-forward"
                                size={16}
                                color="#b3261e"
                            />
                        </Pressable>
                    )}

                    {/* ✅ Banner: izin denied */}
                    {permissionStatus === 'denied' && (
                        <Pressable
                            style={s.permBanner}
                            onPress={() => goToMyLocation(false)}
                        >
                            <Ionicons
                                name="location-outline"
                                size={18}
                                color="#b3261e"
                            />
                            <Text style={s.permText}>
                                Izin lokasi belum diberikan. Ketuk untuk
                                mengizinkan.
                            </Text>
                            <Ionicons
                                name="chevron-forward"
                                size={16}
                                color="#b3261e"
                            />
                        </Pressable>
                    )}

                    {/* ✅ Banner: izin blocked */}
                    {permissionStatus === 'blocked' && (
                        <Pressable
                            style={s.permBanner}
                            onPress={() => Linking.openSettings()}
                        >
                            <Ionicons
                                name="warning-outline"
                                size={18}
                                color="#b3261e"
                            />
                            <Text style={s.permText}>
                                Izin lokasi diblokir. Ketuk untuk buka
                                pengaturan.
                            </Text>
                            <Ionicons
                                name="chevron-forward"
                                size={16}
                                color="#b3261e"
                            />
                        </Pressable>
                    )}

                    <View style={s.place}>
                        <View style={s.placeIcon}>
                            <Ionicons
                                name="storefront"
                                size={18}
                                color="#fff"
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.placeName} numberOfLines={1}>
                                {resolving
                                    ? 'Mencari alamat…'
                                    : picked?.name || 'Belum ada lokasi'}
                            </Text>
                            <Text style={s.placeAddr} numberOfLines={2}>
                                {resolving
                                    ? ' '
                                    : picked?.address ||
                                    'Cari alamat atau geser peta'}
                            </Text>
                            {!!picked && (
                                <Text style={s.coord}>
                                    {picked.coords.latitude.toFixed(6)},{' '}
                                    {picked.coords.longitude.toFixed(6)}
                                </Text>
                            )}
                        </View>
                        {resolving && (
                            <ActivityIndicator
                                size="small"
                                color={COLORS.primary}
                            />
                        )}
                    </View>

                    <Pressable
                        disabled={!canConfirm}
                        onPress={() =>
                            picked &&
                            onConfirm({
                                latitude: picked.coords.latitude,
                                longitude: picked.coords.longitude,
                                address: picked.address,
                                name: picked.name,
                            })
                        }
                        style={[
                            s.confirm,
                            !canConfirm && { opacity: 0.5 },
                        ]}
                    >
                        <Text style={s.confirmText}>
                            Konfirmasi lokasi toko
                        </Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

// ============================================================
// STYLES
// ============================================================
const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#fff' },
    pinWrap: { alignItems: 'center', justifyContent: 'center' },
    bubble: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 6,
        paddingRight: 16,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#fff',
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
    },
    bubbleIcon: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bubbleText: { fontWeight: '700', fontSize: 15, color: COLORS.ink },
    stem: {
        width: 3,
        height: PIN_HEIGHT - 44,
        borderRadius: 2,
        backgroundColor: COLORS.primary,
    },
    shadowDot: {
        position: 'absolute',
        width: 10,
        height: 4,
        borderRadius: 5,
        backgroundColor: 'rgba(0,0,0,0.25)',
    },

    top: { position: 'absolute', left: 16, right: 16 },
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    circle: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
    },
    searchBox: {
        flex: 1,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        fontWeight: '500',
        color: COLORS.ink,
        paddingVertical: 0,
    },

    dropdown: {
        marginTop: 8,
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
    },
    sugRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    sugBorder: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: COLORS.line,
    },
    sugMain: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
    sugSub: {
        fontSize: 12,
        color: COLORS.muted,
        marginTop: 2,
        lineHeight: 17,
    },
    errorText: {
        padding: 14,
        fontSize: 13,
        color: '#b3261e',
        lineHeight: 18,
    },

    locate: { position: 'absolute', right: 16 },

    panel: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 18,
        gap: 12,
        elevation: 12,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 10,
    },
    panelTitle: { fontSize: 20, fontWeight: '800', color: COLORS.ink },
    panelHint: { fontSize: 13, color: COLORS.muted, marginTop: -6 },

    permBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#fdecea',
    },
    permText: {
        flex: 1,
        fontSize: 13,
        color: '#b3261e',
        lineHeight: 18,
        fontWeight: '600',
    },

    place: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 16,
        backgroundColor: COLORS.primaryTint,
    },
    placeIcon: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeName: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
    placeAddr: {
        fontSize: 13,
        color: COLORS.muted,
        marginTop: 2,
        lineHeight: 18,
    },
    coord: { fontSize: 11, color: COLORS.muted, marginTop: 4 },
    confirm: {
        height: 54,
        borderRadius: 27,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    confirmText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});