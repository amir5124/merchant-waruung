import { api, saveToken } from '../../lib/api';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COLORS = {
    primary: '#1477b8',
    secondary: '#b45309',
    bg: '#ffffff',
    card: '#ffffff',
    border: '#d9e2ec',
    textDark: '#12222f',
    textMuted: '#5b6b7b',
    placeholder: '#7b8794',
    stepOff: '#d5dde5',
};

type AccountRole = 'customer' | 'merchant';

export default function RegisterScreen() {
    // Layar ini khusus pendaftaran merchant
    const role: AccountRole = 'merchant';
    const isMerchant = true;

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [agree, setAgree] = useState(false);
    const [loading, setLoading] = useState(false);

    // State untuk alert bottom sheet
    const [errorModalVisible, setErrorModalVisible] = useState(false);
    const [errorTitle, setErrorTitle] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const showErrorModal = (title: string, message: string) => {
        setErrorTitle(title);
        setErrorMessage(message);
        // Di iOS, modal baru tidak bisa muncul saat modal loading masih menutup
        setTimeout(() => setErrorModalVisible(true), Platform.OS === 'ios' ? 400 : 0);
    };

    const handleSignUp = async () => {
        // Validasi dasar
        if (!agree) {
            showErrorModal('Belum Disetujui', 'Kamu harus menyetujui Syarat & Ketentuan dulu.');
            return;
        }
        if (!name.trim() || !email.trim() || !password.trim()) {
            showErrorModal(
                'Data belum lengkap',
                `${isMerchant ? 'Nama toko' : 'Nama'}, email, dan kata sandi wajib diisi.`
            );
            return;
        }
        if (isMerchant && !phone.trim()) {
            showErrorModal('Data belum lengkap', 'Nomor HP wajib diisi untuk akun merchant.');
            return;
        }
        if (password.length < 6) {
            showErrorModal('Kata Sandi Terlalu Pendek', 'Kata sandi minimal 6 karakter.');
            return;
        }

        setLoading(true);
        console.log('[REGISTER] Mulai proses daftar:', email.trim().toLowerCase(), 'role:', role);

        try {
            // 1. Register ke backend
            console.log('[REGISTER] Request ke /api/auth/register...');
            const res = await api.register({
                email: email.trim().toLowerCase(),
                password,
                full_name: name.trim(),
                role,
            });
            console.log('[REGISTER] Response berhasil:', {
                userId: res.userId,
                role: res.role,
                tokenLength: res.token?.length,
            });

            // 2. Simpan JWT token
            await saveToken(res.token);
            console.log('[REGISTER] JWT token tersimpan');

            // 3. Update nomor HP kalau diisi (gagal tidak menghalangi registrasi)
            if (phone.trim()) {
                try {
                    await api.updateProfile({ phone: phone.trim() });
                    console.log('[REGISTER] Nomor HP tersimpan');
                } catch (err: any) {
                    console.warn('[REGISTER] Gagal simpan nomor HP:', err.message);
                }
            }

            // 4. Cache profil (TERPISAH dari registrasi: kalau gagal,
            //    akun tetap berhasil dibuat)
            try {
                const profile = await api.me();
                await AsyncStorage.setItem('profile', JSON.stringify(profile));
                console.log('[REGISTER] Profil tersimpan di AsyncStorage');
            } catch (postErr: any) {
                console.warn('[REGISTER] Gagal cache profil (registrasi tetap lanjut):', postErr?.message);
            }

            // 5. Redirect sesuai role
            // 5. Redirect ke tabs (merchant pakai tab utama yang sama)
            console.log('[REGISTER] Registrasi sukses, redirect ke tabs');
            router.replace('/(tabs)' as any);
        } catch (err: any) {
            console.error('[REGISTER] Gagal:', err.message);
            showErrorModal('Gagal Daftar', err.message || 'Terjadi kesalahan, coba lagi.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Top bar: tombol kembali + indikator langkah */}
                    <View style={styles.topBar}>
                        <TouchableOpacity
                            style={styles.backButton}
                            activeOpacity={0.7}
                            onPress={() => (router.canGoBack() ? router.back() : router.replace('/login' as any))}
                        >
                            <Ionicons name="chevron-back" size={22} color={COLORS.textDark} />
                        </TouchableOpacity>

                        <View style={styles.stepWrapper}>
                            <View style={styles.stepBars}>
                                <View style={[styles.stepBar, styles.stepBarActive]} />
                                <View style={styles.stepBar} />
                            </View>
                            <Text style={styles.stepText}>Langkah 1 dari 2</Text>
                        </View>
                    </View>

                    <View style={styles.header}>
                        <Text style={styles.title}>Buat akun merchant</Text>
                        <Text style={styles.subtitle}>
                            Daftarkan tokomu dan mulai terima pesanan dari pelanggan sekitar.
                        </Text>
                    </View>

                    {/* Nama */}
                    <View style={styles.field}>
                        <Text style={styles.label}>{isMerchant ? 'Nama toko' : 'Nama lengkap'}</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons
                                name={isMerchant ? 'storefront-outline' : 'person-outline'}
                                size={22}
                                color={COLORS.textMuted}
                            />
                            <TextInput
                                style={styles.inputInner}
                                placeholder={isMerchant ? 'Nama toko kamu' : 'Nama kamu'}
                                placeholderTextColor={COLORS.placeholder}
                                value={name}
                                onChangeText={setName}
                                editable={!loading}
                            />
                        </View>
                    </View>

                    {/* Nomor HP */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Nomor HP</Text>
                        <View style={styles.inputWrapper}>
                            <Text style={styles.phonePrefixText}>+62</Text>
                            <View style={styles.phoneDivider} />
                            <TextInput
                                style={[styles.inputInner, { marginLeft: 0 }]}
                                placeholder="81234567890"
                                placeholderTextColor={COLORS.placeholder}
                                keyboardType="phone-pad"
                                value={phone}
                                onChangeText={setPhone}
                                editable={!loading}
                            />
                        </View>
                    </View>

                    {/* Email */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Email</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="mail-outline" size={22} color={COLORS.textMuted} />
                            <TextInput
                                style={styles.inputInner}
                                placeholder="contoh@gmail.com"
                                placeholderTextColor={COLORS.placeholder}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                value={email}
                                onChangeText={setEmail}
                                editable={!loading}
                            />
                        </View>
                    </View>

                    {/* Password */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Kata sandi</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="lock-closed-outline" size={22} color={COLORS.textMuted} />
                            <TextInput
                                style={styles.inputInner}
                                placeholder="Buat kata sandi"
                                placeholderTextColor={COLORS.placeholder}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                value={password}
                                onChangeText={setPassword}
                                editable={!loading}
                            />
                            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                                <Ionicons
                                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                    size={22}
                                    color={COLORS.textMuted}
                                />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.hint}>Minimal 6 karakter</Text>
                    </View>

                    {/* Checkbox S&K */}
                    <TouchableOpacity
                        style={styles.agreeRow}
                        activeOpacity={0.8}
                        onPress={() => setAgree((v) => !v)}
                    >
                        <View style={[styles.checkbox, agree && styles.checkboxChecked]}>
                            {agree && <Ionicons name="checkmark" size={16} color="#ffffff" />}
                        </View>
                        <Text style={styles.agreeText}>
                            Saya setuju dengan{' '}
                            <Text style={styles.agreeLink} onPress={() => router.push('/')}>
                                Syarat & Ketentuan
                            </Text>
                            {isMerchant ? ' Waruung Merchant' : ' Waruung'}
                        </Text>
                    </TouchableOpacity>

                    {/* Tombol Daftar (loading pakai modal) */}
                    <TouchableOpacity
                        style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
                        activeOpacity={0.85}
                        onPress={handleSignUp}
                        disabled={loading}
                    >
                        <Text style={styles.primaryButtonText}>Daftar</Text>
                    </TouchableOpacity>

                    {/* Spacer supaya footer menempel di bawah */}
                    <View style={{ flex: 1, minHeight: 32 }} />

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>Sudah punya akun? </Text>
                        <TouchableOpacity onPress={() => router.push('/login' as any)}>
                            <Text style={styles.footerLink}>Masuk</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* ── MODAL LOADING ── */}
            <Modal
                animationType="fade"
                transparent
                visible={loading}
                onRequestClose={() => { }}
            >
                <View style={styles.loadingOverlay}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                    </View>
                </View>
            </Modal>

            {/* ── ALERT BOTTOM SHEET ── */}
            <Modal
                visible={errorModalVisible}
                transparent
                animationType="slide"
                statusBarTranslucent
                onRequestClose={() => setErrorModalVisible(false)}
            >
                <View style={styles.sheetOverlay}>
                    <TouchableWithoutFeedback onPress={() => setErrorModalVisible(false)}>
                        <View style={{ flex: 1 }} />
                    </TouchableWithoutFeedback>

                    <View style={styles.sheetContainer}>
                        <TouchableOpacity
                            onPress={() => setErrorModalVisible(false)}
                            style={styles.sheetCloseButton}
                        >
                            <Ionicons name="close" size={24} color="#1c1c1c" />
                        </TouchableOpacity>

                        <Text style={styles.sheetTitle}>{errorTitle}</Text>
                        <Text style={styles.sheetDescription}>{errorMessage}</Text>

                        <TouchableOpacity
                            onPress={() => setErrorModalVisible(false)}
                            style={styles.sheetButton}
                        >
                            <Text style={styles.sheetButtonText}>Mengerti</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 22,
        paddingTop: 16,
        paddingBottom: 24,
    },

    // ── Top bar ──
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 28,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepWrapper: { flexDirection: 'row', alignItems: 'center' },
    stepBars: { flexDirection: 'row', gap: 5, marginRight: 10 },
    stepBar: { width: 24, height: 4, borderRadius: 2, backgroundColor: COLORS.stepOff },
    stepBarActive: { backgroundColor: COLORS.primary },
    stepText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },

    // ── Header ──
    header: { marginBottom: 24 },
    title: {
        fontSize: 30,
        fontWeight: '800',
        color: COLORS.textDark,
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subtitle: { fontSize: 15, color: COLORS.textMuted, lineHeight: 22 },

    // ── Field ──
    field: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '700', color: COLORS.textDark, marginBottom: 8 },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.card,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 52,
    },
    inputInner: {
        flex: 1,
        marginLeft: 12,
        fontSize: 15,
        color: COLORS.textDark,
        paddingVertical: 0,
    },
    phonePrefixText: { fontSize: 15, color: COLORS.textDark, fontWeight: '700' },
    phoneDivider: {
        width: 1,
        height: 22,
        backgroundColor: COLORS.border,
        marginHorizontal: 12,
    },
    hint: { fontSize: 12, color: COLORS.textMuted, marginTop: 8 },

    // ── Checkbox ──
    agreeRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4, marginBottom: 22 },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: '#9aa5b1',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        marginTop: 1,
    },
    checkboxChecked: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    agreeText: { fontSize: 14, color: COLORS.textMuted, flexShrink: 1, lineHeight: 22 },
    agreeLink: { fontWeight: '700', color: COLORS.secondary },

    // ── Button ──
    primaryButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 30,
        height: 52,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primaryButtonDisabled: { opacity: 0.6 },
    primaryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

    // ── Footer ──
    footer: { flexDirection: 'row', justifyContent: 'center', paddingBottom: 8 },
    footerText: { fontSize: 14, color: COLORS.textMuted },
    footerLink: { fontSize: 14, fontWeight: '700', color: COLORS.secondary },

    // ── Style Loading Modal ──
    loadingOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        width: 80,
        height: 80,
        backgroundColor: '#fff',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },

    // ── Style Alert Bottom Sheet ──
    sheetOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 32,
        paddingBottom: 50,
        width: '100%',
        position: 'relative',
    },
    sheetCloseButton: {
        position: 'absolute',
        right: 24,
        top: -64,
        backgroundColor: '#fff',
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 4,
        elevation: 5,
    },
    sheetTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: COLORS.textDark,
        marginBottom: 10,
    },
    sheetDescription: {
        fontSize: 15,
        color: '#555555',
        lineHeight: 22,
        marginBottom: 32,
    },
    sheetButton: {
        width: '100%',
        borderRadius: 100,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: COLORS.primary,
    },
    sheetButtonText: {
        color: COLORS.primary,
        fontWeight: '700',
        fontSize: 16,
    },
});