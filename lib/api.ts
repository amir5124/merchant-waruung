// lib/api.ts  (aplikasi MERCHANT) — cross-platform: Web + Android + iOS
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const BASE_URL =
    process.env.EXPO_PUBLIC_API_URL ?? `http://${DEV_HOST}:3000`;

const __DEV_SAFE =
    typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';

if (__DEV_SAFE) {
    console.log('[api] BASE_URL:', BASE_URL, '| Platform:', Platform.OS);
}

const TOKEN_KEY = 'auth_token';

// ============================================================
// Token helpers (Web: localStorage, Native: SecureStore)
// ============================================================
export async function saveToken(token: string): Promise<void> {
    if (isWeb) {
        try {
            localStorage.setItem(TOKEN_KEY, token);
        } catch (e) {
            console.warn('[api] Gagal simpan token di localStorage:', e);
        }
        return;
    }
    await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
    if (isWeb) {
        try {
            return localStorage.getItem(TOKEN_KEY);
        } catch {
            return null;
        }
    }
    return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function clearToken(): Promise<void> {
    if (isWeb) {
        try {
            localStorage.removeItem(TOKEN_KEY);
        } catch {
            /* abaikan */
        }
        return;
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
}

// ============================================================
// 401 HANDLER — bisa dioverride dari luar (root layout)
// ============================================================
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: () => void) {
    onUnauthorized = fn;
}

async function handleUnauthorized() {
    await clearToken();
    if (onUnauthorized) {
        onUnauthorized();
        return;
    }
    try {
        const { router } = await import('expo-router');
        router.replace('/(auth)/login' as any);
    } catch {
        /* abaikan */
    }
}

// ============================================================
// Helpers
// ============================================================
function guessMimeType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
        case 'png':
            return 'image/png';
        case 'webp':
            return 'image/webp';
        case 'jpg':
        case 'jpeg':
        default:
            return 'image/jpeg';
    }
}

// ============================================================
// FETCH DENGAN TIMEOUT + network error mapping
// ============================================================
async function fetchWithTimeout(
    url: string,
    init: RequestInit = {},
    ms = 30000
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } catch (err: any) {
        if (err?.name === 'AbortError') {
            throw new Error('Server terlalu lama merespons. Coba lagi sebentar.');
        }
        console.warn('[api] Network error:', err?.message);
        throw new Error(
            'Tidak bisa terhubung ke server. Cek koneksi internet kamu.'
        );
    } finally {
        clearTimeout(timer);
    }
}

// ============================================================
// Response types — Auth & Profile
// ============================================================
export type UserRole = 'customer' | 'driver' | 'merchant';

export interface AuthResponse {
    token: string;
    userId: string;
    role: UserRole;
}

export interface ProfileResponse {
    id: string;
    email: string | null;
    full_name: string | null;
    phone: string | null;
    role: UserRole | 'admin';
    avatar_url: string | null;
    fcm_token: string | null;
    created_at?: string;
}

// ============================================================
// Response types — Merchant
// ============================================================
export type OpenHours = Record<string, { open: string; close: string } | null>;

export interface MerchantStore {
    user_id: string;
    store_name: string;
    description: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    logo_url: string | null;
    cover_url: string | null;
    is_open: boolean;
    is_verified?: boolean;
    rating_avg?: number | null;
    total_orders?: number | null;
    open_hours?: OpenHours | null;
    created_at?: string;
}

export interface UpsertStorePayload {
    store_name: string;
    description?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    logo_url?: string;
    cover_url?: string;
    is_open?: boolean;
    open_hours?: OpenHours;
}

export interface MenuCategory {
    id: number;
    merchant_id?: string;
    name: string;
    sort_order: number | null;
}

export interface MenuItem {
    id: number;
    merchant_id: string;
    category_id: number | null;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    is_available: boolean;
    stock: number | null;
    created_at?: string;
    updated_at?: string;
    menu_categories?: { name: string } | null;
}

export interface AddMenuItemPayload {
    category_id?: number;
    name: string;
    description?: string;
    price: number;
    image_url?: string;
    stock?: number;
}

export type UpdateMenuItemPayload = Partial<AddMenuItemPayload> & {
    is_available?: boolean;
};

export type NearbyMerchant = Pick<
    MerchantStore,
    | 'user_id'
    | 'store_name'
    | 'description'
    | 'address'
    | 'latitude'
    | 'longitude'
    | 'logo_url'
    | 'is_open'
    | 'rating_avg'
    | 'total_orders'
