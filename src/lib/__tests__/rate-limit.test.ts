/**
 * Integration Tests — rate-limit.ts
 * ทดสอบ Sliding window rate limiter: allow/block, unblock, config, stats
 * 
 * หมายเหตุ: rate-limit.ts ใช้ globalThis → ต้อง reset ระหว่าง test
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  getRateLimitStats,
  getRateLimitConfig,
  unblockIp,
} from '../rate-limit';

// Helper: reset globalThis rate limit stores between tests
function resetRateLimitStores() {
  const g = globalThis as Record<string, unknown>;
  if (g.__rateLimitGeneral instanceof Map) g.__rateLimitGeneral.clear();
  if (g.__rateLimitLogin instanceof Map) g.__rateLimitLogin.clear();
}

beforeEach(() => {
  resetRateLimitStores();
});

describe('checkRateLimit — general', () => {
  it('should allow first request', () => {
    const result = checkRateLimit('192.168.1.1');
    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBe(0);
  });

  it('should decrement remaining count', () => {
    const config = getRateLimitConfig();
    const maxReq = config.general.maxRequests;

    const r1 = checkRateLimit('10.0.0.1');
    expect(r1.remaining).toBe(maxReq - 1);

    const r2 = checkRateLimit('10.0.0.1');
    expect(r2.remaining).toBe(maxReq - 2);
  });

  it('should block after exceeding limit', () => {
    const config = getRateLimitConfig();
    const maxReq = config.general.maxRequests;

    // Exhaust all requests
    for (let i = 0; i < maxReq; i++) {
      const result = checkRateLimit('10.0.0.2');
      expect(result.allowed).toBe(true);
    }

    // Next request should be blocked
    const blocked = checkRateLimit('10.0.0.2');
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('should not affect different IPs', () => {
    const config = getRateLimitConfig();
    const maxReq = config.general.maxRequests;

    // Exhaust IP-A
    for (let i = 0; i <= maxReq; i++) {
      checkRateLimit('ip-a');
    }

    // IP-B should still be allowed
    const result = checkRateLimit('ip-b');
    expect(result.allowed).toBe(true);
  });
});

describe('checkRateLimit — login', () => {
  it('should use separate store for login type', () => {
    const config = getRateLimitConfig();
    const loginMax = config.login.maxRequests;

    // Exhaust login limit (default: 5)
    for (let i = 0; i < loginMax; i++) {
      const result = checkRateLimit('10.0.0.3', 'login');
      expect(result.allowed).toBe(true);
    }

    // Login should be blocked
    const blocked = checkRateLimit('10.0.0.3', 'login');
    expect(blocked.allowed).toBe(false);

    // General should still be allowed (separate store)
    const general = checkRateLimit('10.0.0.3', 'general');
    expect(general.allowed).toBe(true);
  });
});

describe('unblockIp', () => {
  it('should unblock a blocked IP', () => {
    const config = getRateLimitConfig();
    const maxReq = config.general.maxRequests;

    // Block IP
    for (let i = 0; i <= maxReq; i++) {
      checkRateLimit('blocked-ip');
    }
    expect(checkRateLimit('blocked-ip').allowed).toBe(false);

    // Unblock
    const result = unblockIp('blocked-ip');
    expect(result).toBe(true);

    // Should be allowed again
    expect(checkRateLimit('blocked-ip').allowed).toBe(true);
  });

  it('should return false for non-existent IP', () => {
    const result = unblockIp('nonexistent-ip');
    expect(result).toBe(false);
  });
});

describe('getRateLimitConfig', () => {
  it('should return default config', () => {
    const config = getRateLimitConfig();
    expect(config.general.maxRequests).toBe(200);
    expect(config.general.windowMs).toBe(60 * 1000);
    expect(config.login.maxRequests).toBe(5);
    expect(config.login.blockDurationMs).toBe(15 * 60 * 1000);
  });
});

describe('getRateLimitStats', () => {
  it('should return empty stats when no requests', () => {
    const stats = getRateLimitStats();
    expect(stats.general).toHaveLength(0);
    expect(stats.login).toHaveLength(0);
  });

  it('should show active IPs after requests', () => {
    checkRateLimit('10.0.0.10', 'general');
    checkRateLimit('10.0.0.11', 'general');
    checkRateLimit('10.0.0.10', 'general'); // second request from same IP

    const stats = getRateLimitStats();
    expect(stats.general.length).toBeGreaterThanOrEqual(2);

    const ip10Stats = stats.general.find(s => s.ip === '10.0.0.10');
    expect(ip10Stats).toBeDefined();
    expect(ip10Stats!.count).toBe(2);
    expect(ip10Stats!.blocked).toBe(false);
  });

  it('should show blocked status for blocked IPs', () => {
    const config = getRateLimitConfig();
    // Block IP
    for (let i = 0; i <= config.general.maxRequests; i++) {
      checkRateLimit('bad-ip');
    }

    const stats = getRateLimitStats();
    const blockedStats = stats.general.find(s => s.ip === 'bad-ip');
    expect(blockedStats).toBeDefined();
    expect(blockedStats!.blocked).toBe(true);
    expect(blockedStats!.blockedAt).not.toBeNull();
  });
});
