// app/modal.tsx
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { merchantService } from '../services/merchantService';
import { Button } from '../components/Button';
import { InputField } from '../components/InputField';

export default function StoreModal() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        store_name: '',
        description: '',
        address: '',
        latitude: undefined as number | undefined,
        longitude: undefined as number | undefined,
        is_open: false,
    });

    useEffect(() => {
        (async () => {
            try {
                const store = await merchantService.getMyStore();
                if (store) {
                    setForm({
                        store_name: store.store_name ?? '',
                        description: store.description ?? '',
                        address: store.address ?? '',
                        latitude: store.latitude ?? undefined,
                        longitude: store.longitude ?? undefined,
                        is_open: store.is_open ?? false,
                    });
                }
            } catch (e: any) {
                Alert.alert('Gagal', e.message);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleUseCurrentLocation = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Izin lokasi ditolak');
            return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        setForm((f) => ({
            ...f,
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
        }));
        Alert.alert(
            'Lokasi diambil',
            `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`
        );
    };

    const handleSave = async () => {
        if (!form.store_name.trim()) {
            Alert.alert('Nama toko wajib diisi');
            return;
        }
        setSaving(true);
        try {
            await merchantService.upsertStore({
                store_name: form.store_name,
                description: form.description || undefined,
                address: form.address || undefined,
                latitude: form.latitude,
                longitude: form.longitude,
                is_open: form.is_open,
            });
            Alert.alert('Berhasil', 'Profil toko disimpan', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (e: any) {
            Alert.alert('Gagal', e.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                contentContainerStyle={styles.container}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.title}>Profil Toko</Text>

                <InputField
                    label="Nama Toko *"
                    placeholder="Warung Bu Siti"
                    value={form.store_name}
                    onChangeText={(v) => setForm((f) => ({ ...f, store_name: v }))}
                />

                <InputField
                    label="Deskripsi"
                    placeholder="Deskripsi singkat toko"
                    value={form.description}
                    onChangeText={(v) => setForm((f) => ({ ...f, description: v }))}
                    multiline
                />

                <InputField
                    label="Alamat"
                    placeholder="Jl. Merdeka No. 1"
                    value={form.address}
                    onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
                    multiline
                />

                <Button
                    title="📍 Gunakan Lokasi Saat Ini"
                    variant="secondary"
                    onPress={handleUseCurrentLocation}
                    style={{ marginBottom: 8 }}
                />
                {form.latitude != null && form.longitude != null ? (
                    <Text style={styles.coord}>
                        {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                    </Text>
                ) : null}

                <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Toko Buka</Text>
                    <Switch
                        value={form.is_open}
                        onValueChange={(v) => setForm((f) => ({ ...f, is_open: v }))}
                    />
                </View>

                <Button
                    title="Simpan"
                    onPress={handleSave}
                    loading={saving}
                    style={{ marginTop: 24 }}
                />
                <Button
                    title="Batal"
                    variant="ghost"
                    onPress={() => router.back()}
                    style={{ marginTop: 8 }}
                />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    container: { padding: 20, paddingBottom: 40 },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 20,
    },
    coord: {
        fontSize: 12,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 8,
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 20,
        padding: 14,
        backgroundColor: '#f9fafb',
        borderRadius: 10,
    },
    switchLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
});