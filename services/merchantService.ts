// services/merchantService.ts
import { apiRequest } from '../lib/api';
import {
    AddCategoryPayload,
    AddMenuItemPayload,
    MenuCategory,
    MenuItem,
    MerchantNearby,
    MerchantProfile,
    PublicMenuResponse,
    UpdateMenuItemPayload,
    UpsertStorePayload,
} from '../types/merchant';

export const merchantService = {
    // ============================================================
    // PUBLIC — Browse (customer/driver)
    // ============================================================

    /**
     * GET /api/merchant/nearby?lat=&lng=&radius=
     */
    findNearby: (lat: number, lng: number, radius = 5000) =>
        apiRequest<MerchantNearby[]>('/api/merchant/nearby', {
            query: { lat, lng, radius },
        }),

    /**
     * GET /api/merchant/:id
     */
    getPublicProfile: (merchantId: string) =>
        apiRequest<MerchantProfile>(`/api/merchant/${merchantId}`),

    /**
     * GET /api/merchant/:id/menu
     */
    getPublicMenu: (merchantId: string) =>
        apiRequest<PublicMenuResponse>(`/api/merchant/${merchantId}/menu`),

    // ============================================================
    // STORE (merchant only)
    // ============================================================

    /**
     * POST /api/merchant/store
     * Upsert profil toko (create/update)
     */
    upsertStore: (payload: UpsertStorePayload) =>
        apiRequest<MerchantProfile>('/api/merchant/store', {
            method: 'POST',
            body: payload,
        }),

    /**
     * GET /api/merchant/store
     */
    getMyStore: () => apiRequest<MerchantProfile | null>('/api/merchant/store'),

    /**
     * PUT /api/merchant/store/open
     */
    setOpen: (isOpen: boolean) =>
        apiRequest<MerchantProfile>('/api/merchant/store/open', {
            method: 'PUT',
            body: { is_open: isOpen },
        }),

    // ============================================================
    // CATEGORIES (merchant only)
    // ============================================================

    listCategories: () =>
        apiRequest<MenuCategory[]>('/api/merchant/categories'),

    addCategory: (payload: AddCategoryPayload) =>
        apiRequest<MenuCategory>('/api/merchant/categories', {
            method: 'POST',
            body: payload,
        }),

    deleteCategory: (id: number) =>
        apiRequest<null>(`/api/merchant/categories/${id}`, { method: 'DELETE' }),

    // ============================================================
    // MENU ITEMS (merchant only)
    // ============================================================

    listMenu: () => apiRequest<MenuItem[]>('/api/merchant/menu'),

    addMenuItem: (payload: AddMenuItemPayload) =>
        apiRequest<MenuItem>('/api/merchant/menu', {
            method: 'POST',
            body: payload,
        }),

    updateMenuItem: (id: number, payload: UpdateMenuItemPayload) =>
        apiRequest<MenuItem>(`/api/merchant/menu/${id}`, {
            method: 'PUT',
            body: payload,
        }),

    toggleMenuAvailability: (id: number) =>
        apiRequest<MenuItem>(`/api/merchant/menu/${id}/toggle`, {
            method: 'PUT',
        }),

    deleteMenuItem: (id: number) =>
        apiRequest<null>(`/api/merchant/menu/${id}`, { method: 'DELETE' }),
};