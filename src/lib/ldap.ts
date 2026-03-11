import { Client } from 'ldapts';
import { query } from './db';

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
 * สร้าง ldapts Client
 */
function createClient(url: string): Client {
  return new Client({
    url,
    tlsOptions: { rejectUnauthorized: false },
    connectTimeout: 15000,
    timeout: 30000,
    strictDN: false,
  });
}

/**
 * ดึง attributes จาก search entry เป็น Record
 */
function extractAttrs(entry: Record<string, unknown>): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(entry)) {
    if (k === 'dn' || k === 'controls') continue;
    if (v != null && typeof k === 'string') {
      // ldapts returns arrays for multi-value, take first
      const val = Array.isArray(v) ? v[0] : v;
      if (val != null) {
        attrs[k.toLowerCase()] = String(val);
      }
    }
  }
  return attrs;
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
    await client.bind(upn, password);

    // 2. Bind ด้วย service account เพื่อ search ข้อมูล
    const bindDn = process.env.LDAP_BIND_DN;
    const bindPw = process.env.LDAP_BIND_PASSWORD;
    if (bindDn && bindPw) {
      await client.bind(bindDn, bindPw);
    }

    // 3. Search user info
    const searchFilter = `(&(objectClass=user)(objectCategory=person)(|(userPrincipalName=${upn})(sAMAccountName=${username})))`;
    const { searchEntries } = await client.search(settings.baseDn, {
      filter: searchFilter,
      scope: 'sub',
      attributes: ['cn', 'employeeID', 'mail', 'company', 'distinguishedName', 'userPrincipalName', 'sAMAccountName'],
    });

    if (searchEntries.length === 0) {
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

    const attrs = extractAttrs(searchEntries[0] as unknown as Record<string, unknown>);
    const dn = attrs['distinguishedname'] || (searchEntries[0].dn as string) || '';
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
    try { await client.unbind(); } catch { /* ignore */ }
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
    await client.bind(bindDn, bindPw);

    // นับ user objects
    if (settings.baseDn) {
      const { searchEntries } = await client.search(settings.baseDn, {
        filter: '(&(objectClass=user)(objectCategory=person))',
        scope: 'sub',
        attributes: ['cn'],
        sizeLimit: 1000,
        paged: true,
      });
      return { success: true, message: `เชื่อมต่อสำเร็จ ✅ พบ ${searchEntries.length} users`, userCount: searchEntries.length };
    }

    return { success: true, message: 'เชื่อมต่อสำเร็จ ✅ (Bind OK)' };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `เชื่อมต่อไม่ได้: ${errMsg}` };
  } finally {
    try { await client.unbind(); } catch { /* ignore */ }
  }
}

// ============================================================
// ★ AD Sync — ดึง user จาก DB ก่อน แล้วค้นหาใน AD ทีละชุด
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
 * - ดึง AD users จาก DB ของเราก่อน
 * - ค้นหาใน AD เฉพาะคนที่มีในระบบ (ทีละ 50 คน)
 * - AD user ที่ไม่อยู่ใน AD แล้ว → set IsActive = 0
 * - AD user ที่ข้อมูลเปลี่ยน → update DB
 */
export async function ldapSyncUsers(): Promise<AdSyncResult> {
  const result: AdSyncResult = {
    success: false,
    message: '',
    synced: 0,
    disabled: 0,
    updated: 0,
    errors: [],
  };

  const settings = await getLdapSettings();
  if (!settings.enabled || !settings.url || !settings.baseDn) {
    result.message = 'LDAP ไม่ได้เปิดใช้งาน หรือยังไม่ได้ตั้งค่า';
    return result;
  }

  const bindDn = process.env.LDAP_BIND_DN;
  const bindPw = process.env.LDAP_BIND_PASSWORD;
  if (!bindDn || !bindPw) {
    result.message = 'ไม่พบ LDAP_BIND_DN หรือ LDAP_BIND_PASSWORD ใน .env';
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
      result.success = true;
      return result;
    }

    // รวบรวม username ที่ต้องค้นหา
    const usernamesToSearch = Array.from(new Set(
      dbAdUsers.map(u => (u.AdUsername || u.EmployeeId || '').toLowerCase()).filter(Boolean)
    ));

    // 2. Bind ด้วย service account
    console.log(`[AD Sync] Binding to ${settings.url} ...`);
    await client.bind(bindDn, bindPw);
    console.log(`[AD Sync] Bind สำเร็จ — ค้นหา ${usernamesToSearch.length} users: ${usernamesToSearch.join(', ')}`);

    // 3. ค้นหาใน AD โดยแบ่งเป็นชุดๆ ละ 50 คน
    const chunkSize = 50;
    const adUsernames = new Set<string>();
    const adUserMap = new Map<string, { cn: string; mail: string; department: string }>();

    for (let i = 0; i < usernamesToSearch.length; i += chunkSize) {
      const chunk = usernamesToSearch.slice(i, i + chunkSize);
      
      // สร้าง filter: (|(sAMAccountName=a)(userPrincipalName=a@*)(sAMAccountName=b)...)
      const userFilters = chunk.map(u => `(sAMAccountName=${u})(userPrincipalName=${u}@*)`).join('');
      const filter = `(&(objectClass=user)(objectCategory=person)(|${userFilters}))`;

      try {
        console.log(`[AD Sync] Searching baseDn=${settings.baseDn}, filter=${filter.substring(0, 100)}...`);
        const { searchEntries } = await client.search(settings.baseDn, {
          filter,
          scope: 'sub',
          attributes: ['cn', 'employeeID', 'mail', 'company', 'distinguishedName', 'userPrincipalName', 'sAMAccountName'],
          sizeLimit: 100,
        });

        for (const entry of searchEntries) {
          const attrs = extractAttrs(entry as unknown as Record<string, unknown>);
          const upn = attrs['userprincipalname'] || '';
          const sam = attrs['samaccountname'] || '';
          const username = sam || upn.split('@')[0] || '';

          if (username) {
            adUsernames.add(username.toLowerCase());

            const dn = attrs['distinguishedname'] || (entry.dn as string) || '';
            const { department } = parseDN(dn);

            adUserMap.set(username.toLowerCase(), {
              cn: attrs['cn'] || username,
              mail: attrs['mail'] || '',
              department,
            });
          }
        }

        console.log(`[AD Sync] Chunk ${Math.floor(i / chunkSize) + 1}: ค้นหา ${chunk.length} คน, พบ ${searchEntries.length} คน`);
      } catch (searchErr) {
        console.error(`[AD Sync] Search error for chunk ${Math.floor(i / chunkSize) + 1}:`, searchErr);
        result.errors.push(`Search chunk error: ${searchErr}`);
      }
    }

    result.synced = adUsernames.size;

    // ★★★ SAFEGUARD: ถ้าค้นหาแล้วได้ 0 users = LDAP search ล้มเหลว → ห้าม disable ใครเลย
    if (adUsernames.size === 0) {
      result.message = `AD search ส่ง 0 users (ค้นหา ${usernamesToSearch.length} คน) — ข้ามการ disable เพื่อป้องกัน false positive`;
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
    try { await client.unbind(); } catch { /* ignore */ }
  }
}
