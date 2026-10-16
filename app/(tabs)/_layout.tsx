// app/(tabs)/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACTIVE = '#40a3ea';    // biru primary
const INACTIVE = '#6b7280';  // abu-abu gelap
const BORDER = '#eceef1';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(active: IconName, inactive: IconName) {
    return ({ color, focused }: { color: string; focused: boolean }) => (
        <Ionicons name={focused ? active : inactive} size={24} color={color} />
    );
}

export default function TabsLayout() {
    const insets = useSafeAreaInsets();
    const bottom = Math.max(insets.bottom, 8);

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: ACTIVE,
                tabBarInactiveTintColor: INACTIVE,
                tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
                tabBarStyle: {
                    backgroundColor: '#ffffff',
                    borderTopColor: BORDER,
                    borderTopWidth: 1,
                    height: 60 + bottom,
                    paddingTop: 8,
                    paddingBottom: bottom,
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{ title: 'Beranda', tabBarIcon: tabIcon('home', 'home-outline') }}
            />
            <Tabs.Screen
                name="pesanan"
                options={{ title: 'Pesanan', tabBarIcon: tabIcon('receipt', 'receipt-outline') }}
            />
            <Tabs.Screen
                name="produk"
                options={{ title: 'Produk', tabBarIcon: tabIcon('grid', 'grid-outline') }}
            />
            <Tabs.Screen
                name="pendapatan"
                options={{ title: 'Pendapatan', tabBarIcon: tabIcon('wallet', 'wallet-outline') }}
            />
            <Tabs.Screen
                name="akun"
                options={{ title: 'Akun', tabBarIcon: tabIcon('person', 'person-outline') }}
            />
        </Tabs>
    );
}