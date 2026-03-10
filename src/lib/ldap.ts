import ldap from 'ldapjs';
import { query } from './db';

// ★ ldapjs มี bug ภายใน — parser throw TypeError ตอน parse AD response
// Error เกิดก่อน event emit → client.on('error') จับไม่ได้ → ต้องจับที่ process level
if (typeof process !== 'undefined' && !((globalThis as Record<string, unknown>).__ldapErrorHandlerInstalled)) {
  (globalThis as Record<string, unknown>).__ldapErrorHandlerInstalled = true;

  process.on('uncaughtException', (err) => {
    const msg = err?.message || '';
    const stack = err?.stack || '';

    // เฉพาะ ldapjs errors เท่านั้น (ดูจาก stack trace หรือข้อความที่เฉพาะเจาะจง)
    // หมายเหตุ: Next.js build อาจจะ minify จนคำว่า 'ldap' หายไปจาก stack
    const isLdapError =
      msg.includes('toLowerCase') || // ldapjs .attributes[].type.toLowerCase() bug
      msg.includes('Parser error for') ||
      (msg.includes('Expected 0x') && stack.includes('readTag')) ||
      stack.includes('ldap');

    if (isLdapError) {
      // แอบ log เงียบๆ ไม่ปิดแอป
      console.error(`[LDAP] Suppressed internal parser error: ${msg.substring(0, 100)}`);
      return; 
    }

    // Error อื่น (เช่น DB ขาดการเชื่อมต่อ, code ตัวเองพัง) → log แล้วปล่อย PM2 restart
    console.error(`[Uncaught Exception - Fatal] ${msg}`, err);
    process.exit(1);
  });
}

interface LdapSettings {
  url: string;
  domain: string;
  baseDn: string;
  enabled: boolean;
}

interface LdapUserInfo {
  cn: string;          // ชื่อ-นามสกุล
  employeeID: string;  // รหัสพนักงาน
  mail: string;        // email
  company: string;     // บริษัท
  department: string;  // แผนก (จาก OU)
  branch: string;      // สาขา (จาก OU)
  upn: string;         // username (ส่วนก่อน @)
}

/**
 * ดึงค่า LDAP settings จาก DB
 */
export async function getLdapSettings(): Promise<LdapSettings> {
  try {
    const rows = await query<{ SettingKey: string; SettingValue: string }[]>(
      `SELECT SettingKey, SettingValue FROM SystemSettings 
       WHERE SettingKey IN ('ldap_enabled','ldap_url','ldap_domain','ldap_base_dn')`
    );
    const map: Record<string, string> = {};
    rows.forEach(r => { map[r.SettingKey] = r.SettingValue; });

    return {
      enabled: map['ldap_enabled'] === 'true',
      url: map['ldap_url'] || '',
      domain: map['ldap_domain'] || '',
      baseDn: map['ldap_base_dn'] || '',
    };
  } catch {
    return { enabled: false, url: '', domain: '', baseDn: '' };
  }
}

/**
 * Parse distinguishedName เพื่อดึงค่า OU
 * เช่น "CN=Veerapon L,OU=Global Partner,OU=SathuPradit,DC=soniclocal,DC=com"
 * → department = "Global Partner", branch = "SathuPradit"
 */
function parseDN(dn: string): { department: string; branch: string } {
  const ous = dn.split(',')
    .filter(part => part.trim().toUpperCase().startsWith('OU='))
    .map(part => part.trim().replace(/^OU=/i, ''));
  
  return {
    department: ous[0] || '',  // OU แรก = แผนก
    branch: ous[1] || '',      // OU ที่สอง = สาขา
  };
}

/**
 * สร้าง LDAP client
 */
function createClient(url: string): ldap.Client {
  const client = ldap.createClient({
    url: [url],
    tlsOptions: { rejectUnauthorized: false },
    connectTimeout: 10000,
    timeout: 10000,
    strictDN: false, // ★ ไม่ crash เมื่อ AD ส่ง DN ที่ไม่ตรง spec
  });

  // ★ จับ error จาก ldapjs parser ไม่ให้ crash ทั้ง app (uncaughtException)
  client.on('error', (err) => {
    console.error('[LDAP Client] Error (suppressed):', err?.message || err);
  });
  client.on('connectError', (err) => {
    console.error('[LDAP Client] Connect error:', err?.message || err);
  });

  return client;
}

/**
 * Bind (authenticate) ด้วย LDAP
 */
