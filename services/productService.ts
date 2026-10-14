// services/productService.ts
import { supabase } from '../lib/supabase';

export const productService = {
    // Create
    async createProduct(product: any) {
        const { data, error } = await supabase
            .from('menu_items')
            .insert(product)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // Read (berdasarkan merchant_id)
    async getProducts(merchantId: string) {
        const { data, error } = await supabase
            .from('menu_items')
            .select('*')
            .eq('merchant_id', merchantId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    // Update
    async updateProduct(id: number, updates: any) {
        const { data, error } = await supabase
            .from('menu_items')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    // Delete
    async deleteProduct(id: number) {
        const { error } = await supabase
            .from('menu_items')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },
};