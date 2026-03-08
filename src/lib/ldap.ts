import ldap from 'ldapjs';
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
 * สร้าง LDAP client
 */
function createClient(url: string): ldap.Client {
  return ldap.createClient({
    url: [url],
    tlsOptions: { rejectUnauthorized: false },
    connectTimeout: 10000,
    timeout: 10000,
  });
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
    client.search(baseDn, opts, (err, res) => {
      if (err) return reject(err);
      res.on('searchEntry', (entry) => entries.push(entry));
      res.on('error', (err) => reject(err));
      res.on('end', () => resolve(entries));
    });
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
