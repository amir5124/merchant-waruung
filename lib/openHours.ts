// lib/openHours.ts
// Menghitung apakah toko sedang berada di dalam jam operasional,
// berdasarkan field `open_hours` dari API, contoh:
// { senin: "08:00-22:00", selasa: "08:00-22:00", ... }

export type OpenHours = Record<string, string | null | undefined> | null | undefined;

const DAY_KEYS = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'] as const;

// Jam operasional dianggap WIB (UTC+7), apa pun zona waktu perangkat.
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export type OpenStatus = {
    /** true kalau toko punya jadwal di open_hours */
    hasSchedule: boolean;
    /** true kalau saat ini masuk jam operasional (atau tidak ada jadwal sama sekali) */
    withinHours: boolean;
    /** Label jam hari ini, mis. "08:00 – 22:00". null kalau hari ini libur / tidak ada jadwal */
    todayLabel: string | null;
};

function toMinutes(hhmm: string): number | null {
    const m = /^(\d{1,2})[:.](\d{2})$/.exec(hhmm.trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 24 || min > 59) return null;
    return h * 60 + min;
}

function parseRange(range?: string | null): { open: number; close: number } | null {
    if (!range) return null;
    const parts = range.split('-');
    if (parts.length !== 2) return null;
    const open = toMinutes(parts[0]);
    const close = toMinutes(parts[1]);
    if (open == null || close == null) return null;
    return { open, close };
}

function formatRange(range: string): string {
    return range
        .split('-')
        .map((p) => p.trim())
        .join(' – ');
}

export function getOpenStatus(openHours: OpenHours, now: Date = new Date()): OpenStatus {
    if (!openHours || Object.keys(openHours).length === 0) {
        return { hasSchedule: false, withinHours: true, todayLabel: null };
    }

    const wib = new Date(now.getTime() + WIB_OFFSET_MS);
    const day = wib.getUTCDay(); // 0 = minggu
    const minutes = wib.getUTCHours() * 60 + wib.getUTCMinutes();

    const todayRaw = openHours[DAY_KEYS[day]];
    const yesterdayRaw = openHours[DAY_KEYS[(day + 6) % 7]];

    const today = parseRange(todayRaw);
    const yesterday = parseRange(yesterdayRaw);

    let withinHours = false;

    if (today) {
        if (today.open === today.close) {
            withinHours = true; // dianggap 24 jam
        } else if (today.open < today.close) {
            withinHours = minutes >= today.open && minutes < today.close;
        } else {
            // lewat tengah malam (mis. 18:00-02:00): bagian malam hari ini
            withinHours = minutes >= today.open;
        }
    }

    // Sisa jam dari kemarin yang lewat tengah malam
    if (!withinHours && yesterday && yesterday.open > yesterday.close) {
        withinHours = minutes < yesterday.close;
    }

    return {
        hasSchedule: true,
        withinHours,
        todayLabel: today && todayRaw ? formatRange(todayRaw) : null,
    };
}