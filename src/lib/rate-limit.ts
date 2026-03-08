/**
 * ★ In-Memory Rate Limiter — Sliding Window
 * ใช้ในระดับ middleware สำหรับป้องกัน brute force / abuse
 */

interface RateLimitEntry {
  count: number;
  firstRequest: number;
  blocked: boolean;
  blockedAt?: number;
}

interface RateLimitConfig {
  windowMs: number;      // ช่วงเวลา (ms) เช่น 60000 = 1 นาที
  maxRequests: number;   // จำนวน request สูงสุดต่อช่วง
  blockDurationMs: number; // ระยะเวลาที่ถูกบล็อก (ms) เช่น 300000 = 5 นาที
}

interface RateLimitStats {
  ip: string;
  count: number;
  blocked: boolean;
  blockedAt: string | null;
  firstRequest: string;
  remainingMs: number;
}

// ★ Default config (mutable for admin changes)
let generalConfig: RateLimitConfig = {
  windowMs: 60 * 1000,        // 1 นาที
  maxRequests: 200,            // 200 requests/นาที (Next.js SPA ส่ง request เยอะ)
  blockDurationMs: 5 * 60 * 1000, // บล็อก 5 นาที
};

// ★ Login-specific config (เข้มงวดกว่า)
let loginConfig: RateLimitConfig = {
  windowMs: 60 * 1000,        // 1 นาที
  maxRequests: 5,              // 5 ครั้ง/นาที
  blockDurationMs: 15 * 60 * 1000, // บล็อก 15 นาที
};

// In-memory stores
const generalStore = new Map<string, RateLimitEntry>();
const loginStore = new Map<string, RateLimitEntry>();

// Auto-cleanup every 10 minutes
setInterval(() => {
  const now = Date.now();
  [generalStore, loginStore].forEach(store => {
    for (const [key, entry] of store) {
      const maxAge = entry.blocked
        ? (entry.blockedAt || now) + generalConfig.blockDurationMs
        : entry.firstRequest + generalConfig.windowMs;
      if (now > maxAge + 60000) {
        store.delete(key);
      }
    }
  });
}, 10 * 60 * 1000);

/**
 * ★ ตรวจสอบ rate limit
 * @returns { allowed: boolean, remaining: number, retryAfterMs: number }
 */
export function checkRateLimit(
  ip: string,
  type: 'general' | 'login' = 'general'
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const store = type === 'login' ? loginStore : generalStore;
  const config = type === 'login' ? loginConfig : generalConfig;
  const now = Date.now();

  let entry = store.get(ip);

  // ถ้าถูกบล็อกอยู่ → เช็คว่าหมดเวลาหรือยัง
  if (entry?.blocked) {
    const elapsed = now - (entry.blockedAt || 0);
    if (elapsed < config.blockDurationMs) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: config.blockDurationMs - elapsed,
      };
    }
    // หมดเวลาบล็อก → reset
    store.delete(ip);
    entry = undefined;
  }

  // ถ้ายังไม่มี record หรือ window หมดอายุ → สร้างใหม่
  if (!entry || (now - entry.firstRequest) > config.windowMs) {
    store.set(ip, { count: 1, firstRequest: now, blocked: false });
    return { allowed: true, remaining: config.maxRequests - 1, retryAfterMs: 0 };
  }

  // เพิ่ม count
  entry.count++;

  // ถ้าเกิน limit → บล็อก
  if (entry.count > config.maxRequests) {
    entry.blocked = true;
    entry.blockedAt = now;
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: config.blockDurationMs,
    };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    retryAfterMs: 0,
  };
}

/**
 * ★ ดึงสถิติ rate limit ทั้งหมด (สำหรับ Admin UI)
 */
export function getRateLimitStats(): { general: RateLimitStats[]; login: RateLimitStats[] } {
  const now = Date.now();

  const mapStats = (store: Map<string, RateLimitEntry>, config: RateLimitConfig): RateLimitStats[] => {
    const stats: RateLimitStats[] = [];
    for (const [ip, entry] of store) {
      const windowExpired = (now - entry.firstRequest) > config.windowMs;
      const blockExpired = entry.blocked && (now - (entry.blockedAt || 0)) > config.blockDurationMs;

      if (windowExpired && !entry.blocked) continue;
      if (blockExpired) continue;

      stats.push({
        ip,
        count: entry.count,
        blocked: entry.blocked && !blockExpired,
        blockedAt: entry.blockedAt ? new Date(entry.blockedAt).toISOString() : null,
        firstRequest: new Date(entry.firstRequest).toISOString(),
        remainingMs: entry.blocked
          ? Math.max(0, config.blockDurationMs - (now - (entry.blockedAt || 0)))
          : Math.max(0, config.windowMs - (now - entry.firstRequest)),
      });
    }
    return stats.sort((a, b) => b.count - a.count);
  };

  return {
    general: mapStats(generalStore, generalConfig),
    login: mapStats(loginStore, loginConfig),
  };
}

/**
 * ★ ปลดบล็อก IP (Admin action)
 */
export function unblockIp(ip: string): boolean {
  let unblocked = false;
  [generalStore, loginStore].forEach(store => {
    if (store.has(ip)) {
      store.delete(ip);
      unblocked = true;
    }
  });
  return unblocked;
}

/**
 * ★ ดึง config ปัจจุบัน
 */
export function getRateLimitConfig() {
  return {
    general: { ...generalConfig },
    login: { ...loginConfig },
  };
}

/**
 * ★ อัปเดต config (Admin action) + บันทึกลง DB
 */
export async function updateRateLimitConfig(updates: {
  general?: Partial<RateLimitConfig>;
  login?: Partial<RateLimitConfig>;
}) {
  if (updates.general) {
    generalConfig = { ...generalConfig, ...updates.general };
  }
  if (updates.login) {
    loginConfig = { ...loginConfig, ...updates.login };
  }

  // บันทึกลง DB
  try {
    const { query: dbQuery } = await import('./db');
    const configJson = JSON.stringify({ general: generalConfig, login: loginConfig });
    await dbQuery(
      `MERGE SystemSettings AS target
       USING (SELECT 'rate_limit_config' AS SettingKey) AS source
       ON target.SettingKey = source.SettingKey
       WHEN MATCHED THEN UPDATE SET SettingValue = @val, UpdatedAt = GETDATE()
       WHEN NOT MATCHED THEN INSERT (SettingKey, SettingValue) VALUES ('rate_limit_config', @val);`,
      { val: configJson }
    );
  } catch (err) {
    console.error('[RateLimit] Save config to DB error:', err);
  }

  return getRateLimitConfig();
}

/**
 * ★ โหลด config จาก DB (เรียกตอน startup)
 */
export async function loadRateLimitConfigFromDb() {
  try {
    const { query: dbQuery } = await import('./db');
    const rows = await dbQuery<{ SettingValue: string }[]>(
      `SELECT SettingValue FROM SystemSettings WHERE SettingKey = 'rate_limit_config'`
    );
    if (rows.length > 0 && rows[0].SettingValue) {
      const saved = JSON.parse(rows[0].SettingValue);
      if (saved.general) generalConfig = { ...generalConfig, ...saved.general };
      if (saved.login) loginConfig = { ...loginConfig, ...saved.login };
      console.log('[RateLimit] Config loaded from DB:', { general: generalConfig, login: loginConfig });
    }
  } catch (err) {
    console.error('[RateLimit] Load config from DB error:', err);
  }
}

