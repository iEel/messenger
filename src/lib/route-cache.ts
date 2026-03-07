// In-memory cache สำหรับ route results
// ลดการเรียก Google Routes API ซ้ำ → ประหยัดค่าใช้จ่าย

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class RouteCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly ttlMs: number;

  constructor(ttlMinutes = 5) {
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  // สร้าง key จากพิกัด (round to 4 decimals ≈ 11m accuracy)
  static coordKey(lat: number, lng: number): string {
    return `${lat.toFixed(4)},${lng.toFixed(4)}`;
  }

  static routeKey(fromLat: number, fromLng: number, toLat: number, toLng: number): string {
    return `${RouteCache.coordKey(fromLat, fromLng)}->${RouteCache.coordKey(toLat, toLng)}`;
  }

  static optimizeKey(origin: string, destination: string, waypointCount: number): string {
    return `opt:${origin}->${destination}:${waypointCount}`;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    // จำกัดขนาด cache ไม่ให้เกิน 500 entries
    if (this.cache.size >= 500) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, expiry: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Singleton instance — ใช้ร่วมกันทั้ง server
export const routeCache = new RouteCache(5);
export { RouteCache };
