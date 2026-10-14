// types/merchant.ts
export interface MerchantProfile {
    user_id: string;
    store_name: string;
    description?: string | null;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    logo_url?: string | null;
    cover_url?: string | null;
    is_open: boolean;
    is_verified?: boolean;
    rating_avg?: number | null;
    total_orders?: number | null;
    open_hours?: any | null;
    created_at?: string;
}

export interface MerchantNearby extends MerchantProfile {
    distance_m?: number;
}

export interface MenuCategory {
    id: number;
    merchant_id: string;
    name: string;
    sort_order?: number;
    created_at?: string;
}

export interface MenuItem {
    id: number;
    merchant_id: string;
    category_id?: number | null;
    name: string;
    description?: string | null;
    price: number;
    image_url?: string | null;
    is_available: boolean;
    stock?: number | null;
    created_at?: string;
    updated_at?: string;
    menu_categories?: { name: string } | null;
}

export interface PublicMenuResponse {
    merchant_id: string;
    categories: MenuCategory[];
    items: MenuItem[];
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
    open_hours?: any;
}

export interface AddCategoryPayload {
    name: string;
}

export interface AddMenuItemPayload {
    category_id?: number;
    name: string;
    description?: string;
    price: number;
    image_url?: string;
    stock?: number;
}

export interface UpdateMenuItemPayload {
    category_id?: number;
    name?: string;
    description?: string;
    price?: number;
    image_url?: string;
    is_available?: boolean;
    stock?: number;
}

export interface ApiResponse<T> {
    success: boolean;
    message?: string;
    data: T;
}