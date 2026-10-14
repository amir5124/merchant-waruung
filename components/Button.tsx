// components/Button.tsx
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableOpacityProps,
} from 'react-native';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends TouchableOpacityProps {
    title: string;
    variant?: Variant;
    loading?: boolean;
}

export function Button({
    title,
    variant = 'primary',
    loading = false,
    disabled,
    style,
    ...rest
}: ButtonProps) {
    const isDisabled = disabled || loading;

    return (
        <TouchableOpacity
            {...rest}
            disabled={isDisabled}
            style={[
                styles.base,
                styles[variant],
                isDisabled && styles.disabled,
                style,
            ]}
            activeOpacity={0.8}
        >
            {loading ? (
                <ActivityIndicator
                    color={variant === 'primary' || variant === 'danger' ? '#fff' : '#2563eb'}
                />
            ) : (
                <Text style={[styles.text, styles[`${variant}Text` as const]]}>
                    {title}
                </Text>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    base: {
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        minHeight: 48,
    },
    primary: { backgroundColor: '#2563eb' },
    secondary: {
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#2563eb',
    },
    danger: { backgroundColor: '#dc2626' },
    ghost: { backgroundColor: 'transparent' },

    text: { fontSize: 15, fontWeight: '700' },
    primaryText: { color: '#fff' },
    secondaryText: { color: '#2563eb' },
    dangerText: { color: '#fff' },
    ghostText: { color: '#2563eb' },

    disabled: { opacity: 0.5 },
});