> & { distance_m?: number };

export interface PublicMenu {
    merchant_id: string;
    categories: MenuCategory[];
    items: MenuItem[];
}

// ============================================================
// Response types — Orders
// ============================================================
export interface CustomerInfo {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    avatar_url: string | null;
    stats?: {
        total_orders: number;
        rating_avg: number | null;
    } | null;
}

export interface DriverInfo {
    id: string;
    full_name: string | null;
    phone: string | null;
    email: string | null;
    avatar_url: string | null;
    vehicle_type?: 'motor' | 'mobil' | 'motor_food' | null;
    plate_number?: string | null;
    vehicle_brand?: string | null;
    rating_avg?: number | null;
    total_trips?: number | null;
    coords?: { latitude: number; longitude: number } | null;
}

export interface OrderItem {
    menu_item_id: number;
    name: string;
    variant?: string | null;
    qty: number;
    price: number;
}

export interface OrderResponse {
    id: number;
    order_code: string;
    type: 'ride' | 'food' | 'send';
    status:
    | 'pending'
    | 'accepted'
    | 'arrived'
    | 'in_progress'
    | 'completed'
    | 'cancelled';
    customer_id: string;
    driver_id: string | null;
    merchant_id: string | null;
    pickup_name: string | null;
    pickup_address: string | null;
    dropoff_name: string | null;
    dropoff_address: string | null;
    distance_km: number | null;
    duration_min: number | null;
    subtotal: number;
    delivery_fee: number;
    packaging_fee: number;
    admin_fee: number;
    total_fare: number;
    driver_earning: number;
    merchant_earning: number;
    platform_earning: number;
    payment_method: string;
    payment_status: string;
    notes: string | null;
    tariff_code?: string | null;
    option_name?: string | null;
    send_code?: string | null;

    accepted_at?: string | null;
    arrived_at?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    cancelled_at?: string | null;
    cancellation_reason?: string | null;

    created_at: string;
    updated_at: string;

    pickup_coords?: { latitude: number; longitude: number } | null;
    dropoff_coords?: { latitude: number; longitude: number } | null;

    customer?: CustomerInfo | null;
    driver?: DriverInfo | null;
    merchant?: {
        user_id: string;
        store_name: string;
        address: string | null;
        logo_url: string | null;
    } | null;

    items?: OrderItem[];

    sender_landmark?: string;
    receiver_landmark?: string;
    package_type?: string | null;
    package_size?: string | null;
    package_weight?: string | null;
    package_protection?: string | null;
    sender_name?: string | null;
    receiver_name?: string | null;
    receiver_phone?: string | null;
    sender_phone?: string | null;
}

// ============================================================
// Response types — Chat
// ============================================================
export interface ChatRoom {
    id: number;
    order_id: number;
    customer_id: string;
    driver_id: string | null;
    merchant_id: string | null;
    last_message_at: string | null;
    created_at: string;
}

export interface ChatMessage {
    id: number;
    room_id: number;
    sender_id: string;
    message: string | null;
    attachment_url: string | null;
    message_type: 'text' | 'image' | 'location';
    is_read: boolean;
    created_at: string;
}

// ============================================================
// Response types — Wallet / Topup / Withdraw
// ============================================================

/**
 * Info saldo wallet.
 * - Merchant punya `cash_debt` (utang komisi cash ke platform).
 * - `net_balance` = balance - cash_debt (saldo bersih yang bisa ditarik).
 * - `pending_balance` = saldo yang belum settle (opsional per role).
 */
export interface WalletInfo {
    balance: number;
    cash_debt: number;         // ✅ WAJIB — merchant & driver sama-sama punya
    net_balance: number;       // ✅ WAJIB — balance - cash_debt
    pending_balance: number;   // ✅ WAJIB — saldo belum settle
    updated_at: string;

    // Field opsional (kalau backend mengirim data statistik tambahan)
    total_earning?: number;
    total_commission_paid?: number;
    total_commission_owed?: number;
    last_payout_at?: string | null;
}

export interface WalletLedgerItem {
    id: number;
    user_id: string;
    type: string;
    amount: number;
    balance_after: number;
    reference_id: string | null;
    description: string | null;
    created_at: string;
}

export interface TopupInquiryResponse {
    partner_reff: string;
    virtual_account?: string;
    imageqris?: string;
    expired?: string;
    [key: string]: any;
}

