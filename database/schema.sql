-- =============================================
-- MessengerDB - Database Schema
-- ระบบบริหารจัดการแมสเซ็นเจอร์และติดตามเอกสาร
-- =============================================

-- สร้าง Database
-- CREATE DATABASE MessengerDB;
-- GO
-- USE MessengerDB;
-- GO

-- =============================================
-- ตาราง Users - ผู้ใช้งานทั้งหมด
-- =============================================
CREATE TABLE Users (
    Id              INT IDENTITY(1,1) PRIMARY KEY,
    EmployeeId      NVARCHAR(20) NOT NULL UNIQUE,       -- รหัสพนักงาน
    FullName        NVARCHAR(100) NOT NULL,              -- ชื่อ-สกุล
    Email           NVARCHAR(100) NULL,                  -- อีเมล (สำหรับแจ้งเตือน)
    Phone           NVARCHAR(20) NULL,                   -- เบอร์โทร
    PasswordHash    NVARCHAR(255) NOT NULL,              -- รหัสผ่านเข้ารหัส (bcrypt)
    Role            NVARCHAR(20) NOT NULL DEFAULT 'requester',  -- requester, dispatcher, messenger, admin
    Department      NVARCHAR(100) NULL,                  -- แผนก
    IsActive        BIT NOT NULL DEFAULT 1,              -- สถานะการใช้งาน
    AvatarUrl       NVARCHAR(255) NULL,                  -- รูปโปรไฟล์
    CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
    LastLoginAt     DATETIME2 NULL
);

-- Index สำหรับค้นหา
CREATE INDEX IX_Users_Role ON Users(Role);
CREATE INDEX IX_Users_IsActive ON Users(IsActive);
CREATE INDEX IX_Users_EmployeeId ON Users(EmployeeId);

-- =============================================
-- ตาราง Tasks - ใบงานส่งเอกสาร
-- =============================================
CREATE TABLE Tasks (
    Id              INT IDENTITY(1,1) PRIMARY KEY,
    TaskNumber      NVARCHAR(20) NOT NULL UNIQUE,        -- เลขที่ใบงาน (MSG-202603-0001)
    RequesterId     INT NOT NULL,                         -- ผู้สร้างใบงาน
    AssignedTo      INT NULL,                             -- แมสเซ็นเจอร์ที่รับงาน
    
    -- ข้อมูลผู้รับ
    RecipientName   NVARCHAR(100) NOT NULL,              -- ชื่อผู้รับ
    RecipientPhone  NVARCHAR(20) NULL,                   -- เบอร์ผู้รับ
    RecipientCompany NVARCHAR(200) NULL,                 -- ชื่อบริษัท/องค์กร
    
    -- ประเภทและรายละเอียด
    TaskType        NVARCHAR(20) NOT NULL DEFAULT 'oneway',  -- oneway, roundtrip
    DocumentDesc    NVARCHAR(500) NOT NULL,              -- รายละเอียดเอกสาร
    Notes           NVARCHAR(500) NULL,                  -- หมายเหตุเพิ่มเติม
    
    -- ที่อยู่ปลายทาง
    Address         NVARCHAR(500) NOT NULL,              -- ที่อยู่เต็ม
    District        NVARCHAR(100) NULL,                  -- เขต/อำเภอ
    SubDistrict     NVARCHAR(100) NULL,                  -- แขวง/ตำบล
    Province        NVARCHAR(100) NULL,                  -- จังหวัด
    PostalCode      NVARCHAR(10) NULL,                   -- รหัสไปรษณีย์
    Latitude        DECIMAL(10, 7) NULL,                 -- พิกัด Lat
    Longitude       DECIMAL(10, 7) NULL,                 -- พิกัด Long
    GoogleMapsUrl   NVARCHAR(500) NULL,                  -- ลิงก์ Google Maps
    
    -- สถานะ
    Status          NVARCHAR(30) NOT NULL DEFAULT 'new', -- new, assigned, picked_up, in_transit, completed, issue, return_picked_up, returning, returned, rescheduled
    Priority        NVARCHAR(10) NOT NULL DEFAULT 'normal', -- normal, urgent
    
    -- วันที่
    ScheduledDate   DATE NULL,                           -- วันนัดส่ง
    CompletedAt     DATETIME2 NULL,                      -- เวลาส่งสำเร็จ
    CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
    UpdatedAt       DATETIME2 NOT NULL DEFAULT GETDATE()
);

