// lib/format.ts
export function rupiah(n: number | null | undefined): string {
    const v = Math.round(Number(n ?? 0));
    const sign = v < 0 ? '-' : '';
    return `${sign}Rp ${String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

// "15000" -> "15.000" (untuk tampilan input harga)
export function thousands(digits: string): string {
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function timeAgo(iso: string | null | undefined): string {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    if (Number.isNaN(diff)) return '';
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'Baru saja';
    if (min < 60) return `${min} menit lalu`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} jam lalu`;
    return `${Math.floor(hr / 24)} hari lalu`;
}

export function isToday(iso: string | null | undefined): boolean {
    if (!iso) return false;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return false;
    const now = new Date();
    return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
    );
}

export function greeting(): string {
    const h = new Date().getHours();
    if (h >= 4 && h < 11) return 'Selamat pagi';
    if (h >= 11 && h < 15) return 'Selamat siang';
    if (h >= 15 && h < 18) return 'Selamat sore';
    return 'Selamat malam';
}