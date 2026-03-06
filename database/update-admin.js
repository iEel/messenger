const sql = require('mssql');
const bcrypt = require('bcryptjs');

(async () => {
  const pool = await sql.connect({
    user: 'sa',
    password: 'Sonic@rama3',
    server: '192.168.110.106',
    database: 'MessengerDB',
    options: { encrypt: false, trustServerCertificate: true, instanceName: 'alpha' },
  });
  const hash = await bcrypt.hash('admin1234', 12);
  await pool.request().query(
    `UPDATE Users SET EmployeeId='admin', PasswordHash='${hash}', UpdatedAt=GETDATE() WHERE EmployeeId='ADMIN001'`
  );
  console.log('✅ เปลี่ยนแล้ว: admin / admin1234');
  await pool.close();
  process.exit(0);
})();