ALTER TABLE Tasks ADD CONSTRAINT FK_Tasks_Requester FOREIGN KEY (RequesterId) REFERENCES Users(Id);
ALTER TABLE Tasks ADD CONSTRAINT FK_Tasks_Messenger FOREIGN KEY (AssignedTo) REFERENCES Users(Id);

CREATE INDEX IX_Tasks_Status ON Tasks(Status);
CREATE INDEX IX_Tasks_RequesterId ON Tasks(RequesterId);
CREATE INDEX IX_Tasks_AssignedTo ON Tasks(AssignedTo);
CREATE INDEX IX_Tasks_District ON Tasks(District);
CREATE INDEX IX_Tasks_ScheduledDate ON Tasks(ScheduledDate);

-- =============================================
-- ตาราง TaskStatusHistory - ประวัติสถานะ
-- =============================================
CREATE TABLE TaskStatusHistory (
    Id              INT IDENTITY(1,1) PRIMARY KEY,
    TaskId          INT NOT NULL,
    Status          NVARCHAR(30) NOT NULL,
    ChangedBy       INT NOT NULL,                        -- ผู้เปลี่ยนสถานะ
    Notes           NVARCHAR(500) NULL,
    Latitude        DECIMAL(10, 7) NULL,                 -- พิกัด GPS ณ จุดนั้น
    Longitude       DECIMAL(10, 7) NULL,
    CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
    
    CONSTRAINT FK_TaskStatusHistory_Task FOREIGN KEY (TaskId) REFERENCES Tasks(Id),
    CONSTRAINT FK_TaskStatusHistory_User FOREIGN KEY (ChangedBy) REFERENCES Users(Id)
);

CREATE INDEX IX_TaskStatusHistory_TaskId ON TaskStatusHistory(TaskId);

-- =============================================
-- ตาราง ProofOfDelivery - หลักฐานการส่ง
-- =============================================
CREATE TABLE ProofOfDelivery (
    Id              INT IDENTITY(1,1) PRIMARY KEY,
    TaskId          INT NOT NULL,
    Type            NVARCHAR(20) NOT NULL,               -- photo, signature, check_photo
    FilePath        NVARCHAR(500) NOT NULL,              -- path ไฟล์ในเซิร์ฟเวอร์
    FileName        NVARCHAR(200) NOT NULL,
    Notes           NVARCHAR(500) NULL,
    UploadedBy      INT NOT NULL,
    CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
    
    CONSTRAINT FK_POD_Task FOREIGN KEY (TaskId) REFERENCES Tasks(Id),
    CONSTRAINT FK_POD_User FOREIGN KEY (UploadedBy) REFERENCES Users(Id)
);

CREATE INDEX IX_POD_TaskId ON ProofOfDelivery(TaskId);

-- =============================================
-- ตาราง Trips - รอบการวิ่งของแมสเซ็นเจอร์
-- =============================================
CREATE TABLE Trips (
    Id              INT IDENTITY(1,1) PRIMARY KEY,
    MessengerId     INT NOT NULL,
    StartTime       DATETIME2 NOT NULL,
    EndTime         DATETIME2 NULL,
    TotalDistanceKm DECIMAL(10, 2) NULL,                 -- ระยะทางรวม (กม.)
    Status          NVARCHAR(20) NOT NULL DEFAULT 'active', -- active, completed
    Notes           NVARCHAR(500) NULL,
    CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
    
    CONSTRAINT FK_Trips_Messenger FOREIGN KEY (MessengerId) REFERENCES Users(Id)
);

CREATE INDEX IX_Trips_MessengerId ON Trips(MessengerId);
CREATE INDEX IX_Trips_StartTime ON Trips(StartTime);

