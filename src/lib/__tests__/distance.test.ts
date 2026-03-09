/**
 * Unit Tests — distance.ts
 * ทดสอบ Haversine, format helpers, route calculation fallback, route optimization
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  haversineDistance,
  formatDistance,
  formatDuration,
  calculateRoute,
  calculateOptimizedRoute,
  calculateActualRouteDistance,
} from '../distance';

// ============================================================
// Test Coordinates
// ============================================================
const BANGKOK = { lat: 13.7563, lng: 100.5018 };
const CHIANGMAI = { lat: 18.7883, lng: 98.9853 };
const OFFICE = { lat: 13.7275, lng: 100.5240 }; // สำนักงานตัวอย่าง (สาทร)
const SILOM = { lat: 13.7262, lng: 100.5234 };
const SUKHUMVIT = { lat: 13.7365, lng: 100.5609 };
const BANGNA = { lat: 13.6693, lng: 100.6048 };

// Mock: ไม่ให้มี API key → ทุก test ใช้ Haversine fallback
vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', '');

describe('haversineDistance', () => {
  it('should calculate Bangkok → Chiang Mai ≈ 583 km', () => {
    const km = haversineDistance(BANGKOK, CHIANGMAI);
    expect(km).toBeGreaterThan(570);
    expect(km).toBeLessThan(600);
  });

  it('should return 0 for the same point', () => {
    const km = haversineDistance(BANGKOK, BANGKOK);
    expect(km).toBe(0);
  });

  it('should calculate short distance (Silom → Sukhumvit ≈ 4 km)', () => {
    const km = haversineDistance(SILOM, SUKHUMVIT);
    expect(km).toBeGreaterThan(3);
    expect(km).toBeLessThan(6);
  });

  it('should be symmetric (A→B = B→A)', () => {
    const ab = haversineDistance(BANGKOK, CHIANGMAI);
    const ba = haversineDistance(CHIANGMAI, BANGKOK);
    expect(ab).toBeCloseTo(ba, 10);
  });
});

describe('formatDistance', () => {
  it('should show meters for < 1 km', () => {
    expect(formatDistance(0.5)).toBe('500 ม.');
  });

  it('should show km for ≥ 1 km', () => {
    expect(formatDistance(5.23)).toBe('5.2 กม.');
  });

  it('should handle 0', () => {
    expect(formatDistance(0)).toBe('0 ม.');
  });

  it('should round meters correctly', () => {
    expect(formatDistance(0.123)).toBe('123 ม.');
  });
});

describe('formatDuration', () => {
  it('should show minutes for < 60', () => {
    expect(formatDuration(45)).toBe('45 นาที');
  });

  it('should show hours + minutes for ≥ 60', () => {
    expect(formatDuration(90)).toBe('1 ชม. 30 นาที');
  });

  it('should show hours only when even', () => {
    expect(formatDuration(120)).toBe('2 ชม.');
  });

  it('should handle 0', () => {
    expect(formatDuration(0)).toBe('0 นาที');
  });
});

describe('calculateRoute (Haversine fallback)', () => {
  it('should return haversine result when no API key', async () => {
    const result = await calculateRoute(OFFICE, SUKHUMVIT);
    expect(result.source).toBe('haversine');
    expect(result.distanceKm).toBeGreaterThan(0);
    expect(result.durationMinutes).toBeGreaterThan(0);
  });

  it('should estimate duration at ~25 km/h', async () => {
    const result = await calculateRoute(BANGKOK, CHIANGMAI);
    // 583 km / 25 km/h = ~23.3 hours = ~1400 minutes
    expect(result.durationMinutes).toBeGreaterThan(1300);
    expect(result.durationMinutes).toBeLessThan(1500);
  });
});

describe('calculateOptimizedRoute (Haversine nearest-neighbor)', () => {
  it('should return empty order for 0 waypoints', async () => {
    const result = await calculateOptimizedRoute(OFFICE, OFFICE, []);
    expect(result.optimizedOrder).toEqual([]);
    expect(result.source).toBe('haversine');
    expect(result.legs).toHaveLength(1); // direct origin → destination
  });

  it('should find optimal order for 3 waypoints', async () => {
    const waypoints = [BANGNA, SILOM, SUKHUMVIT]; // SILOM ใกล้ OFFICE สุด
    const result = await calculateOptimizedRoute(OFFICE, OFFICE, waypoints);

    expect(result.source).toBe('haversine');
    expect(result.optimizedOrder).toHaveLength(3);
    expect(result.totalDistanceKm).toBeGreaterThan(0);
    // First waypoint should be the nearest to office (SILOM, index 1)
    expect(result.optimizedOrder[0]).toBe(1); // SILOM is closest to OFFICE
  });

  it('should include return leg (last waypoint → destination)', async () => {
    const waypoints = [SILOM, SUKHUMVIT];
    const result = await calculateOptimizedRoute(OFFICE, OFFICE, waypoints);
    // legs = waypoints.length + 1 (includes final leg to destination)
    expect(result.legs).toHaveLength(waypoints.length + 1);
  });

  it('should have consistent total distance = sum of legs', async () => {
    const waypoints = [SILOM, SUKHUMVIT, BANGNA];
    const result = await calculateOptimizedRoute(OFFICE, OFFICE, waypoints);
    const sumLegs = result.legs.reduce((sum, leg) => sum + leg.distanceKm, 0);
    // Allow rounding difference
    expect(Math.abs(result.totalDistanceKm - sumLegs)).toBeLessThan(0.1);
  });
});

describe('calculateActualRouteDistance (Haversine fallback)', () => {
  it('should return 0 km for empty waypoints', async () => {
    const result = await calculateActualRouteDistance(OFFICE, []);
    expect(result.totalDistanceKm).toBe(0);
    expect(result.source).toBe('haversine');
  });

  it('should calculate round trip: office → waypoints → office', async () => {
    const result = await calculateActualRouteDistance(OFFICE, [SILOM, SUKHUMVIT], true);
    expect(result.totalDistanceKm).toBeGreaterThan(0);
    expect(result.source).toBe('haversine');
  });

  it('should calculate one-way: office → waypoints (no return)', async () => {
    const roundTrip = await calculateActualRouteDistance(OFFICE, [SILOM, SUKHUMVIT], true);
    const oneWay = await calculateActualRouteDistance(OFFICE, [SILOM, SUKHUMVIT], false);
    // One-way should be less than round trip
    expect(oneWay.totalDistanceKm).toBeLessThan(roundTrip.totalDistanceKm);
  });

  it('should sum segment distances correctly', async () => {
    // Single waypoint round trip: office → silom → office
    const result = await calculateActualRouteDistance(OFFICE, [SILOM], true);
    const officeToSilom = haversineDistance(OFFICE, SILOM);
    const silomToOffice = haversineDistance(SILOM, OFFICE);
    const expected = Math.round((officeToSilom + silomToOffice) * 100) / 100;
    expect(result.totalDistanceKm).toBeCloseTo(expected, 1);
  });
});

describe('Fuel Cost Calculation', () => {
  // ค่าน้ำมัน = ระยะทาง (km) × อัตรา (บาท/km)
  // ทดสอบ logic เดียวกับที่ใช้ใน analytics page
  const calculateFuelCost = (distanceKm: number, ratePerKm: number = 2.5) => {
    return distanceKm * ratePerKm;
  };

  it('should calculate fuel cost: 100 km × 2.5 = 250 บาท', () => {
    expect(calculateFuelCost(100, 2.5)).toBe(250);
  });

  it('should return 0 for 0 km', () => {
    expect(calculateFuelCost(0)).toBe(0);
  });

  it('should use custom rate', () => {
    expect(calculateFuelCost(100, 3.0)).toBe(300);
  });

  it('should handle fractional distances', () => {
    expect(calculateFuelCost(15.5, 2.5)).toBeCloseTo(38.75);
  });

  it('should calculate total for multiple messengers', () => {
    const messengers = [
      { name: 'แมส A', totalDistanceKm: 120 },
      { name: 'แมส B', totalDistanceKm: 85 },
      { name: 'แมส C', totalDistanceKm: 200 },
    ];
    const rate = 2.5;
    const totalFuel = messengers.reduce((sum, m) => sum + calculateFuelCost(m.totalDistanceKm, rate), 0);
    expect(totalFuel).toBe((120 + 85 + 200) * 2.5);
    expect(totalFuel).toBe(1012.5);
  });
});
