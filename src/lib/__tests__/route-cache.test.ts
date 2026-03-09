/**
 * Unit Tests — route-cache.ts
 * ทดสอบ In-memory cache: TTL, size limit, key generation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RouteCache } from '../route-cache';

describe('RouteCache — key generation', () => {
  it('coordKey should round to 4 decimal places', () => {
    expect(RouteCache.coordKey(13.75630001, 100.50180002)).toBe('13.7563,100.5018');
  });

  it('routeKey should format as "from->to"', () => {
    const key = RouteCache.routeKey(13.7563, 100.5018, 18.7883, 98.9853);
    expect(key).toBe('13.7563,100.5018->18.7883,98.9853');
  });

  it('optimizeKey should include waypoint count', () => {
    const key = RouteCache.optimizeKey('13.7563,100.5018', '18.7883,98.9853', 3);
    expect(key).toBe('opt:13.7563,100.5018->18.7883,98.9853:3');
  });
});

describe('RouteCache — get/set', () => {
  let cache: InstanceType<typeof RouteCache>;

  beforeEach(() => {
    cache = new RouteCache(5); // 5 min TTL
  });

  it('should return null for missing key', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('should store and retrieve value', () => {
    cache.set('key1', { distanceKm: 10 });
    expect(cache.get('key1')).toEqual({ distanceKm: 10 });
  });

  it('should store different types', () => {
    cache.set('str', 'hello');
    cache.set('num', 42);
    cache.set('obj', { a: 1, b: [2, 3] });

    expect(cache.get('str')).toBe('hello');
    expect(cache.get('num')).toBe(42);
    expect(cache.get('obj')).toEqual({ a: 1, b: [2, 3] });
  });

  it('should overwrite existing key', () => {
    cache.set('key', 'old');
    cache.set('key', 'new');
    expect(cache.get('key')).toBe('new');
  });
});

describe('RouteCache — TTL expiry', () => {
  it('should return null after TTL expires', () => {
    vi.useFakeTimers();
    const cache = new RouteCache(1); // 1 minute TTL

    cache.set('key', 'value');
    expect(cache.get('key')).toBe('value');

    // Advance time past TTL (1 minute + 1ms)
    vi.advanceTimersByTime(60 * 1000 + 1);
    expect(cache.get('key')).toBeNull();

    vi.useRealTimers();
  });

  it('should return value before TTL expires', () => {
    vi.useFakeTimers();
    const cache = new RouteCache(5); // 5 minute TTL

    cache.set('key', 'value');

    // Advance 4 minutes (still within TTL)
    vi.advanceTimersByTime(4 * 60 * 1000);
    expect(cache.get('key')).toBe('value');

    vi.useRealTimers();
  });
});

describe('RouteCache — size limit (500 entries)', () => {
  it('should evict oldest entry when exceeding 500', () => {
    const cache = new RouteCache(60); // very long TTL

    // Fill cache with 500 entries
    for (let i = 0; i < 500; i++) {
      cache.set(`key${i}`, i);
    }

    // First entry should still exist
    expect(cache.get('key0')).toBe(0);

    // Add 501st entry — should evict key0
    cache.set('key500', 500);
    expect(cache.get('key0')).toBeNull();
    expect(cache.get('key500')).toBe(500);

    // key1 should still exist
    expect(cache.get('key1')).toBe(1);
  });
});

describe('RouteCache — clear', () => {
  it('should remove all entries', () => {
    const cache = new RouteCache(5);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    cache.clear();

    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBeNull();
    expect(cache.get('c')).toBeNull();
  });
});
