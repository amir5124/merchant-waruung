// components/ProductItem.tsx
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MenuItem } from '../types/merchant';

interface ProductItemProps {
    item: MenuItem;
    onPress?: (item: MenuItem) => void;
    showActions?: boolean;
    onEdit?: (item: MenuItem) => void;
    onDelete?: (item: MenuItem) => void;
    onToggle?: (item: MenuItem) => void;
}

export function ProductItem({
    item,
    onPress,
    showActions,
    onEdit,
    onDelete,
    onToggle,
}: ProductItemProps) {
    return (
        <TouchableOpacity
            style={styles.card}
            activeOpacity={onPress ? 0.8 : 1}
            onPress={() => onPress?.(item)}
            disabled={!onPress}
        >
            <View style={styles.imageWrapper}>
                {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.image} />
                ) : (
                    <View style={[styles.image, styles.imagePlaceholder]}>
                        <Text style={styles.placeholderText}>🍽️</Text>
                    </View>
                )}
            </View>

            <View style={styles.content}>
                <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                </Text>
                {item.description ? (
                    <Text style={styles.desc} numberOfLines={2}>
                        {item.description}
                    </Text>
                ) : null}
                <Text style={styles.price}>
                    Rp {item.price.toLocaleString('id-ID')}
                </Text>
                <View style={styles.badgeRow}>
                    <View
                        style={[
                            styles.badge,
                            item.is_available ? styles.badgeOn : styles.badgeOff,
                        ]}
                    >
                        <Text
                            style={[
                                styles.badgeText,
                                item.is_available ? styles.badgeTextOn : styles.badgeTextOff,
                            ]}
                        >
                            {item.is_available ? 'Tersedia' : 'Habis'}
                        </Text>
                    </View>
                    {item.stock != null ? (
                        <Text style={styles.stock}>Stok: {item.stock}</Text>
                    ) : null}
                </View>

                {showActions ? (
                    <View style={styles.actions}>
                        <TouchableOpacity
                            onPress={() => onToggle?.(item)}
                            style={styles.actionBtn}
                        >
                            <Text style={styles.actionText}>
                                {item.is_available ? 'Sembunyikan' : 'Tampilkan'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => onEdit?.(item)}
                            style={styles.actionBtn}
                        >
                            <Text style={styles.actionText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => onDelete?.(item)}
                            style={styles.actionBtn}
                        >
                            <Text style={[styles.actionText, { color: '#dc2626' }]}>
                                Hapus
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : null}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    imageWrapper: { marginRight: 12 },
    image: { width: 80, height: 80, borderRadius: 10 },
    imagePlaceholder: {
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    placeholderText: { fontSize: 32 },
    content: { flex: 1, justifyContent: 'space-between' },
    name: { fontSize: 15, fontWeight: '700', color: '#111827' },
    desc: { fontSize: 12, color: '#6b7280', marginTop: 2 },
    price: {
        fontSize: 14,
        fontWeight: '700',
        color: '#2563eb',
        marginTop: 6,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 6,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    badgeOn: { backgroundColor: '#dcfce7' },
    badgeOff: { backgroundColor: '#fee2e2' },
    badgeText: { fontSize: 11, fontWeight: '600' },
    badgeTextOn: { color: '#15803d' },
    badgeTextOff: { color: '#b91c1c' },
    stock: { fontSize: 11, color: '#6b7280' },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
    },
    actionBtn: { paddingVertical: 2 },
    actionText: { fontSize: 12, color: '#2563eb', fontWeight: '600' },
});