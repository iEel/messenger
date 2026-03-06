import sql from 'mssql';

const sqlConfig: sql.config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'MessengerDB',
  server: process.env.DB_SERVER || 'localhost',
  port: process.env.DB_INSTANCE ? undefined : parseInt(process.env.DB_PORT || '1433'),
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: process.env.DB_INSTANCE || undefined,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool) {
    pool = await sql.connect(sqlConfig);
  }
  return pool;
}

export async function query<T = sql.IRecordSet<unknown>>(
  queryString: string,
  params?: Record<string, unknown>
): Promise<T> {
  const p = await getPool();
  const request = p.request();

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      request.input(key, value);
    });
  }

  const result = await request.query(queryString);
  return result.recordset as T;
}

export { sql };
