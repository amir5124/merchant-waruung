// lib/dialogs.ts
// Konfirmasi yang berfungsi di web (window.confirm) maupun HP (Alert.alert).
import { Alert, Platform } from 'react-native';

export function confirmAction(opts: {
    title: string;
    message: string;
    confirmText?: string;
    destructive?: boolean;
}): Promise<boolean> {
    const { title, message, confirmText = 'Ya', destructive = false } = opts;

    if (Platform.OS === 'web') {
        return Promise.resolve(window.confirm(`${title}\n\n${message}`));
    }

    return new Promise((resolve) => {
        Alert.alert(
            title,
            message,
            [
                { text: 'Batal', style: 'cancel', onPress: () => resolve(false) },
                {
                    text: confirmText,
                    style: destructive ? 'destructive' : 'default',
                    onPress: () => resolve(true),
                },
            ],
            { cancelable: true, onDismiss: () => resolve(false) }
        );
    });
}