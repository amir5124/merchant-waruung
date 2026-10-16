// services/places.ts
// Google Places Autocomplete + Place Details + Reverse Geocoding lewat REST (tanpa library tambahan).
// API key dibaca dari .env:  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
// Aktifkan di Google Cloud: "Places API" dan "Geocoding API".

const KEY = 'AIzaSyCQOfitYRU7iAHMRaj0dwcrI8-UQIiFPWI';

export type LatLng = { latitude: number; longitude: number };

export type PlaceSuggestion = {
    placeId: string;
    main: string;
    secondary: string;
    description: string;
};

export type ResolvedPlace = {
    coords: LatLng;
    name: string;
    address: string;
};

export const hasPlacesKey = () => !!KEY;

/** Token sesi: satu sesi = beberapa ketikan + 1 pilihan (lebih hemat biaya). */
export const newSessionToken = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

async function getJson(url: string, signal?: AbortSignal): Promise<any> {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function assertOk(json: any) {
    const st = json?.status;
    if (st && st !== 'OK' && st !== 'ZERO_RESULTS') {
        throw new Error(json?.error_message || `Google: ${st}`);
    }
}

/** Saran alamat saat mengetik. `bias` = titik acuan (mis. lokasi user) agar hasil yang dekat naik. */
export async function autocomplete(
    input: string,
    sessionToken: string,
    opts: { bias?: LatLng | null; signal?: AbortSignal } = {},
): Promise<PlaceSuggestion[]> {
    const q = input.trim();
    if (q.length < 3 || !KEY) return [];

    let url =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
        `?input=${encodeURIComponent(q)}&language=id&components=country:id` +
        `&sessiontoken=${sessionToken}&key=${KEY}`;
    if (opts.bias) {
        url += `&location=${opts.bias.latitude},${opts.bias.longitude}&radius=50000`;
    }

    const json = await getJson(url, opts.signal);
    assertOk(json);
    return (json.predictions ?? []).map((p: any) => ({
        placeId: p.place_id,
        main: p.structured_formatting?.main_text ?? p.description,
        secondary: p.structured_formatting?.secondary_text ?? '',
        description: p.description,
    }));
}

/** Ambil koordinat + alamat lengkap dari place_id hasil autocomplete. */
export async function placeDetails(placeId: string, sessionToken: string): Promise<ResolvedPlace> {
    const url =
        `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${encodeURIComponent(placeId)}&fields=geometry,name,formatted_address` +
        `&language=id&sessiontoken=${sessionToken}&key=${KEY}`;
    const json = await getJson(url);
    assertOk(json);
    const r = json.result;
    if (!r?.geometry?.location) throw new Error('Lokasi tidak ditemukan');
    return {
        coords: { latitude: r.geometry.location.lat, longitude: r.geometry.location.lng },
        name: r.name ?? '',
        address: r.formatted_address ?? r.name ?? '',
    };
}

/** Koordinat → alamat (dipakai saat peta digeser). */
export async function reverseGeocode(c: LatLng, signal?: AbortSignal): Promise<{ name: string; address: string }> {
    if (!KEY) throw new Error('API key Google Maps belum diatur');
    const url =
        `https://maps.googleapis.com/maps/api/geocode/json` +
        `?latlng=${c.latitude},${c.longitude}&language=id&key=${KEY}`;
    const json = await getJson(url, signal);
    assertOk(json);
    const best = json.results?.[0];
    if (!best) return { name: 'Lokasi dipilih', address: `${c.latitude.toFixed(6)}, ${c.longitude.toFixed(6)}` };
    return {
        name: best.address_components?.[0]?.long_name ?? 'Lokasi dipilih',
        address: best.formatted_address ?? '',
    };
}