-- =============================================
-- ตาราง TripWaypoints - จุด GPS checkpoint
-- =============================================
CREATE TABLE TripWaypoints (
    Id              INT IDENTITY(1,1) PRIMARY KEY,
    TripId          INT NOT NULL,
    TaskId          INT NULL,                            -- ถ้าเป็น checkpoint ของงาน
    Latitude        DECIMAL(10, 7) NOT NULL,
    Longitude       DECIMAL(10, 7) NOT NULL,
    WaypointType    NVARCHAR(20) NOT NULL,               -- start, delivery, pickup, end
    DistanceFromPrev DECIMAL(10, 2) NULL,                -- ระยะจากจุดก่อนหน้า (กม.)
    CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
    
    CONSTRAINT FK_Waypoints_Trip FOREIGN KEY (TripId) REFERENCES Trips(Id),
    CONSTRAINT FK_Waypoints_Task FOREIGN KEY (TaskId) REFERENCES Tasks(Id)
);

CREATE INDEX IX_TripWaypoints_TripId ON TripWaypoints(TripId);

-- =============================================
-- ตาราง Issues - แจ้งปัญหา
-- =============================================
CREATE TABLE Issues (
    Id              INT IDENTITY(1,1) PRIMARY KEY,
    TaskId          INT NOT NULL,
    ReportedBy      INT NOT NULL,                        -- แมสเซ็นเจอร์ที่แจ้ง
    IssueType       NVARCHAR(50) NOT NULL,               -- contact_failed, office_closed, wrong_address, other
    Description     NVARCHAR(500) NULL,
    Resolution      NVARCHAR(20) NULL,                   -- return, reschedule
    ResolvedBy      INT NULL,                            -- พนักงานที่ตัดสินใจ
    ResolvedAt      DATETIME2 NULL,
    CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
    
    CONSTRAINT FK_Issues_Task FOREIGN KEY (TaskId) REFERENCES Tasks(Id),
    CONSTRAINT FK_Issues_Reporter FOREIGN KEY (ReportedBy) REFERENCES Users(Id),
    CONSTRAINT FK_Issues_Resolver FOREIGN KEY (ResolvedBy) REFERENCES Users(Id)
);

CREATE INDEX IX_Issues_TaskId ON Issues(TaskId);

-- =============================================
-- ตาราง Notifications - ประวัติแจ้งเตือน
-- =============================================
CREATE TABLE Notifications (
    Id              INT IDENTITY(1,1) PRIMARY KEY,
    UserId          INT NOT NULL,
    TaskId          INT NULL,
    Type            NVARCHAR(30) NOT NULL,               -- issue_alert, return_dropoff, delivery_summary
    Channel         NVARCHAR(20) NOT NULL DEFAULT 'email', -- email
    Subject         NVARCHAR(200) NULL,
    SentAt          DATETIME2 NULL,
    Status          NVARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, sent, failed
    CreatedAt       DATETIME2 NOT NULL DEFAULT GETDATE(),
    
    CONSTRAINT FK_Notifications_User FOREIGN KEY (UserId) REFERENCES Users(Id),
    CONSTRAINT FK_Notifications_Task FOREIGN KEY (TaskId) REFERENCES Tasks(Id)
);

-- =============================================
-- ตาราง SystemSettings - ค่าตั้งค่าระบบ
-- =============================================
CREATE TABLE SystemSettings (
    Id              INT IDENTITY(1,1) PRIMARY KEY,
    SettingKey      NVARCHAR(100) NOT NULL UNIQUE,
    SettingValue    NVARCHAR(500) NOT NULL,
    Description     NVARCHAR(200) NULL,
    UpdatedAt       DATETIME2 NOT NULL DEFAULT GETDATE()
);

-- ข้อมูลตั้งต้น
INSERT INTO SystemSettings (SettingKey, SettingValue, Description) VALUES
('task_number_prefix', 'MSG', 'คำนำหน้าเลขที่ใบงาน'),
('task_number_sequence', '0', 'ลำดับเลขที่ใบงานปัจจุบัน'),
('office_name', 'จุดรับเอกสารส่วนกลาง (ตะกร้า)', 'ชื่อจุดรับเอกสาร'),
('office_lat', '13.7563', 'พิกัด Lat ของออฟฟิศ'),
('office_lng', '100.5018', 'พิกัด Long ของออฟฟิศ');
GO