export interface TopupStatusResponse {
    id: number;
    user_id: string;
    partner_reff: string;
    method: 'va' | 'qris';
    amount: number;
    bank_code: string | null;
    va_number: string | null;
    qris_url: string | null;
    status: 'PENDING' | 'SUCCESS' | 'FAILED';
    expired_at: string | null;
    created_at: string;
}

export interface SavedAccount {
    id: number;
    user_id: string;
    bank_code: string;
    account_number: string;
    account_name: string;
    created_at: string;
}

// ============================================================
// Core request — JSON / FormData
// ============================================================
async function request<T>(
    path: string,
    options: {
        method?: string;
        body?: any;
        auth?: boolean;
        isForm?: boolean;
    } = {}
): Promise<T> {
    const { method = 'GET', body, auth = false, isForm = false } = options;

    const headers: Record<string, string> = {};
    if (!isForm) headers['Content-Type'] = 'application/json';

    if (auth) {
        const token = await getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetchWithTimeout(`${BASE_URL}${path}`, {
        method,
        headers,
        body: isForm
            ? (body as FormData)
            : body
                ? JSON.stringify(body)
                : undefined,
    });

    // 401 hanya auto-handle kalau request pakai auth
    if (res.status === 401 && auth) {
        await handleUnauthorized();
        throw new Error('Sesi habis, silakan login ulang.');
    }

    let json: any = null;
    try {
        json = await res.json();
    } catch {
        throw new Error(`Server error (${res.status})`);
    }

    if (!res.ok || !json?.success) {
        const msg =
            json?.message ||
            (res.status === 401
                ? 'Email atau kata sandi salah.'
                : `Request failed (${res.status})`);
        throw new Error(msg);
    }
    return json.data as T;
}

// ============================================================
// apiRequest — kompatibel dengan kode lama
// ============================================================
export function apiRequest<T = any>(
    path: string,
    options: {
        method?: string;
        body?: any;
        auth?: boolean;
        query?: Record<string, string | number | undefined>;
    } = {}
): Promise<T> {
    const { query, auth = true, ...rest } = options;

    let fullPath = path;
    if (query) {
        const qs = new URLSearchParams();
        Object.entries(query).forEach(([k, v]) => {
            if (v !== undefined && v !== null) qs.append(k, String(v));
        });
        const s = qs.toString();
        if (s) fullPath += `?${s}`;
    }

    return request<T>(fullPath, { ...rest, auth });
}

// ============================================================
// Upload file (multipart/form-data)
// - Native: kirim objek { uri, name, type }
// - Web   : uri di-resolve ke Blob/File dulu
// ============================================================
async function uploadFile<T>(
    path: string,
    fieldName: string,
    file: { uri: string; name: string; type: string }
): Promise<T> {
    const token = await getToken();
    const formData = new FormData();

    if (isWeb) {
        let blob: Blob;
        try {
            const r = await fetch(file.uri);
            blob = await r.blob();
        } catch (e) {
            console.warn('[api] Gagal ambil blob dari uri web:', e);
            throw new Error('Gagal membaca file. Coba pilih ulang.');
        }
        formData.append(fieldName, blob, file.name);
    } else {
        formData.append(fieldName, file as any);
    }

    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    // JANGAN set Content-Type manual — fetch mengisi boundary multipart

    const res = await fetchWithTimeout(`${BASE_URL}${path}`, {
        method: 'POST',
        headers,
        body: formData,
    });

    if (res.status === 401) {
        await handleUnauthorized();
        throw new Error('Sesi habis, silakan login ulang.');
    }

    let json: any = null;
    try {
        json = await res.json();
    } catch {
        throw new Error(`Server error (${res.status})`);
    }

    if (!res.ok || !json?.success) {
        throw new Error(json?.message || `Upload gagal (${res.status})`);
    }
    return json.data as T;
}

// ============================================================
// API
// ============================================================
export const api = {
    // ===== Auth =====
    register: (input: {
        email: string;
        password: string;
        full_name: string;
        role?: UserRole;
    }) =>
        request<AuthResponse>('/api/auth/register', {
            method: 'POST',
            body: input,
        }),

    login: (input: { email: string; password: string }) =>
        request<AuthResponse>('/api/auth/login', {
            method: 'POST',
            body: input,
        }),

    me: () => request<ProfileResponse>('/api/auth/me', { auth: true }),

    // ===== Profile =====
    updateProfile: (input: {
        full_name?: string;
        phone?: string;
        email?: string;
        avatar_url?: string;
        fcm_token?: string;
    }) =>
        request<ProfileResponse>('/api/profiles/me', {
            method: 'PUT',
            body: input,
            auth: true,
        }),

    uploadAvatar: (uri: string, mimeType = 'image/jpeg') => {
        const fileName = uri.split('/').pop() ?? 'avatar.jpg';
        return uploadFile<{ avatar_url: string }>(
            '/api/profiles/avatar',
            'image',
            { uri, name: fileName, type: mimeType }
        );
    },

    getProfileById: (userId: string) =>
        request<ProfileResponse>(`/api/profiles/${userId}`, { auth: true }),

    // ===== Upload (produk, logo, cover, dll) =====
    upload: {
        product: (uri: string) => {
            const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
            const name = `product-${Date.now()}.${ext}`;
            const type = guessMimeType(name);
            return uploadFile<{ url: string; path: string; bucket: string }>(
                '/api/upload/product',
                'image',
                { uri, name, type }
            );
        },

        merchantLogo: (uri: string) => {
            const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
            const name = `logo-${Date.now()}.${ext}`;
            const type = guessMimeType(name);
            return uploadFile<{ url: string; path: string; bucket: string }>(
                '/api/upload/merchant-logo',
                'image',
                { uri, name, type }
            );
        },

        merchantCover: (uri: string) => {
            const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
            const name = `cover-${Date.now()}.${ext}`;
            const type = guessMimeType(name);
            return uploadFile<{ url: string; path: string; bucket: string }>(
                '/api/upload/merchant-cover',
                'image',
                { uri, name, type }
            );
        },
    },

    // ============================================================
    // MERCHANT  →  /api/merchant/*
    // ============================================================
    merchant: {
        nearby: (lat: number, lng: number, radius = 5000) =>
            request<NearbyMerchant[]>(
                `/api/merchant/nearby?lat=${lat}&lng=${lng}&radius=${radius}`,
                { auth: true }
            ),

        publicProfile: (merchantId: string) =>
            request<MerchantStore>(`/api/merchant/${merchantId}`, {
                auth: true,
            }),

        publicMenu: (merchantId: string) =>
            request<PublicMenu>(`/api/merchant/${merchantId}/menu`, {
                auth: true,
            }),

        getMyStore: () =>
            request<MerchantStore | null>('/api/merchant/store', {
                auth: true,
            }),

        saveStore: (input: UpsertStorePayload) =>
            request<MerchantStore>('/api/merchant/store', {
                method: 'POST',
                body: input,
                auth: true,
            }),

        setOpen: (isOpen: boolean) =>
            request<MerchantStore>('/api/merchant/store/open', {
                method: 'PUT',
                body: { is_open: isOpen },
                auth: true,
            }),

        listCategories: () =>
            request<MenuCategory[]>('/api/merchant/categories', {
                auth: true,
            }),

        addCategory: (name: string) =>
            request<MenuCategory>('/api/merchant/categories', {
                method: 'POST',
                body: { name },
                auth: true,
            }),

        deleteCategory: (id: number) =>
            request<null>(`/api/merchant/categories/${id}`, {
                method: 'DELETE',
                auth: true,
            }),

        listMenu: () =>
            request<MenuItem[]>('/api/merchant/menu', { auth: true }),

        addMenuItem: (input: AddMenuItemPayload) =>
            request<MenuItem>('/api/merchant/menu', {
                method: 'POST',
                body: input,
                auth: true,
            }),

        updateMenuItem: (id: number, input: UpdateMenuItemPayload) =>
            request<MenuItem>(`/api/merchant/menu/${id}`, {
                method: 'PUT',
                body: input,
                auth: true,
            }),

        toggleMenu: (id: number) =>
            request<MenuItem>(`/api/merchant/menu/${id}/toggle`, {
                method: 'PUT',
                auth: true,
            }),

        deleteMenuItem: (id: number) =>
            request<null>(`/api/merchant/menu/${id}`, {
                method: 'DELETE',
                auth: true,
            }),
    },

    // ===== Orders =====
    getOrder: (orderId: number) =>
        request<OrderResponse>(`/api/orders/${orderId}`, { auth: true }),

    listOrders: (status?: string) =>
        request<OrderResponse[]>(
            `/api/orders${status ? `?status=${status}` : ''}`,
            { auth: true }
        ),

    updateOrderStatus: (
        orderId: number,
        status:
            | 'accepted'
            | 'arrived'
            | 'in_progress'
            | 'completed'
            | 'cancelled',
        reason?: string,
        sendCode?: string
    ) =>
        request<OrderResponse>(`/api/orders/${orderId}/status`, {
            method: 'PUT',
            body: { status, reason, send_code: sendCode },
            auth: true,
        }),

    // ===== Notifications =====
    listNotifications: () =>
        request<any[]>('/api/notifications', { auth: true }),

    markNotificationRead: (id: number) =>
        request<null>(`/api/notifications/${id}/read`, {
            method: 'PUT',
            auth: true,
        }),

    // ===== Chat =====
    chat: {
        openRoom: (orderId: number) =>
            request<ChatRoom>(`/api/chats/rooms/order/${orderId}`, {
                method: 'POST',
                auth: true,
            }),

        listMessages: (roomId: number, limit = 100) =>
            request<ChatMessage[]>(
                `/api/chats/rooms/${roomId}/messages?limit=${limit}`,
                { auth: true }
            ),

        send: (
            roomId: number,
            message: string,
            type: 'text' | 'image' | 'location' = 'text'
        ) =>
            request<ChatMessage>(`/api/chats/rooms/${roomId}/messages`, {
                method: 'POST',
                body: { message, type },
                auth: true,
            }),

        sendImage: (
            roomId: number,
            uri: string,
            fileName?: string,
            mimeType?: string
        ) => {
            const name = fileName ?? uri.split('/').pop() ?? 'photo.jpg';
            const type = mimeType ?? guessMimeType(name);
            return uploadFile<ChatMessage>(
                `/api/chats/rooms/${roomId}/images`,
                'image',
                { uri, name, type }
            );
        },

        markRead: (roomId: number) =>
            request<null>(`/api/chats/rooms/${roomId}/read`, {
                method: 'PUT',
                auth: true,
            }),

        listRooms: () =>
            request<ChatRoom[]>('/api/chats/rooms', { auth: true }),
    },

    // ============================================================
    // WALLET — lengkap termasuk TOPUP
    // ============================================================
    wallet: {
        /** Info saldo + utang cash + pending (merchant) */
        get: () => request<WalletInfo>('/api/wallet', { auth: true }),

        /** Riwayat transaksi wallet */
        ledger: (limit = 50, offset = 0) =>
            request<WalletLedgerItem[]>(
                `/api/wallet/ledger?limit=${limit}&offset=${offset}`,
                { auth: true }
            ),

        // -------- TOPUP --------
        /** Topup — inquiry (buat VA / QRIS) */
        topupInquiry: (input: {
            amount: number;
            method: 'va' | 'qris';
            bank_code?: string;
        }) =>
            request<TopupInquiryResponse>('/api/wallet/topup/inquiry', {
                method: 'POST',
                body: input,
                auth: true,
            }),

        /** Topup — cek status ke LinkQu (dipanggil berulang oleh auto-polling) */
        topupExecute: (partnerReff: string) =>
            request<any>('/api/wallet/topup/execute', {
                method: 'POST',
                body: { partner_reff: partnerReff },
                auth: true,
            }),

        /** Topup — status dari DB */
        topupStatus: (partnerReff: string) =>
            request<TopupStatusResponse>(
                `/api/wallet/topup/status/${partnerReff}`,
                { auth: true }
            ),

        // -------- WITHDRAW --------
        withdrawInquiry: (input: {
            amount: number;
            bank_code: string;
            account_number: string;
        }) =>
            request<any>('/api/wallet/withdraw/inquiry', {
                method: 'POST',
                body: input,
                auth: true,
            }),

        withdrawExecute: (inquiryReff: string) =>
            request<any>('/api/wallet/withdraw/execute', {
                method: 'POST',
                body: { inquiry_reff: inquiryReff },
                auth: true,
            }),

        // -------- SAVED ACCOUNTS --------
        savedAccounts: () =>
            request<SavedAccount[]>('/api/wallet/saved-accounts', {
                auth: true,
            }),

        saveAccount: (input: {
            bank_code: string;
            account_number: string;
            account_name: string;
        }) =>
            request<any>('/api/wallet/saved-accounts', {
                method: 'POST',
                body: input,
                auth: true,
            }),

        deleteAccount: (id: number) =>
            request<null>(`/api/wallet/saved-accounts/${id}`, {
                method: 'DELETE',
                auth: true,
            }),
    },

    // ===== Activity =====
    activity: {
        ping: () =>
            request<null>('/api/activity/ping', {
                method: 'POST',
                auth: true,
            }),
    },
};