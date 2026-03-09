// Google Maps Routes API v2 (TWO_WHEELER) & Haversine fallback
// 💰 ออกแบบให้ประหยัด: Field Mask ขั้นต่ำ + Cache + Haversine fallback

import { routeCache, RouteCache } from './route-cache';

interface LatLng {
  lat: number;
  lng: number;
}

interface DistanceResult {
  distanceKm: number;
  durationMinutes: number;
  source: 'google' | 'haversine';
}

interface OptimizeResult {
  optimizedOrder: number[];
  totalDistanceKm: number;
  totalDurationMinutes: number;
  legs: { distanceKm: number; durationMinutes: number }[];
  source: 'google' | 'haversine';
}

// ============================================================
// Haversine formula — คำนวณระยะทางแบบเส้นตรง (ฟรี ไม่เรียก API)
// ============================================================
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

// Haversine result helper
function haversineResult(from: LatLng, to: LatLng): DistanceResult {
  const km = haversineDistance(from, to);
  return {
    distanceKm: Math.round(km * 100) / 100,
    durationMinutes: Math.round((km / 25) * 60), // ประมาณ 25 km/h ในเมือง
    source: 'haversine',
  };
}

// ============================================================
// Routes API v2 — computeRoutes (TWO_WHEELER)
// 💰 ใช้ Field Mask ขั้นต่ำ → ลดค่าใช้จ่าย
// ============================================================
export async function calculateRoute(from: LatLng, to: LatLng): Promise<DistanceResult> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // ถ้าไม่มี API Key → ใช้ Haversine (ฟรี)
  if (!apiKey) {
    return haversineResult(from, to);
  }

  // ตรวจ cache ก่อน
  const cacheKey = RouteCache.routeKey(from.lat, from.lng, to.lat, to.lng);
  const cached = routeCache.get<DistanceResult>(cacheKey);
  if (cached) {
    console.log('[Distance] Cache hit:', cacheKey);
    return cached;
  }

  try {
    // Routes API v2 endpoint
    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';

    const body = {
      origin: {
        location: {
          latLng: { latitude: from.lat, longitude: from.lng },
        },
      },
      destination: {
        location: {
          latLng: { latitude: to.lat, longitude: to.lng },
        },
      },
      travelMode: 'TWO_WHEELER',
      routingPreference: 'TRAFFIC_AWARE',
      languageCode: 'th',
      units: 'METRIC',
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        // 💰 Field Mask ขั้นต่ำ — ขอเฉพาะ distance + duration
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const result: DistanceResult = {
        distanceKm: Math.round((route.distanceMeters / 1000) * 100) / 100,
        durationMinutes: Math.round(parseInt(route.duration.replace('s', '')) / 60),
        source: 'google',
      };

      // เก็บ cache
      routeCache.set(cacheKey, result);
      console.log('[Distance] Google Routes API v2 (TWO_WHEELER):', result.distanceKm, 'km');
      return result;
    }

    // Fallback ถ้า Google ไม่ return result
    console.warn('[Distance] No routes returned, using Haversine fallback');
    return haversineResult(from, to);
  } catch (error) {
    console.error('[Distance] Routes API v2 error:', error);
    return haversineResult(from, to);
  }
}

// ============================================================
// Route Optimization — computeRoutes + optimizeWaypointOrder
// 💰 เรียก 1 ครั้ง ได้ลำดับที่ดีที่สุดทั้งรอบ (ไม่ต้องเรียกแยกทีละจุด)
// ============================================================
export async function calculateOptimizedRoute(
  origin: LatLng,
  destination: LatLng,
  waypoints: LatLng[],
): Promise<OptimizeResult> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Haversine fallback: เรียงตามระยะทางจาก origin (nearest-neighbor greedy)
  if (!apiKey || waypoints.length === 0) {
    return haversineOptimize(origin, destination, waypoints);
  }

  // ตรวจ cache
  const cacheKey = RouteCache.optimizeKey(
    RouteCache.coordKey(origin.lat, origin.lng),
    RouteCache.coordKey(destination.lat, destination.lng),
    waypoints.length,
  );
  const cached = routeCache.get<OptimizeResult>(cacheKey);
  if (cached) {
    console.log('[Optimize] Cache hit');
    return cached;
  }

  try {
    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';

    const body = {
      origin: {
        location: { latLng: { latitude: origin.lat, longitude: origin.lng } },
      },
      destination: {
        location: { latLng: { latitude: destination.lat, longitude: destination.lng } },
      },
      intermediates: waypoints.map(wp => ({
        location: { latLng: { latitude: wp.lat, longitude: wp.lng } },
      })),
      travelMode: 'TWO_WHEELER',
      optimizeWaypointOrder: true,
      languageCode: 'th',
      units: 'METRIC',
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        // 💰 Field Mask ขั้นต่ำ — ขอเฉพาะ optimized order + distance + duration + legs
        'X-Goog-FieldMask': 'routes.optimizedIntermediateWaypointIndex,routes.distanceMeters,routes.duration,routes.legs.distanceMeters,routes.legs.duration',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const result: OptimizeResult = {
        optimizedOrder: route.optimizedIntermediateWaypointIndex || waypoints.map((_, i) => i),
        totalDistanceKm: Math.round((route.distanceMeters / 1000) * 100) / 100,
        totalDurationMinutes: Math.round(parseInt(route.duration.replace('s', '')) / 60),
        legs: (route.legs || []).map((leg: { distanceMeters: number; duration: string }) => ({
          distanceKm: Math.round((leg.distanceMeters / 1000) * 100) / 100,
          durationMinutes: Math.round(parseInt(leg.duration.replace('s', '')) / 60),
        })),
        source: 'google',
      };

      routeCache.set(cacheKey, result);
      console.log('[Optimize] Routes API v2 optimized:', result.optimizedOrder);
      return result;
    }

    console.warn('[Optimize] No routes returned, using Haversine fallback');
    return haversineOptimize(origin, destination, waypoints);
  } catch (error) {
    console.error('[Optimize] Routes API v2 error:', error);
    return haversineOptimize(origin, destination, waypoints);
  }
}

