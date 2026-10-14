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

// ---------- Loading ----------
export function LoadingModal({ visible }: { visible: boolean }) {
    return (
        <Modal animationType="fade" transparent visible={visible} onRequestClose={() => { }}>
            <View style={styles.loadingOverlay}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            </View>
        </Modal>
    );
}

// ---------- Alert bottom sheet ----------
type AlertState = { visible: boolean; title: string; message: string };

export function useAlertSheet() {
    const [state, setState] = useState<AlertState>({ visible: false, title: '', message: '' });

    const show = (title: string, message: string) => {
        // Di iOS, modal baru tidak bisa muncul saat modal loading masih menutup
        setTimeout(
            () => setState({ visible: true, title, message }),
            Platform.OS === 'ios' ? 400 : 0
        );
    };
    const hide = () => setState((s) => ({ ...s, visible: false }));

    return { state, show, hide };
}

export function AlertSheet({
    visible,
    title,
    message,
    onClose,
    buttonLabel = 'Mengerti',
}: {
    visible: boolean;
    title: string;
    message: string;
    onClose: () => void;
    buttonLabel?: string;
}) {
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

                    <TouchableOpacity onPress={onClose} style={styles.sheetButton}>
                        <Text style={styles.sheetButtonText}>{buttonLabel}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
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