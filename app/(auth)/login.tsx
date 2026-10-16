// app/(auth)/login.tsx
import { api, saveToken, getToken } from '../../lib/api';
import { AntDesign, Ionicons } from '@expo/vector-icons';
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
    primary: '#40a3ea',
    secondary: '#e68515',
    bg: '#ffffff',
    card: '#f7f9fb',
    border: '#e5e9f0',
    textDark: '#1f2933',
    textMuted: '#8a94a6',
    placeholder: '#a9b1bd',
};

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // State untuk alert bottom sheet
    const [errorModalVisible, setErrorModalVisible] = useState(false);
    const [errorTitle, setErrorTitle] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const showErrorModal = (title: string, message: string) => {
        setErrorTitle(title);
        setErrorMessage(message);
        // Di iOS, modal baru tidak bisa muncul saat modal loading masih menutup
        setTimeout(
            () => setErrorModalVisible(true),
            Platform.OS === 'ios' ? 400 : 0
        );
    };

    const handleSignIn = async () => {
        console.log('═══════════════════════════════════════════');
        console.log('🔐 [LOGIN] START');
        console.log('═══════════════════════════════════════════');

        // Validasi dasar
        if (!email.trim() || !password.trim()) {
            console.log('⚠️ [LOGIN] Validasi gagal: email/password kosong');
            showErrorModal(
                'Data belum lengkap',
                'Email dan kata sandi wajib diisi.'
            );
            return;
        }

        setLoading(true);

        try {
            // ============================================================
            // 1. LOGIN ke backend
            // ============================================================
            console.log(
                '🟡 [LOGIN] Step 1: POST /api/auth/login untuk:',
                email.trim().toLowerCase()
            );

            const res = await api.login({
                email: email.trim().toLowerCase(),
                password,
            });

            console.log('🟢 [LOGIN] Step 1 OK — Response:', {
                userId: res.userId,
                role: res.role,
                tokenLength: res.token?.length,
                tokenPreview: res.token
                    ? res.token.substring(0, 30) + '...'
                    : 'KOSONG',
            });

            // ============================================================
            // 2. SIMPAN TOKEN
            // ============================================================
            console.log('🟡 [LOGIN] Step 2: saveToken()...');

            if (!res.token) {
                console.error('🔴 [LOGIN] Token KOSONG dari backend!');
                throw new Error('Token tidak diterima dari server');
            }

            await saveToken(res.token);

            console.log('🟢 [LOGIN] Step 2 OK — saveToken() selesai');

            // ============================================================
            // ✅ 2b. VERIFIKASI: cek apakah token benar-benar tersimpan
            // ============================================================
            const storedToken = await getToken();
            console.log('🟢 [LOGIN] Step 2b — Verifikasi token tersimpan:', {
                exists: !!storedToken,
                length: storedToken?.length ?? 0,
                match: storedToken === res.token,
                preview: storedToken
                    ? storedToken.substring(0, 30) + '...'
                    : 'KOSONG',
            });

            if (!storedToken) {
                console.error(
                    '🔴 [LOGIN] Token TIDAK TERSIMPAN setelah saveToken()!'
                );
                throw new Error(
                    'Token gagal disimpan di perangkat. Coba lagi.'
                );
            }

            if (storedToken !== res.token) {
                console.warn(
                    '⚠️ [LOGIN] Token tersimpan berbeda dari yang diterima!'
                );
            }

            // Cek langsung di storage (web: localStorage, native: SecureStore)
            if (Platform.OS === 'web') {
                const lsToken =
                    typeof window !== 'undefined'
                        ? window.localStorage.getItem('auth_token')
                        : null;
                console.log('🟢 [LOGIN] Step 2c — localStorage auth_token:', {
                    exists: !!lsToken,
                    length: lsToken?.length ?? 0,
                });
            }

            // ============================================================
            // 3. AMBIL PROFIL
            // ============================================================
            console.log('🟡 [LOGIN] Step 3: api.me()...');

            const profile = await api.me();

            console.log('🟢 [LOGIN] Step 3 OK — Profil diterima:', {
                id: profile.id,
                email: profile.email,
                full_name: profile.full_name,
                role: profile.role,
            });

            // ============================================================
            // 4. SIMPAN PROFIL ke AsyncStorage
            // ============================================================
            console.log('🟡 [LOGIN] Step 4: simpan profil ke AsyncStorage...');

            await AsyncStorage.setItem('profile', JSON.stringify(profile));

            console.log('🟢 [LOGIN] Step 4 OK — Profil tersimpan');

            // Verifikasi profil tersimpan
            const cachedProfile = await AsyncStorage.getItem('profile');
            console.log('🟢 [LOGIN] Step 4b — Verifikasi profil:', {
                exists: !!cachedProfile,
                length: cachedProfile?.length ?? 0,
            });

            // ============================================================
            // 5. REDIRECT ke tabs
            // ============================================================
            console.log('🟡 [LOGIN] Step 5: redirect ke /(tabs)');

            router.replace('/(tabs)' as any);

            console.log('🟢 [LOGIN] Step 5 OK — Redirect dipanggil');
            console.log('═══════════════════════════════════════════');
            console.log('✅ [LOGIN] SUKSES TOTAL');
            console.log('═══════════════════════════════════════════');
        } catch (err: any) {
            console.error('═══════════════════════════════════════════');
            console.error('🔴 [LOGIN] GAGAL');
            console.error('═══════════════════════════════════════════');
            console.error('[LOGIN] Error name:', err?.name);
            console.error('[LOGIN] Error message:', err?.message);
            console.error('[LOGIN] Error stack:', err?.stack);
            console.error('═══════════════════════════════════════════');

            showErrorModal(
                'Login Gagal',
                err.message || 'Periksa email dan kata sandi Anda.'
            );
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = () => {
        console.log('[LOGIN] Sign in dengan Google — belum tersedia');
        showErrorModal('Segera Hadir', 'Masuk dengan Google belum tersedia.');
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
                    <View style={styles.header}>
                        <Text style={styles.title}>Masuk</Text>
                        <Text style={styles.subtitle}>
                            Hai! Selamat datang kembali, kami rindu kamu
                        </Text>
                    </View>

                    {/* Email */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={styles.input}
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

                    {/* Password */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Kata Sandi</Text>
                        <View style={styles.passwordWrapper}>
                            <TextInput
                                style={styles.passwordInput}
                                placeholder="Masukkan kata sandi"
                                placeholderTextColor={COLORS.placeholder}
                                secureTextEntry={!showPassword}
                                value={password}
                                onChangeText={setPassword}
                                editable={!loading}
                                onSubmitEditing={handleSignIn}
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword((v) => !v)}
                            >
                                <Ionicons
                                    name={
                                        showPassword
                                            ? 'eye-outline'
                                            : 'eye-off-outline'
                                    }
                                    size={20}
                                    color={COLORS.textMuted}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.forgotWrapper}
                        onPress={() => router.push('/' as any)}
                    >
                        <Text style={styles.forgotText}>Lupa Kata Sandi?</Text>
                    </TouchableOpacity>

                    {/* Tombol Masuk */}
                    <TouchableOpacity
                        style={[
                            styles.primaryButton,
                            loading && { opacity: 0.6 },
                        ]}
                        activeOpacity={0.85}
                        onPress={handleSignIn}
                        disabled={loading}
                    >
                        <Text style={styles.primaryButtonText}>Masuk</Text>
                    </TouchableOpacity>

                    {/* Divider */}
                    <View style={styles.dividerRow}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>
                            Atau masuk dengan
                        </Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Tombol Google */}
                    <TouchableOpacity
                        style={styles.googleButton}
                        activeOpacity={0.85}
                        onPress={handleGoogleSignIn}
                        disabled={loading}
                    >
                        <AntDesign
                            name="google"
                            size={20}
                            color="#EA4335"
                        />
                        <Text style={styles.googleButtonText}>
                            Masuk dengan Google
                        </Text>
                    </TouchableOpacity>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            Belum punya akun?{' '}
                        </Text>
                        <TouchableOpacity
                            onPress={() =>
                                router.push('/(auth)/register' as any)
                            }
                        >
                            <Text style={styles.footerLink}>Daftar</Text>
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
                        <ActivityIndicator
                            size="large"
                            color={COLORS.primary}
                        />
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
                    <TouchableWithoutFeedback
                        onPress={() => setErrorModalVisible(false)}
                    >
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
                        <Text style={styles.sheetDescription}>
                            {errorMessage}
                        </Text>

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
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 40,
    },
    header: { marginBottom: 28 },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: COLORS.textDark,
        marginBottom: 6,
    },
    subtitle: { fontSize: 14, color: COLORS.textMuted },
    field: { marginBottom: 18 },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textDark,
        marginBottom: 8,
    },
    input: {
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: COLORS.textDark,
    },
    passwordWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.card,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        paddingHorizontal: 14,
    },
    passwordInput: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 14,
        color: COLORS.textDark,
    },
    forgotWrapper: { alignSelf: 'flex-end', marginBottom: 24 },
    forgotText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.primary,
    },
    primaryButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 30,
        paddingVertical: 15,
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: COLORS.primary,
        shadowOpacity: 0.3,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    primaryButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
    dividerText: {
        marginHorizontal: 12,
        fontSize: 12,
        color: COLORS.textMuted,
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 30,
        paddingVertical: 13,
        marginBottom: 28,
        backgroundColor: COLORS.bg,
    },
    googleButtonText: {
        marginLeft: 10,
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textDark,
    },
    footer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 8 },
    footerText: { fontSize: 13, color: COLORS.textMuted },
    footerLink: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.secondary,
    },

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