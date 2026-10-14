// services/categoryService.ts
import { apiRequest } from '../lib/api';
import { MenuCategory } from '../types';

/**
 * Service kategori — alias dari merchantService.listCategories dsb,
 * bisa juga diarahkan ke endpoint publik kalau ada.
 */
export const categoryService = {
    list: () => apiRequest<MenuCategory[]>('/api/merchant/categories'),

    create: (name: string) =>
        apiRequest<MenuCategory>('/api/merchant/categories', {
            method: 'POST',
            body: { name },
        }),

    remove: (id: number) =>
        apiRequest<null>(`/api/merchant/categories/${id}`, { method: 'DELETE' }),
};