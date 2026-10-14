// types/index.ts
export * from './merchant';

export interface User {
    id: string;
    email?: string;
    role?: 'customer' | 'driver' | 'merchant' | 'admin';
    full_name?: string;
    phone?: string;
    avatar_url?: string;
}