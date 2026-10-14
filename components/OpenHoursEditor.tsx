// components/OpenHoursEditor.tsx
// Editor jam operasional per hari (Create / Read / Update / Delete).
//  - Create : aktifkan "Atur jam operasional" → jadwal default 08:00–22:00
//  - Read   : tampil daftar 7 hari beserta jamnya
//  - Update : ketuk jam buka/tutup untuk mengubah, atau "Samakan semua hari"
//  - Delete : matikan saklar hari (libur) atau matikan seluruh jadwal
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { COLORS } from '../lib/theme';

// ───────────────────────── Tipe & helper data ─────────────────────────

export const DAYS = [
    { key: 'senin', label: 'Senin' },
    { key: 'selasa', label: 'Selasa' },
    { key: 'rabu', label: 'Rabu' },
    { key: 'kamis', label: 'Kamis' },
    { key: 'jumat', label: 'Jumat' },
    { key: 'sabtu', label: 'Sabtu' },
    { key: 'minggu', label: 'Minggu' },
] as const;

export type DayKey = (typeof DAYS)[number]['key'];
export type DaySchedule = { enabled: boolean; open: string; close: string };
export type OpenHoursState = {
    /** false = tanpa jadwal (toko dianggap selalu buka selama saklar menyala) */
    useSchedule: boolean;
    days: Record<DayKey, DaySchedule>;
};

const DEFAULT_OPEN = '08:00';
const DEFAULT_CLOSE = '22:00';

function pad(n: number) {
    return String(n).padStart(2, '0');
}

function normalizeTime(raw: string): string | null {
    const m = /^(\d{1,2})[:.](\d{2})$/.exec(raw.trim());
    if (!m) return null;
    let h = Number(m[1]);
    let min = Number(m[2]);
    if (h > 24 || min > 59) return null;
    if (h === 24) {
        h = 23;
        min = 59;
    }
    return `${pad(h)}:${pad(min)}`;
}

function parseRange(range?: string | null): { open: string; close: string } | null {
    if (!range) return null;
    const parts = range.split('-');
    if (parts.length !== 2) return null;
    const open = normalizeTime(parts[0]);
    const close = normalizeTime(parts[1]);
    if (!open || !close) return null;
    return { open, close };
}

/** Bentuk awal editor dari open_hours milik API (boleh null / undefined). */
export function scheduleFromOpenHours(openHours: any): OpenHoursState {
    const hasAny =
        openHours && typeof openHours === 'object' && Object.keys(openHours).length > 0;

    const days = {} as Record<DayKey, DaySchedule>;
    for (const { key } of DAYS) {
        const parsed = hasAny ? parseRange(openHours[key]) : null;
        days[key] = parsed
            ? { enabled: true, ...parsed }
            : // tanpa jadwal sama sekali → default semua hari buka;
            // ada jadwal tapi hari ini tidak tercantum → libur
            { enabled: !hasAny, open: DEFAULT_OPEN, close: DEFAULT_CLOSE };
    }
    return { useSchedule: !!hasAny, days };
}

/** Ubah state editor menjadi format API: { senin: "08:00-22:00", ... }.
 *  Hari libur tidak dikirim. Tanpa jadwal → objek kosong. */
export function scheduleToOpenHours(state: OpenHoursState): Record<string, string> {
    const out: Record<string, string> = {};
    if (!state.useSchedule) return out;
    for (const { key } of DAYS) {
        const d = state.days[key];
        if (d.enabled) out[key] = `${d.open}-${d.close}`;
    }
    return out;
}

/** Mengembalikan pesan error, atau null kalau valid. */
export function validateSchedule(state: OpenHoursState): string | null {
    if (!state.useSchedule) return null;
    const active = DAYS.filter(({ key }) => state.days[key].enabled);
    if (active.length === 0) {
        return 'Semua hari libur. Aktifkan minimal satu hari, atau matikan jam operasional.';
    }
    for (const { key, label } of active) {
        const d = state.days[key];
        if (d.open === d.close) {
            return `${label}: jam buka dan jam tutup tidak boleh sama.`;
        }
    }
    return null;
}

// ───────────────────────── Time picker (bottom sheet) ─────────────────────────

