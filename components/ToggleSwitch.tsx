// components/ToggleSwitch.tsx
// Switch kustom sesuai desain (track 52x28), tampil sama di Android, iOS, dan web.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { COLORS } from '../lib/theme';

type Props = {
    value: boolean;
    onValueChange: (next: boolean) => void;
    label: string; // untuk pembaca layar
    disabled?: boolean;
    // 'onPrimary' = dipakai di atas kartu biru/gelap (track putih saat aktif)
    variant?: 'default' | 'onPrimary';
};

export default function ToggleSwitch({
    value,
    onValueChange,
    label,
    disabled,
    variant = 'default',
}: Props) {
    const onPrimary = variant === 'onPrimary';
    const trackColor = value ? (onPrimary ? '#ffffff' : COLORS.primary) : '#8a97a3';
    const knobColor = value && onPrimary ? COLORS.primary : '#ffffff';

    return (
        <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: value, disabled: !!disabled }}
            accessibilityLabel={label}
            onPress={() => onValueChange(!value)}
            disabled={disabled}
            style={[styles.hit, disabled && { opacity: 0.6 }]}
        >
            <View style={[styles.track, { backgroundColor: trackColor }]}>
                <View style={[styles.knob, { backgroundColor: knobColor, left: value ? 26 : 2 }]} />
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    hit: { width: 52, height: 44, justifyContent: 'center' },
    track: { width: 52, height: 28, borderRadius: 14 },
    knob: { position: 'absolute', top: 2, width: 24, height: 24, borderRadius: 12 },
});