function bindAsync(client: ldap.Client, dn: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.bind(dn, password, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Search LDAP entries
 */
function searchAsync(client: ldap.Client, baseDn: string, opts: ldap.SearchOptions): Promise<ldap.SearchEntry[]> {
  return new Promise((resolve, reject) => {
    const entries: ldap.SearchEntry[] = [];
    try {
      client.search(baseDn, opts, (err, res) => {
        if (err) return reject(err);
        res.on('searchEntry', (entry) => {
          try {
            entries.push(entry);
          } catch { /* skip bad entry */ }
        });
        res.on('error', (err) => {
          // ★ ldapjs parser errors — คืน entries ที่ได้แล้ว
          console.error('[LDAP Search] Error during search (returning partial results):', err?.message);
          resolve(entries);
        });
        res.on('end', () => resolve(entries));
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * ★ Authenticate user via LDAP + ดึงข้อมูล
 * username = UPN prefix เช่น "veerapon.l"
 */
export async function ldapAuthenticate(username: string, password: string): Promise<LdapUserInfo | null> {
  const settings = await getLdapSettings();
  if (!settings.enabled || !settings.url || !settings.domain) {
    return null;
  }

  const upn = `${username}@${settings.domain}`;
  const client = createClient(settings.url);

  try {
    // 1. Bind ด้วย user credentials
    await bindAsync(client, upn, password);

    // 2. Bind ด้วย service account เพื่อ search ข้อมูล
    const bindDn = process.env.LDAP_BIND_DN;
    const bindPw = process.env.LDAP_BIND_PASSWORD;
    if (bindDn && bindPw) {
      await bindAsync(client, bindDn, bindPw);
    }

    // 3. Search user info
    const searchFilter = `(&(objectClass=user)(objectCategory=person)(|(userPrincipalName=${upn})(sAMAccountName=${username})))`;
    const entries = await searchAsync(client, settings.baseDn, {
      filter: searchFilter,
      scope: 'sub',
      attributes: ['cn', 'employeeID', 'mail', 'company', 'distinguishedName', 'userPrincipalName', 'sAMAccountName'],
    });

    if (entries.length === 0) {
      // Auth สำเร็จแต่หาข้อมูลไม่เจอ — ใช้ username เป็น fallback
      return {
        cn: username,
        employeeID: username,
        mail: upn,
        company: '',
        department: '',
        branch: '',
        upn: username,
      };
    }

    const entry = entries[0] as unknown as Record<string, unknown>;

    // Extract attributes from ldapjs SearchEntry (cast to any for internal access)
    const attrs: Record<string, string> = {};

    // Method 1: entry.attributes (ldapjs v3)
    const rawAttrs = (entry.attributes || entry.ppiA || []) as { type: string; values: string[] }[];
    if (Array.isArray(rawAttrs)) {
      for (const a of rawAttrs) {
        if (a.type && a.values?.[0] != null) {
          attrs[a.type.toLowerCase()] = String(a.values[0]);
        }
      }
    }

    // Method 2: entry.object (ldapjs v2 compat)
    const obj = (entry.object || entry.ppiB || {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      if (!attrs[k.toLowerCase()] && v) {
        attrs[k.toLowerCase()] = String(v);
      }
    }

    const dn = attrs['distinguishedname'] || '';
    const { department, branch } = parseDN(dn);

    return {
      cn: attrs['cn'] || username,
      employeeID: attrs['employeeid'] || username,
      mail: attrs['mail'] || upn,
      company: attrs['company'] || '',
      department,
      branch,
      upn: username,
    };
  } catch (err) {
    console.error('[LDAP] Auth error:', err);
    return null;
  } finally {
    try { client.unbind(); } catch { /* ignore */ }
  }
}

/**
 * ★ ทดสอบการเชื่อมต่อ LDAP (ใช้ Service Account)
 */
export async function ldapTestConnection(): Promise<{ success: boolean; message: string; userCount?: number }> {
  const settings = await getLdapSettings();
  if (!settings.url) {
    return { success: false, message: 'กรุณาตั้งค่า Server URL ก่อน' };
  }

  const bindDn = process.env.LDAP_BIND_DN;
  const bindPw = process.env.LDAP_BIND_PASSWORD;
  if (!bindDn || !bindPw) {
    return { success: false, message: 'กรุณาตั้งค่า LDAP_BIND_DN และ LDAP_BIND_PASSWORD ใน .env' };
  }

  const client = createClient(settings.url);

  try {
    await bindAsync(client, bindDn, bindPw);

    // นับ user objects
    if (settings.baseDn) {
      const entries = await searchAsync(client, settings.baseDn, {
        filter: '(&(objectClass=user)(objectCategory=person))',
        scope: 'sub',
        attributes: ['cn'],
        sizeLimit: 1000,
      });
      return { success: true, message: `เชื่อมต่อสำเร็จ ✅ พบ ${entries.length} users`, userCount: entries.length };
    }

    return { success: true, message: 'เชื่อมต่อสำเร็จ ✅ (Bind OK)' };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `เชื่อมต่อไม่ได้: ${errMsg}` };
  } finally {
    try { client.unbind(); } catch { /* ignore */ }
  }
}

// ============================================================
// ★ AD Sync — ดึง user จาก AD ทั้งหมด เทียบกับ DB
// ============================================================

interface AdSyncResult {
  success: boolean;
  message: string;
  synced: number;      // user ที่ตรวจเทียบ
  disabled: number;    // user ที่ถูก disable (ไม่อยู่ใน AD แล้ว)
  updated: number;     // user ที่ข้อมูลถูก update
  errors: string[];    // errors ระหว่าง sync
}

/**
 * ★ Sync AD users กับ DB
 * - ดึง user ทั้งหมดจาก AD (via service account)
 * - เทียบกับ AD users ใน DB (PasswordHash = 'AD_USER_NO_LOCAL_PASSWORD' หรือ AdUsername != NULL)
 * - AD user ที่ไม่อยู่ใน AD แล้ว → set IsActive = 0
 * - AD user ที่ข้อมูลเปลี่ยน (ชื่อ, email, แผนก) → update DB
 */
export async function ldapSyncUsers(): Promise<AdSyncResult> {
  const result: AdSyncResult = { success: false, message: '', synced: 0, disabled: 0, updated: 0, errors: [] };

  const settings = await getLdapSettings();
  if (!settings.enabled || !settings.url || !settings.baseDn) {
    result.message = 'LDAP ไม่ได้เปิดใช้งาน หรือยังไม่ได้ตั้งค่า';
    return result;
  }

  const bindDn = process.env.LDAP_BIND_DN;
  const bindPw = process.env.LDAP_BIND_PASSWORD;
  if (!bindDn || !bindPw) {
    result.message = 'ไม่มี LDAP_BIND_DN / LDAP_BIND_PASSWORD ใน .env';
    return result;
  }

  const client = createClient(settings.url);

  try {
    // 1. ดึง AD users จาก DB ก่อน (เฉพาะคนที่เป็น AD user)
    const dbAdUsers = await query<{
      Id: number; FullName: string; Email: string; Department: string;
      AdUsername: string; IsActive: boolean; EmployeeId: string;
    }[]>(
      `SELECT Id, FullName, Email, Department, AdUsername, IsActive, EmployeeId
       FROM Users
       WHERE AdUsername IS NOT NULL OR PasswordHash = 'AD_USER_NO_LOCAL_PASSWORD'`
    );

    if (dbAdUsers.length === 0) {
      result.message = 'ไม่มี AD User ในระบบ ไม่ต้องดึงข้อมูลจาก LDAP';
      return result;
    }

    // รวบรวม username ที่ต้องค้นหา
    const usernamesToSearch = Array.from(new Set(
      dbAdUsers.map(u => (u.AdUsername || u.EmployeeId || '').toLowerCase()).filter(Boolean)
    ));

    // 2. Bind ด้วย service account
    await bindAsync(client, bindDn, bindPw);

    // 3. ค้นหาใน AD โดยแบ่งเป็นชุดๆ ละ 50 คน (ป้องกัน filter ยาวเกิน + กัน parser ล้น)
    const chunkSize = 50;
    const allEntries: ldap.SearchEntry[] = [];

    for (let i = 0; i < usernamesToSearch.length; i += chunkSize) {
      const chunk = usernamesToSearch.slice(i, i + chunkSize);
      
      // สร้าง filter: (|(sAMAccountName=a)(userPrincipalName=a@*)(sAMAccountName=b)...)
      const userFilters = chunk.map(u => `(sAMAccountName=${u})(userPrincipalName=${u}@*)`).join('');
      const filter = `(&(objectClass=user)(objectCategory=person)(|${userFilters}))`;

      const entries = await searchAsync(client, settings.baseDn, {
        filter,
        scope: 'sub',
        attributes: ['cn', 'employeeID', 'mail', 'company', 'distinguishedName', 'userPrincipalName', 'sAMAccountName'],
        sizeLimit: 100, // แค่ 50-100 คนต่อรอบ ไม่มีปัญหาเรื่อง buffer แน่นอน
      });
      allEntries.push(...entries);
    }

    // สร้าง Set ของ AD usernames ที่เจอใน AD (sAMAccountName / UPN prefix)
    const adUsernames = new Set<string>();
    const adUserMap = new Map<string, { cn: string; mail: string; department: string }>();

    for (const entry of allEntries) {
      try {
        const attrs: Record<string, string> = {};

        // ldapjs v3: entry.attributes
        const rawAttrs = ((entry as unknown as Record<string, unknown>).attributes || []) as { type?: string; values?: string[] }[];
        if (Array.isArray(rawAttrs)) {
          for (const a of rawAttrs) {
            if (a && typeof a.type === 'string' && a.values?.[0] != null) {
              attrs[a.type.toLowerCase()] = String(a.values[0]);
            }
          }
        }

        // ldapjs v2: entry.object
        const obj = ((entry as unknown as Record<string, unknown>).object || {}) as Record<string, unknown>;
        for (const [k, v] of Object.entries(obj)) {
          if (k && typeof k === 'string' && !attrs[k.toLowerCase()] && v != null) {
            attrs[k.toLowerCase()] = String(v);
          }
        }

        // Extract username
        const upn = attrs['userprincipalname'] || '';
        const sam = attrs['samaccountname'] || '';
        const username = sam || upn.split('@')[0] || '';

        if (username) {
          adUsernames.add(username.toLowerCase());

          const dn = attrs['distinguishedname'] || '';
          const { department } = parseDN(dn);

          adUserMap.set(username.toLowerCase(), {
            cn: attrs['cn'] || username,
            mail: attrs['mail'] || '',
            department,
          });
        }
      } catch (parseErr) {
        console.warn('[AD Sync] Skip entry (parse error):', parseErr);
        continue;
      }
    }

    result.synced = adUsernames.size;

    // ★★★ SAFEGUARD: ถ้าค้นหาทั้งหมดแล้วได้ 0 แต่ในระบบมีพนักงานเยอะมาก อาจเกิดจาก LDAP error กลางทาง
    // (แต่ถ้าระบบเพิ่งมี 1-2 คนแล้วโดนลบหมด AD จริง ก็อาจเป็น 0 ได้)
    // ตรงนี้เราไว้ใจได้มากขึ้นเพราะแบ่งดึงทีละ 50 คน โอกาส parser พังแทบไม่มีแล้ว
    if (adUsernames.size === 0 && usernamesToSearch.length > 5) {
      result.message = 'AD search ส่ง 0 users (ทั้งที่ค้นหาจากหลายคน) — ข้าม disable เพื่อป้องกัน false positive';
      console.warn(`[AD Sync] ${result.message}`);
      result.success = false;
      return result;
    }

    for (const dbUser of dbAdUsers) {
      const adUsername = (dbUser.AdUsername || dbUser.EmployeeId || '').toLowerCase();

      if (!adUsername) continue;

      if (!adUsernames.has(adUsername)) {
        // ★ User ไม่อยู่ใน AD แล้ว → disable
        if (dbUser.IsActive) {
          try {
            await query(
              'UPDATE Users SET IsActive = 0, UpdatedAt = GETDATE() WHERE Id = @id',
              { id: dbUser.Id }
            );
            result.disabled++;
            console.log(`[AD Sync] Disabled: ${dbUser.FullName} (${adUsername}) — ไม่พบใน AD`);
          } catch (err) {
            result.errors.push(`Disable ${dbUser.FullName}: ${err}`);
          }
        }
      } else {
        // ★ User ยังอยู่ใน AD → เช็คข้อมูลที่เปลี่ยน
        const adInfo = adUserMap.get(adUsername);
        if (adInfo && dbUser.IsActive) {
          const changes: string[] = [];
          const updateFields: string[] = [];
          const params: Record<string, unknown> = { id: dbUser.Id };

          if (adInfo.cn && adInfo.cn !== dbUser.FullName) {
            updateFields.push('FullName = @fullName');
            params.fullName = adInfo.cn;
            changes.push(`ชื่อ: ${dbUser.FullName} → ${adInfo.cn}`);
          }
          if (adInfo.mail && adInfo.mail !== (dbUser.Email || '')) {
            updateFields.push('Email = @email');
            params.email = adInfo.mail;
            changes.push(`email: ${dbUser.Email} → ${adInfo.mail}`);
          }
          if (adInfo.department && adInfo.department !== (dbUser.Department || '')) {
            updateFields.push('Department = @department');
            params.department = adInfo.department;
            changes.push(`แผนก: ${dbUser.Department} → ${adInfo.department}`);
          }

          if (updateFields.length > 0) {
            try {
              updateFields.push('UpdatedAt = GETDATE()');
              await query(
                `UPDATE Users SET ${updateFields.join(', ')} WHERE Id = @id`,
                params
              );
              result.updated++;
              console.log(`[AD Sync] Updated: ${dbUser.FullName} — ${changes.join(', ')}`);
            } catch (err) {
              result.errors.push(`Update ${dbUser.FullName}: ${err}`);
            }
          }
        }
      }
    }

    result.success = true;
    result.message = `Sync สำเร็จ: ตรวจ ${result.synced} AD users, disabled ${result.disabled}, updated ${result.updated}`;
    console.log(`[AD Sync] ${result.message}`);
    return result;

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    result.message = `AD Sync error: ${errMsg}`;
    console.error(`[AD Sync] ${result.message}`);
    return result;
  } finally {
    try { client.unbind(); } catch { /* ignore */ }
  }
}

