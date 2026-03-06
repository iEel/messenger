// Script สร้าง Database MessengerDB และรัน Schema
const sql = require('mssql');

const config = {
  user: 'sa',
  password: 'Sonic@rama3',
  server: '192.168.110.106',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    instanceName: 'alpha',
  },
};

async function run() {
  let pool;
  try {
    // 1. เชื่อมต่อ master เพื่อสร้าง Database
    console.log('🔌 กำลังเชื่อมต่อ SQL Server (192.168.110.106\\alpha)...');
    pool = await sql.connect({ ...config, database: 'master' });
    console.log('✅ เชื่อมต่อสำเร็จ!');

    // 2. สร้าง Database ถ้ายังไม่มี
    console.log('📦 กำลังสร้าง Database MessengerDB...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'MessengerDB')
      BEGIN
        CREATE DATABASE MessengerDB
      END
    `);
    console.log('✅ Database MessengerDB พร้อมใช้งาน!');
    await pool.close();

    // 3. เชื่อมต่อ MessengerDB แล้วสร้างตาราง
    console.log('🗄️ กำลังสร้างตาราง...');
    pool = await sql.connect({ ...config, database: 'MessengerDB' });

    // สร้างตาราง Users
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
      CREATE TABLE Users (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        EmployeeId      NVARCHAR(20) NOT NULL UNIQUE,
        FullName        NVARCHAR(100) NOT NULL,
        Email           NVARCHAR(100) NULL,
        Phone           NVARCHAR(20) NULL,
        PasswordHash    NVARCHAR(255) NOT NULL,
        Role            NVARCHAR(20) NOT NULL DEFAULT 'requester',
        Department      NVARCHAR(100) NULL,
        IsActive        BIT NOT NULL DEFAULT 1,
        AvatarUrl       NVARCHAR(255) NULL,
        CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
        LastLoginAt     DATETIME2 NULL
      )
    `);
    console.log('  ✅ ตาราง Users');

    // สร้างตาราง Tasks
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Tasks')
      CREATE TABLE Tasks (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        TaskNumber      NVARCHAR(20) NOT NULL UNIQUE,
        RequesterId     INT NOT NULL,
        AssignedTo      INT NULL,
        RecipientName   NVARCHAR(100) NOT NULL,
        RecipientPhone  NVARCHAR(20) NULL,
        RecipientCompany NVARCHAR(200) NULL,
        TaskType        NVARCHAR(20) NOT NULL DEFAULT 'oneway',
        DocumentDesc    NVARCHAR(500) NOT NULL,
        Notes           NVARCHAR(500) NULL,
        Address         NVARCHAR(500) NOT NULL,
        District        NVARCHAR(100) NULL,
        SubDistrict     NVARCHAR(100) NULL,
        Province        NVARCHAR(100) NULL,
        PostalCode      NVARCHAR(10) NULL,
        Latitude        DECIMAL(10, 7) NULL,
        Longitude       DECIMAL(10, 7) NULL,
        GoogleMapsUrl   NVARCHAR(500) NULL,
        Status          NVARCHAR(30) NOT NULL DEFAULT 'new',
        Priority        NVARCHAR(10) NOT NULL DEFAULT 'normal',
        ScheduledDate   DATE NULL,
        CompletedAt     DATETIME2 NULL,
        CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
        UpdatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Tasks_Requester FOREIGN KEY (RequesterId) REFERENCES Users(Id),
        CONSTRAINT FK_Tasks_Messenger FOREIGN KEY (AssignedTo) REFERENCES Users(Id)
      )
    `);
    console.log('  ✅ ตาราง Tasks');

    // สร้างตาราง TaskStatusHistory
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TaskStatusHistory')
      CREATE TABLE TaskStatusHistory (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        TaskId          INT NOT NULL,
        Status          NVARCHAR(30) NOT NULL,
        ChangedBy       INT NOT NULL,
        Notes           NVARCHAR(500) NULL,
        Latitude        DECIMAL(10, 7) NULL,
        Longitude       DECIMAL(10, 7) NULL,
        CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_TaskStatusHistory_Task FOREIGN KEY (TaskId) REFERENCES Tasks(Id),
        CONSTRAINT FK_TaskStatusHistory_User FOREIGN KEY (ChangedBy) REFERENCES Users(Id)
      )
    `);
    console.log('  ✅ ตาราง TaskStatusHistory');

    // สร้างตาราง ProofOfDelivery
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ProofOfDelivery')
      CREATE TABLE ProofOfDelivery (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        TaskId          INT NOT NULL,
        Type            NVARCHAR(20) NOT NULL,
        FilePath        NVARCHAR(500) NOT NULL,
        FileName        NVARCHAR(200) NOT NULL,
        Notes           NVARCHAR(500) NULL,
        UploadedBy      INT NOT NULL,
        CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_POD_Task FOREIGN KEY (TaskId) REFERENCES Tasks(Id),
        CONSTRAINT FK_POD_User FOREIGN KEY (UploadedBy) REFERENCES Users(Id)
      )
    `);
    console.log('  ✅ ตาราง ProofOfDelivery');

    // สร้างตาราง Trips
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Trips')
      CREATE TABLE Trips (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        MessengerId     INT NOT NULL,
        StartTime       DATETIME2 NOT NULL,
        EndTime         DATETIME2 NULL,
        TotalDistanceKm DECIMAL(10, 2) NULL,
        Status          NVARCHAR(20) NOT NULL DEFAULT 'active',
        Notes           NVARCHAR(500) NULL,
        CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Trips_Messenger FOREIGN KEY (MessengerId) REFERENCES Users(Id)
      )
    `);
    console.log('  ✅ ตาราง Trips');

    // สร้างตาราง TripWaypoints
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TripWaypoints')
      CREATE TABLE TripWaypoints (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        TripId          INT NOT NULL,
        TaskId          INT NULL,
        Latitude        DECIMAL(10, 7) NOT NULL,
        Longitude       DECIMAL(10, 7) NOT NULL,
        WaypointType    NVARCHAR(20) NOT NULL,
        DistanceFromPrev DECIMAL(10, 2) NULL,
        CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Waypoints_Trip FOREIGN KEY (TripId) REFERENCES Trips(Id),
        CONSTRAINT FK_Waypoints_Task FOREIGN KEY (TaskId) REFERENCES Tasks(Id)
      )
    `);
    console.log('  ✅ ตาราง TripWaypoints');

    // สร้างตาราง Issues
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Issues')
      CREATE TABLE Issues (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        TaskId          INT NOT NULL,
        ReportedBy      INT NOT NULL,
        IssueType       NVARCHAR(50) NOT NULL,
        Description     NVARCHAR(500) NULL,
        Resolution      NVARCHAR(20) NULL,
        ResolvedBy      INT NULL,
        ResolvedAt      DATETIME2 NULL,
        CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Issues_Task FOREIGN KEY (TaskId) REFERENCES Tasks(Id),
        CONSTRAINT FK_Issues_Reporter FOREIGN KEY (ReportedBy) REFERENCES Users(Id),
        CONSTRAINT FK_Issues_Resolver FOREIGN KEY (ResolvedBy) REFERENCES Users(Id)
      )
    `);
    console.log('  ✅ ตาราง Issues');

    // สร้างตาราง Notifications
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Notifications')
      CREATE TABLE Notifications (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        UserId          INT NOT NULL,
        TaskId          INT NULL,
        Type            NVARCHAR(30) NOT NULL,
        Channel         NVARCHAR(20) NOT NULL DEFAULT 'email',
        Subject         NVARCHAR(200) NULL,
        SentAt          DATETIME2 NULL,
        Status          NVARCHAR(20) NOT NULL DEFAULT 'pending',
        CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Notifications_User FOREIGN KEY (UserId) REFERENCES Users(Id),
        CONSTRAINT FK_Notifications_Task FOREIGN KEY (TaskId) REFERENCES Tasks(Id)
      )
    `);
    console.log('  ✅ ตาราง Notifications');

    // สร้างตาราง SystemSettings
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SystemSettings')
      CREATE TABLE SystemSettings (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        SettingKey      NVARCHAR(100) NOT NULL UNIQUE,
        SettingValue    NVARCHAR(500) NOT NULL,
        Description     NVARCHAR(200) NULL,
        UpdatedAt       DATETIME2 NOT NULL DEFAULT GETDATE()
      )
    `);
    console.log('  ✅ ตาราง SystemSettings');

    // 4. สร้าง Indexes
    console.log('📇 กำลังสร้าง Indexes...');
    const indexes = [
      "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Users_Role') CREATE INDEX IX_Users_Role ON Users(Role)",
      "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Users_IsActive') CREATE INDEX IX_Users_IsActive ON Users(IsActive)",
      "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Tasks_Status') CREATE INDEX IX_Tasks_Status ON Tasks(Status)",
      "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Tasks_RequesterId') CREATE INDEX IX_Tasks_RequesterId ON Tasks(RequesterId)",
      "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Tasks_AssignedTo') CREATE INDEX IX_Tasks_AssignedTo ON Tasks(AssignedTo)",
      "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Tasks_District') CREATE INDEX IX_Tasks_District ON Tasks(District)",
      "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_TaskStatusHistory_TaskId') CREATE INDEX IX_TaskStatusHistory_TaskId ON TaskStatusHistory(TaskId)",
      "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_POD_TaskId') CREATE INDEX IX_POD_TaskId ON ProofOfDelivery(TaskId)",
      "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Trips_MessengerId') CREATE INDEX IX_Trips_MessengerId ON Trips(MessengerId)",
      "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Trips_StartTime') CREATE INDEX IX_Trips_StartTime ON Trips(StartTime)",
      "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_TripWaypoints_TripId') CREATE INDEX IX_TripWaypoints_TripId ON TripWaypoints(TripId)",
      "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name='IX_Issues_TaskId') CREATE INDEX IX_Issues_TaskId ON Issues(TaskId)",
    ];
    for (const idx of indexes) {
      await pool.request().query(idx);
    }
    console.log('  ✅ Indexes สร้างเสร็จ');

    // 5. Seed data - SystemSettings
    console.log('🌱 กำลังใส่ข้อมูลตั้งต้น...');
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM SystemSettings WHERE SettingKey = 'task_number_prefix')
      BEGIN
        INSERT INTO SystemSettings (SettingKey, SettingValue, Description) VALUES
        ('task_number_prefix', 'MSG', N'คำนำหน้าเลขที่ใบงาน'),
        ('task_number_sequence', '0', N'ลำดับเลขที่ใบงานปัจจุบัน'),
        ('office_name', N'จุดรับเอกสารส่วนกลาง (ตะกร้า)', N'ชื่อจุดรับเอกสาร'),
        ('office_lat', '13.7563', N'พิกัด Lat ของออฟฟิศ'),
        ('office_lng', '100.5018', N'พิกัด Long ของออฟฟิศ')
      END
    `);
    console.log('  ✅ SystemSettings');

    // 6. สร้าง Admin User ตัวแรก (password: admin123)
    const bcrypt = require('bcryptjs');
    const adminHash = await bcrypt.hash('admin123', 12);
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM Users WHERE EmployeeId = 'ADMIN001')
      INSERT INTO Users (EmployeeId, FullName, Email, PasswordHash, Role, Department)
      VALUES ('ADMIN001', N'ผู้ดูแลระบบ', 'admin@company.com', '${adminHash}', 'admin', N'IT')
    `);
    console.log('  ✅ Admin User (ADMIN001 / admin123)');

    console.log('\n🎉 สร้าง Database เสร็จสมบูรณ์!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  🔑 Admin Login:');
    console.log('     รหัสพนักงาน: ADMIN001');
    console.log('     รหัสผ่าน:   admin123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    if (pool) await pool.close();
    process.exit(0);
  }
}

run();
