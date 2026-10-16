// components/FeedbackModals.tsx
// Modal loading + alert bottom sheet yang sama dengan di login/register,
// dibuat reusable supaya tidak disalin-tempel di setiap layar.
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { COLORS } from '../lib/theme';

// ============================================================
// LOADING MODAL
// ============================================================
export function LoadingModal({
    visible,
    message,
}: {
    visible: boolean;
    message?: string;
}) {
    return (
        <Modal
            animationType="fade"
            transparent
            visible={visible}
            onRequestClose={() => { }}
        >
            <View style={styles.loadingOverlay}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    {!!message && (
                        <Text style={styles.loadingText}>{message}</Text>
                    )}
                </View>
            </View>
        </Modal>
    );
}

// ============================================================
// ALERT BUTTON TYPE
// ============================================================
export type AlertButton = {
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
};

// ============================================================
// ALERT STATE
// ============================================================
type AlertState = {
    visible: boolean;
    title: string;
    message: string;
    buttons?: AlertButton[];
};

// ============================================================
// HOOK: useAlertSheet (backward compatible)
// ============================================================
export function useAlertSheet() {
    const [state, setState] = useState<AlertState>({
        visible: false,
        title: '',
        message: '',
    });

    const show = (
        title: string,
        message: string,
        buttons?: AlertButton[]
    ) => {
        // Di iOS, modal baru tidak bisa muncul saat modal loading masih menutup
        setTimeout(
            () => setState({ visible: true, title, message, buttons }),
            Platform.OS === 'ios' ? 400 : 0
        );
    };

    const hide = () => setState((s) => ({ ...s, visible: false }));

    return { state, show, hide };
}

// ============================================================
// ALERT SHEET (Modal bottom sheet)
// ============================================================
export function AlertSheet({
    visible,
    title,
    message,
    buttons,
    onClose,
    buttonLabel = 'Mengerti',
}: {
    visible: boolean;
    title: string;
    message: string;
    buttons?: AlertButton[];
    onClose: () => void;
    /** fallback label kalau buttons tidak di-set */
    buttonLabel?: string;
}) {
    // Normalisasi buttons: kalau tidak ada, pakai default single "Mengerti"
    const normalizedButtons: AlertButton[] =
        buttons && buttons.length > 0
            ? buttons
            : [{ text: buttonLabel, style: 'default', onPress: onClose }];

    const hasMultipleButtons = normalizedButtons.length > 1;

    const handlePress = (btn: AlertButton) => {
        // Tutup dulu, lalu jalankan onPress
        onClose();
        // Delay kecil supaya modal sempat nutup
        setTimeout(() => {
            btn.onPress?.();
        }, 150);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View style={styles.sheetOverlay}>
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={{ flex: 1 }} />
                </TouchableWithoutFeedback>

                <View style={styles.sheetContainer}>
                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.sheetCloseButton}
                        accessibilityLabel="Tutup"
                    >
                        <Ionicons name="close" size={24} color="#1c1c1c" />
                    </TouchableOpacity>

                    <Text style={styles.sheetTitle}>{title}</Text>
                    <Text style={styles.sheetDescription}>{message}</Text>

                    <View style={{ gap: 10 }}>
                        {normalizedButtons.map((btn, idx) => {
                            const isCancel = btn.style === 'cancel';
                            const isDestructive = btn.style === 'destructive';
                            const isPrimary = !isCancel && !isDestructive;

                            return (
                                <TouchableOpacity
                                    key={idx}
                                    onPress={() => handlePress(btn)}
                                    style={[
                                        styles.sheetButton,
                                        // Cancel: outline abu
                                        isCancel && styles.sheetButtonCancel,
                                        // Destructive: outline merah
                                        isDestructive && styles.sheetButtonDestructive,
                                        // Primary: solid biru
                                        isPrimary && styles.sheetButtonPrimary,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.sheetButtonText,
                                            isCancel && styles.sheetButtonTextCancel,
                                            isDestructive &&
                                            styles.sheetButtonTextDestructive,
                                            isPrimary && styles.sheetButtonTextPrimary,
                                        ]}
                                    >
                                        {btn.text}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
    // Loading Modal
    loadingOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        minWidth: 80,
        minHeight: 80,
        paddingHorizontal: 24,
        paddingVertical: 20,
        backgroundColor: '#fff',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    loadingText: {
        fontSize: 13,
        color: COLORS.muted,
        fontWeight: '600',
        textAlign: 'center',
    },

    // Alert Sheet
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
        color: COLORS.ink,
        marginBottom: 10,
    },
    sheetDescription: {
        fontSize: 15,
        color: '#555555',
        lineHeight: 22,
        marginBottom: 32,
    },

    // Button base
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

    // Button variant: Cancel (outline abu)
    sheetButtonCancel: {
        borderColor: COLORS.line,
        backgroundColor: '#fff',
    },
    sheetButtonTextCancel: {
        color: COLORS.muted,
    },

    // Button variant: Destructive (outline merah)
    sheetButtonDestructive: {
        borderColor: COLORS.danger,
        backgroundColor: '#fff',
    },
    sheetButtonTextDestructive: {
        color: COLORS.danger,
    },

    // Button variant: Primary (solid biru)
    sheetButtonPrimary: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    sheetButtonTextPrimary: {
        color: '#ffffff',
    },
});