const ITEM_H = 44;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const BASE_MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function TimePickerSheet({
    visible,
    title,
    value,
    onCancel,
    onConfirm,
}: {
    visible: boolean;
    title: string;
    value: string;
    onCancel: () => void;
    onConfirm: (v: string) => void;
}) {
    const [h, setH] = useState(8);
    const [m, setM] = useState(0);
    const hRef = useRef<ScrollView>(null);
    const mRef = useRef<ScrollView>(null);

    // Menit bawaan kelipatan 5; kalau nilai lama bukan kelipatan 5, tetap ditampilkan
    const minutes = BASE_MINUTES.includes(m)
        ? BASE_MINUTES
        : [...BASE_MINUTES, m].sort((a, b) => a - b);

    useEffect(() => {
        if (!visible) return;
        const [hh, mm] = value.split(':').map(Number);
        setH(hh);
        setM(mm);
        const mins = BASE_MINUTES.includes(mm)
            ? BASE_MINUTES
            : [...BASE_MINUTES, mm].sort((a, b) => a - b);
        const t = setTimeout(() => {
            hRef.current?.scrollTo({ y: hh * ITEM_H, animated: false });
            mRef.current?.scrollTo({ y: mins.indexOf(mm) * ITEM_H, animated: false });
        }, 80);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
            <View style={tp.overlay}>
                <TouchableWithoutFeedback onPress={onCancel}>
                    <View style={{ flex: 1 }} />
                </TouchableWithoutFeedback>

                <View style={tp.sheet}>
                    <Text style={tp.title}>{title}</Text>

                    <View style={tp.columns}>
                        <ScrollView ref={hRef} style={tp.col} showsVerticalScrollIndicator={false}>
                            {HOURS.map((x) => (
                                <TouchableOpacity
                                    key={x}
                                    style={[tp.item, x === h && tp.itemActive]}
                                    onPress={() => setH(x)}
                                >
                                    <Text style={[tp.itemText, x === h && tp.itemTextActive]}>
                                        {pad(x)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={tp.colon}>:</Text>

                        <ScrollView ref={mRef} style={tp.col} showsVerticalScrollIndicator={false}>
                            {minutes.map((x) => (
                                <TouchableOpacity
                                    key={x}
                                    style={[tp.item, x === m && tp.itemActive]}
                                    onPress={() => setM(x)}
                                >
                                    <Text style={[tp.itemText, x === m && tp.itemTextActive]}>
                                        {pad(x)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>

                    <View style={tp.actions}>
                        <TouchableOpacity style={[tp.btn, tp.btnGhost]} onPress={onCancel}>
                            <Text style={tp.btnGhostText}>Batal</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[tp.btn, tp.btnPrimary]}
                            onPress={() => onConfirm(`${pad(h)}:${pad(m)}`)}
                        >
                            <Text style={tp.btnPrimaryText}>Simpan</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

// ───────────────────────── Editor ─────────────────────────

export default function OpenHoursEditor({
    value,
    onChange,
    disabled,
}: {
    value: OpenHoursState;
    onChange: (next: OpenHoursState) => void;
    disabled?: boolean;
}) {
    const [picker, setPicker] = useState<{ day: DayKey; field: 'open' | 'close' } | null>(null);

    const setDay = (day: DayKey, patch: Partial<DaySchedule>) =>
        onChange({
            ...value,
            days: { ...value.days, [day]: { ...value.days[day], ...patch } },
        });

    const copyToAll = () => {
        const source = DAYS.find(({ key }) => value.days[key].enabled);
        if (!source) return;
        const { open, close } = value.days[source.key];
        const days = { ...value.days };
        for (const { key } of DAYS) {
            if (days[key].enabled) days[key] = { ...days[key], open, close };
        }
        onChange({ ...value, days });
    };

    const pickerDay = picker ? value.days[picker.day] : null;
    const pickerLabel = picker ? DAYS.find((d) => d.key === picker.day)?.label : '';

    return (
        <View>
            {/* Saklar utama: ada jadwal / tidak */}
            <View style={s.masterRow}>
                <View style={{ flex: 1 }}>
                    <Text style={s.masterTitle}>Atur jam operasional</Text>
                    <Text style={s.masterDesc}>
                        {value.useSchedule
                            ? 'Toko hanya dianggap buka pada jam yang kamu tentukan.'
                            : 'Tanpa jadwal, toko dianggap buka selama saklar status menyala.'}
                    </Text>
                </View>
                <Switch
                    value={value.useSchedule}
                    onValueChange={(v) => onChange({ ...value, useSchedule: v })}
                    disabled={disabled}
                    trackColor={{ false: COLORS.line, true: COLORS.primary }}
                    thumbColor="#ffffff"
                />
            </View>

            {value.useSchedule && (
                <View style={s.card}>
                    {DAYS.map(({ key, label }, i) => {
                        const d = value.days[key];
                        const overnight = d.enabled && d.close < d.open;
                        return (
                            <View key={key} style={[s.row, i > 0 && s.rowBorder]}>
                                <View style={s.rowTop}>
                                    <Switch
                                        value={d.enabled}
                                        onValueChange={(v) => setDay(key, { enabled: v })}
                                        disabled={disabled}
                                        trackColor={{ false: COLORS.line, true: COLORS.primary }}
                                        thumbColor="#ffffff"
                                    />
                                    <Text style={[s.dayText, !d.enabled && s.dayTextOff]}>
                                        {label}
                                    </Text>

                                    {d.enabled ? (
                                        <View style={s.times}>
                                            <TouchableOpacity
                                                style={s.chip}
                                                disabled={disabled}
                                                onPress={() => setPicker({ day: key, field: 'open' })}
                                                accessibilityLabel={`Jam buka ${label}`}
                                            >
                                                <Text style={s.chipText}>{d.open}</Text>
                                            </TouchableOpacity>
                                            <Text style={s.dash}>–</Text>
                                            <TouchableOpacity
                                                style={s.chip}
                                                disabled={disabled}
                                                onPress={() => setPicker({ day: key, field: 'close' })}
                                                accessibilityLabel={`Jam tutup ${label}`}
                                            >
                                                <Text style={s.chipText}>{d.close}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <Text style={s.libur}>Libur</Text>
                                    )}
                                </View>
                                {overnight && (
                                    <Text style={s.overnight}>Tutup di hari berikutnya</Text>
                                )}
                            </View>
                        );
                    })}

                    <TouchableOpacity style={s.copyBtn} onPress={copyToAll} disabled={disabled}>
                        <Ionicons name="copy-outline" size={16} color={COLORS.primary} />
                        <Text style={s.copyText}>Samakan jam semua hari buka</Text>
                    </TouchableOpacity>
                </View>
            )}

            <TimePickerSheet
                visible={!!picker}
                title={picker ? `${picker.field === 'open' ? 'Jam buka' : 'Jam tutup'} · ${pickerLabel}` : ''}
                value={picker && pickerDay ? pickerDay[picker.field] : '08:00'}
                onCancel={() => setPicker(null)}
                onConfirm={(v) => {
                    if (picker) setDay(picker.day, { [picker.field]: v } as Partial<DaySchedule>);
                    setPicker(null);
                }}
            />
        </View>
    );
}

const s = StyleSheet.create({
    masterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    masterTitle: { fontSize: 15, fontWeight: '700', color: COLORS.ink },
    masterDesc: { marginTop: 2, fontSize: 13, lineHeight: 18, color: COLORS.muted },

    card: {
        marginTop: 12,
        borderWidth: 1.5,
        borderColor: COLORS.fieldBorder,
        borderRadius: 16,
        backgroundColor: COLORS.white,
        paddingHorizontal: 14,
        paddingBottom: 6,
    },
    row: { paddingVertical: 10 },
    rowBorder: { borderTopWidth: 1, borderTopColor: COLORS.line },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    dayText: { width: 62, fontSize: 14, fontWeight: '700', color: COLORS.ink },
    dayTextOff: { color: COLORS.muted },
    times: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
    chip: {
        minWidth: 66,
        height: 38,
        paddingHorizontal: 10,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: COLORS.fieldBorder,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipText: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
    dash: { fontSize: 14, color: COLORS.muted },
    libur: { flex: 1, textAlign: 'right', fontSize: 14, fontWeight: '600', color: COLORS.muted },
    overnight: { marginTop: 4, marginLeft: 2, fontSize: 12, color: COLORS.warnText },

    copyBtn: {
        marginTop: 4,
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderTopWidth: 1,
        borderTopColor: COLORS.line,
    },
    copyText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
});

const tp = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 36,
    },
    title: { fontSize: 18, fontWeight: '800', color: COLORS.ink, marginBottom: 16 },
    columns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    col: { height: ITEM_H * 5, width: 96 },
    colon: { fontSize: 22, fontWeight: '800', color: COLORS.ink },
    item: {
        height: ITEM_H,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
    },
    itemActive: { backgroundColor: COLORS.primaryTint },
    itemText: { fontSize: 20, fontWeight: '600', color: COLORS.muted },
    itemTextActive: { color: COLORS.primary, fontWeight: '800' },
    actions: { marginTop: 20, flexDirection: 'row', gap: 12 },
    btn: {
        flex: 1,
        height: 50,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnGhost: { borderWidth: 1.5, borderColor: COLORS.primary },
    btnGhostText: { fontSize: 15, fontWeight: '700', color: COLORS.primary },
    btnPrimary: { backgroundColor: COLORS.primary },
    btnPrimaryText: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
});