// Haversine nearest-neighbor optimization (ฟรี ไม่เรียก API)
function haversineOptimize(origin: LatLng, destination: LatLng, waypoints: LatLng[]): OptimizeResult {
  if (waypoints.length === 0) {
    const km = haversineDistance(origin, destination);
    return {
      optimizedOrder: [],
      totalDistanceKm: Math.round(km * 100) / 100,
      totalDurationMinutes: Math.round((km / 25) * 60),
      legs: [{ distanceKm: Math.round(km * 100) / 100, durationMinutes: Math.round((km / 25) * 60) }],
      source: 'haversine',
    };
  }

  // Nearest-neighbor greedy algorithm
  const remaining = waypoints.map((wp, i) => ({ ...wp, originalIndex: i }));
  const order: number[] = [];
  const legs: { distanceKm: number; durationMinutes: number }[] = [];
  let current = origin;
  let totalKm = 0;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineDistance(current, remaining[i]);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    const nearest = remaining.splice(nearestIdx, 1)[0];
    order.push(nearest.originalIndex);
    legs.push({
      distanceKm: Math.round(nearestDist * 100) / 100,
      durationMinutes: Math.round((nearestDist / 25) * 60),
    });
    totalKm += nearestDist;
    current = nearest;
  }

  // Last leg: last waypoint → destination
  const lastLegKm = haversineDistance(current, destination);
  legs.push({
    distanceKm: Math.round(lastLegKm * 100) / 100,
    durationMinutes: Math.round((lastLegKm / 25) * 60),
  });
  totalKm += lastLegKm;

  return {
    optimizedOrder: order,
    totalDistanceKm: Math.round(totalKm * 100) / 100,
    totalDurationMinutes: Math.round((totalKm / 25) * 60),
    legs,
    source: 'haversine',
  };
}

// ============================================================
// Actual Route Distance — คำนวณระยะทางจริงตามลำดับที่แมสวิ่ง
// ★ ใช้ตอนจบรอบวิ่ง — เรียก Google API ครั้งเดียว
// ============================================================
export async function calculateActualRouteDistance(
  origin: LatLng,
  waypoints: LatLng[],
  returnToOrigin: boolean = true,
): Promise<{ totalDistanceKm: number; source: 'google' | 'haversine' }> {
  if (waypoints.length === 0) {
    return { totalDistanceKm: 0, source: 'haversine' };
  }

  const destination = returnToOrigin ? origin : waypoints[waypoints.length - 1];
  const intermediates = returnToOrigin ? waypoints : waypoints.slice(0, -1);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Haversine fallback
  if (!apiKey) {
    let totalKm = 0;
    let prev = origin;
    for (const wp of waypoints) {
      totalKm += haversineDistance(prev, wp);
      prev = wp;
    }
    if (returnToOrigin) {
      totalKm += haversineDistance(prev, origin);
    }
    return { totalDistanceKm: Math.round(totalKm * 100) / 100, source: 'haversine' };
  }

  try {
    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';

    const body: Record<string, unknown> = {
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
      travelMode: 'TWO_WHEELER',
      languageCode: 'th',
      units: 'METRIC',
    };

    if (intermediates.length > 0) {
      body.intermediates = intermediates.map(wp => ({
        location: { latLng: { latitude: wp.lat, longitude: wp.lng } },
      }));
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (data.routes && data.routes.length > 0) {
      const km = Math.round((data.routes[0].distanceMeters / 1000) * 100) / 100;
      console.log(`[TripDistance] Google Routes API: ${km} km (${waypoints.length} waypoints, return=${returnToOrigin})`);
      return { totalDistanceKm: km, source: 'google' };
    }

    console.warn('[TripDistance] No routes returned, falling back to Haversine');
  } catch (error) {
    console.error('[TripDistance] Google API error, falling back to Haversine:', error);
  }

  // Fallback
  let totalKm = 0;
  let prev = origin;
  for (const wp of waypoints) {
    totalKm += haversineDistance(prev, wp);
    prev = wp;
  }
  if (returnToOrigin) {
    totalKm += haversineDistance(prev, origin);
  }
  return { totalDistanceKm: Math.round(totalKm * 100) / 100, source: 'haversine' };
}

// ============================================================
// ฟอร์แมต helpers
// ============================================================
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} ม.`;
  return `${km.toFixed(1)} กม.`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} นาที`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} ชม. ${m} นาที` : `${h} ชม.`;
}
