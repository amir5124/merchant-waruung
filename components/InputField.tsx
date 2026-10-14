// components/InputField.tsx
import { forwardRef } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    View,
} from 'react-native';

interface InputFieldProps extends TextInputProps {
    label?: string;
    error?: string;
    hint?: string;
}

export const InputField = forwardRef<TextInput, InputFieldProps>(
    ({ label, error, hint, style, ...rest }, ref) => {
        return (
            <View style={styles.wrapper}>
                {label ? <Text style={styles.label}>{label}</Text> : null}
                <TextInput
                    ref={ref}
                    {...rest}
                    style={[styles.input, style]}
                    placeholderTextColor="#9ca3af"
                />
                {error ? (
                    <Text style={styles.error}>{error}</Text>
                ) : hint ? (
                    <Text style={styles.hint}>{hint}</Text>
                ) : null}
            </View>
        );
    }
);

InputField.displayName = 'InputField';

const styles = StyleSheet.create({
    wrapper: { marginBottom: 14 },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        backgroundColor: '#fff',
        color: '#111827',
    },
    inputError: { borderColor: '#dc2626' },
    error: { fontSize: 12, color: '#dc2626', marginTop: 4 },
    hint: { fontSize: 12, color: '#6b7280', marginTop: 4 },
});