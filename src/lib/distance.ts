// Google Maps Routes API & Haversine fallback สำหรับคำนวณระยะทาง

interface LatLng {
  lat: number;
  lng: number;
}

interface DistanceResult {
  distanceKm: number;
  durationMinutes: number;
  source: 'google' | 'haversine';
}

// Haversine formula — คำนวณระยะทางแบบเส้นตรง (fallback)
export function haversineDistance(from: LatLng, to: LatLng): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Google Maps Routes API (Directions)
export async function calculateRoute(from: LatLng, to: LatLng): Promise<DistanceResult> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // ถ้าไม่มี API Key ใช้ Haversine
  if (!apiKey) {
    const km = haversineDistance(from, to);
    // ประมาณเวลา: 25 km/h (เฉลี่ยในเมือง กรุงเทพฯ)
    return {
      distanceKm: Math.round(km * 100) / 100,
      durationMinutes: Math.round((km / 25) * 60),
      source: 'haversine',
    };
  }

  try {
    // ใช้ Directions API (legacy, ง่ายกว่า Routes API v2)
    const url = `https://maps.googleapis.com/maps/api/directions/json?` +
      `origin=${from.lat},${from.lng}` +
      `&destination=${to.lat},${to.lng}` +
      `&mode=driving` +
      `&language=th` +
      `&key=${apiKey}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'OK' && data.routes?.length > 0) {
      const leg = data.routes[0].legs[0];
      return {
        distanceKm: Math.round((leg.distance.value / 1000) * 100) / 100,
        durationMinutes: Math.round(leg.duration.value / 60),
        source: 'google',
      };
    }

    // Fallback ถ้า Google ไม่ return result
    const km = haversineDistance(from, to);
    return {
      distanceKm: Math.round(km * 100) / 100,
      durationMinutes: Math.round((km / 25) * 60),
      source: 'haversine',
    };
  } catch (error) {
    console.error('[Distance] Google Maps API error:', error);
    const km = haversineDistance(from, to);
    return {
      distanceKm: Math.round(km * 100) / 100,
      durationMinutes: Math.round((km / 25) * 60),
      source: 'haversine',
    };
  }
}

// ฟอร์แมตระยะทาง
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} ม.`;
  return `${km.toFixed(1)} กม.`;
}

// ฟอร์แมตเวลา
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} นาที`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} ชม. ${m} นาที` : `${h} ชม.`;
}
