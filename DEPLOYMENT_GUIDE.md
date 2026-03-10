# 🚀 Deployment Guide — Messenger Tracking System

> **Target:** Ubuntu Server 22.04/24.04 LTS + Cloudflare Zero Trust Tunnel
> **Stack:** Next.js 16 + MS SQL Server + Node.js 24+

---

## สารบัญ

1. [ข้อกำหนดเบื้องต้น](#1-ข้อกำหนดเบื้องต้น)
2. [เตรียม Ubuntu Server](#2-เตรียม-ubuntu-server)
3. [ติดตั้ง Node.js](#3-ติดตั้ง-nodejs)
4. [Clone และ Build โปรเจค](#4-clone-และ-build-โปรเจค)
5. [ตั้งค่า Environment Variables](#5-ตั้งค่า-environment-variables)
6. [ตั้งค่า PM2 (Process Manager)](#6-ตั้งค่า-pm2)
7. [ตั้งค่า Nginx (Reverse Proxy)](#7-ตั้งค่า-nginx)
8. [ตั้งค่า Cloudflare Zero Trust Tunnel](#8-ตั้งค่า-cloudflare-zero-trust-tunnel)
9. [ตั้งค่า Firewall](#9-ตั้งค่า-firewall)
10. [ทดสอบและตรวจสอบ](#10-ทดสอบและตรวจสอบ)
11. [การอัปเดตระบบ](#11-การอัปเดตระบบ)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. ข้อกำหนดเบื้องต้น

### Server

| รายการ | ขั้นต่ำ | แนะนำ |
|--------|---------|-------|
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| CPU | 2 Core | 4 Core |
| RAM | 2 GB | 4 GB |
| Disk | 20 GB | 50 GB |
| Node.js | v20+ | v24 LTS |

### บริการภายนอก

- **MS SQL Server** — ใช้ตัวเดิมที่ `192.168.110.106` (ต้อง network ถึง)
- **LDAP/AD Server** — `10.10.100.2:389` (ต้อง network ถึง)
- **Cloudflare Account** — พร้อม domain ที่托管อยู่ใน Cloudflare
- **GitHub** — เข้าถึง repository `iEel/messenger`

---

## 2. เตรียม Ubuntu Server

```bash
# อัปเดต OS
sudo apt update && sudo apt upgrade -y

# ติดตั้ง dependencies พื้นฐาน
sudo apt install -y curl wget git build-essential nginx

# ตั้งค่า timezone (กรุงเทพ)
sudo timedatectl set-timezone Asia/Bangkok

# ตรวจสอบ
timedatectl
# → Time zone: Asia/Bangkok (ICT, +0700)
```

### สร้าง user สำหรับ deploy (optional แต่แนะนำ)

```bash
sudo adduser messenger --disabled-password
sudo usermod -aG sudo messenger
sudo su - messenger
```

---

## 3. ติดตั้ง Node.js

```bash
# ใช้ NodeSource official repository
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

# ตรวจสอบ version
node -v    # → v24.x.x
npm -v     # → 10.x.x

# ติดตั้ง PM2 (Process Manager)
sudo npm install -g pm2
```

---

## 4. Clone และ Build โปรเจค

```bash
# สร้าง directory
sudo mkdir -p /var/www/messenger
sudo chown $USER:$USER /var/www/messenger

# Clone repository
cd /var/www/messenger
git clone https://github.com/iEel/messenger.git .

# ติดตั้ง dependencies
npm install --legacy-peer-deps

# สร้าง uploads directory
mkdir -p uploads

# Build production
npm run build
```

> ⚠️ **หมายเหตุ:** ต้องสร้างไฟล์ `.env.local` ก่อน build (ดูขั้นตอนถัดไป) แล้ว build อีกครั้ง

---

## 5. ตั้งค่า Environment Variables

สร้างไฟล์ `.env.local`:

```bash
nano /var/www/messenger/.env.local
```

```env
# ===================================
# Database (MS SQL Server)
# ===================================
DB_SERVER=<DB_SERVER_IP>
DB_INSTANCE=<INSTANCE_NAME>
DB_NAME=MessengerDB
DB_USER=<DB_USERNAME>
DB_PASSWORD=<DB_PASSWORD>
DB_PORT=1433

# ===================================
# App Server
# ===================================
PORT=3000

# ===================================
# NextAuth.js
# ===================================
NEXTAUTH_URL=https://messenger.yourdomain.com
NEXTAUTH_SECRET=<ใช้คำสั่ง: openssl rand -base64 32>

# ===================================
# Google Maps API
# ===================================
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<YOUR_GOOGLE_MAPS_API_KEY>

# ===================================
# SMTP (Outlook 365)
# ===================================
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=<YOUR_EMAIL>
SMTP_PASS=<YOUR_APP_PASSWORD>
SMTP_FROM=Messenger <your-email@company.com>

# ===================================
# Azure AD OAuth2 (for SMTP)
# ===================================
AZURE_TENANT_ID=<YOUR_AZURE_TENANT_ID>
AZURE_CLIENT_ID=<YOUR_AZURE_CLIENT_ID>
AZURE_CLIENT_SECRET=<YOUR_AZURE_CLIENT_SECRET>

# ===================================
# Upload Path
# ===================================
UPLOAD_DIR=./uploads

# ===================================
# Web Push (VAPID)
# ===================================
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<YOUR_VAPID_PUBLIC_KEY>
VAPID_PRIVATE_KEY=<YOUR_VAPID_PRIVATE_KEY>

# ===================================
# LDAP (Active Directory)
# ===================================
LDAP_BIND_DN=<SERVICE_ACCOUNT>@yourdomain.com
LDAP_BIND_PASSWORD=<SERVICE_ACCOUNT_PASSWORD>
```

### สร้าง NEXTAUTH_SECRET

```bash
openssl rand -base64 32
# คัดลอกผลลัพธ์ไปใส่ใน NEXTAUTH_SECRET
```

### Build อีกครั้ง (หลังสร้าง .env.local)

```bash
cd /var/www/messenger
npm run build
```

---

## 6. ตั้งค่า PM2

### สร้าง ecosystem config

```bash
nano /var/www/messenger/ecosystem.config.js
```

```javascript
module.exports = {
  apps: [{
    name: 'messenger',
    cwd: '/var/www/messenger',
    script: 'node_modules/.bin/next',
    args: 'start',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    error_file: '/var/www/messenger/logs/error.log',
    out_file: '/var/www/messenger/logs/access.log',
    time: true,
  }]
};
```

### เริ่มต้น app

```bash
# สร้าง log directory
mkdir -p /var/www/messenger/logs

# เริ่ม app ด้วย PM2
cd /var/www/messenger
pm2 start ecosystem.config.js

# ตรวจสอบสถานะ
pm2 status
pm2 logs messenger

# ตั้งค่าให้ PM2 เริ่มอัตโนมัติตอน boot
pm2 startup
pm2 save
```

### คำสั่ง PM2 ที่ใช้บ่อย

```bash
pm2 status                  # ดูสถานะ
pm2 logs messenger          # ดู log แบบ realtime
pm2 restart messenger       # restart app
pm2 stop messenger          # หยุด app
pm2 reload messenger        # reload แบบ zero-downtime
pm2 monit                   # monitoring dashboard
```

---

## 7. ตั้งค่า Nginx

### สร้าง config file

```bash
sudo nano /etc/nginx/sites-available/messenger
```

```nginx
server {
    listen 80;
    server_name localhost;

    # Proxy ไปยัง Next.js app
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeout สำหรับ long-running requests
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Upload file size limit (สำหรับ POD uploads)
    client_max_body_size 10M;

    # Static files cache
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Favicon & icons
    location /favicon.png {
        proxy_pass http://127.0.0.1:3000;
        add_header Cache-Control "public, max-age=86400";
    }
}
```

### เปิดใช้งาน

```bash
# เปิดใช้งาน site
sudo ln -s /etc/nginx/sites-available/messenger /etc/nginx/sites-enabled/

# ลบ default site
sudo rm /etc/nginx/sites-enabled/default

# ตรวจสอบ config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx

# ตรวจสอบ
curl http://localhost
```

---

## 8. ตั้งค่า Cloudflare Zero Trust Tunnel

### 8.1 ติดตั้ง cloudflared

```bash
# ดาวน์โหลดและติดตั้ง cloudflared
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
rm cloudflared.deb

# ตรวจสอบ
cloudflared version
```

### 8.2 สร้าง Tunnel ผ่าน Cloudflare Dashboard

1. **เข้า Cloudflare Dashboard** → https://one.dash.cloudflare.com
2. ไปที่ **Networks** → **Tunnels**
3. กด **Create a tunnel**
4. เลือก **Cloudflared** → กด **Next**
5. ตั้งชื่อ tunnel: `messenger-production`
6. กด **Save tunnel**

### 8.3 ติดตั้ง Connector บน Server

Cloudflare จะให้คำสั่งในรูปแบบ:

```bash
sudo cloudflared service install <YOUR_TUNNEL_TOKEN>
```

**คัดลอกคำสั่งจาก Dashboard แล้วรันบน Server:**

```bash
# รันคำสั่งจาก Cloudflare Dashboard
sudo cloudflared service install eyJhIjoixxxxxxxxx...

# ตรวจสอบ service
sudo systemctl status cloudflared
```

### 8.4 ตั้งค่า Public Hostname

กลับไปที่ Cloudflare Dashboard → Tunnel ที่สร้าง → Tab **Public Hostname**:

| ฟิลด์ | ค่า |
|-------|-----|
| **Subdomain** | `messenger` (หรือชื่อที่ต้องการ) |
| **Domain** | `yourdomain.com` (domain ที่อยู่ใน Cloudflare) |
| **Type** | `HTTP` |
| **URL** | `localhost:80` |

กด **Save hostname**

### 8.5 ตั้งค่า Access Policy (Zero Trust)

ถ้าต้องการจำกัดการเข้าถึง:

1. ไปที่ **Access** → **Applications** → **Add an Application**
2. เลือก **Self-hosted**
3. ตั้งค่า:
   - **Application name:** Messenger Tracking
   - **Session duration:** 24 hours
   - **Application domain:** `messenger.yourdomain.com`
4. สร้าง **Policy:**
   - **Policy name:** Allow Company
   - **Action:** Allow
   - **Selector:** Emails ending in → `@sonic.co.th`
   - หรือ **IP Ranges** → กำหนด IP ภายในองค์กร

### 8.6 อัปเดต NEXTAUTH_URL

```bash
# แก้ไข .env.local
nano /var/www/messenger/.env.local

# เปลี่ยน NEXTAUTH_URL เป็น domain จริง
NEXTAUTH_URL=https://messenger.yourdomain.com
```

```bash
# Build ใหม่ แล้ว restart
cd /var/www/messenger
npm run build
pm2 restart messenger
```

### 8.7 ตรวจสอบ Tunnel

```bash
# ดูสถานะ tunnel
sudo systemctl status cloudflared

# ดู log
sudo journalctl -u cloudflared -f

# ตรวจสอบจากเบราว์เซอร์
# เปิด https://messenger.yourdomain.com
```

---

## 9. ตั้งค่า Firewall

```bash
# เปิด UFW
sudo ufw enable

# อนุญาต SSH
sudo ufw allow ssh

# ไม่ต้องเปิด port 80/443 เพราะ Cloudflare Tunnel ใช้ outbound connection
# (ไม่ต้องเปิด port ขาเข้าเลย!)

# ตรวจสอบ
sudo ufw status verbose
```

> 💡 **ข้อดีของ Cloudflare Tunnel:** ไม่ต้องเปิด port ขาเข้า (80/443) เลย!
> Tunnel สร้าง outbound connection ไป Cloudflare edge → ปลอดภัยกว่ามาก

---

## 10. ทดสอบและตรวจสอบ

### Checklist

```bash
# ✅ 1. PM2 ทำงาน
pm2 status
# → messenger | online

# ✅ 2. App ตอบสนอง
curl -s http://localhost:3000 | head -c 200

# ✅ 3. Nginx proxy ทำงาน
curl -s http://localhost | head -c 200

# ✅ 4. Cloudflare Tunnel เชื่อมต่อ
sudo systemctl status cloudflared
# → active (running)

# ✅ 5. เข้าจากภายนอก
# เปิด https://messenger.yourdomain.com ในเบราว์เซอร์

# ✅ 6. DB เชื่อมต่อได้
# login จะสำเร็จถ้า DB ทำงาน

# ✅ 7. LDAP/AD เชื่อมต่อได้ (ถ้า network ถึง)
# ตั้งค่าระบบ → ทดสอบ LDAP
```

### ตรวจสอบ Network ไปยัง DB & LDAP

```bash
# ทดสอบเชื่อมต่อ DB (MS SQL)
nc -zv <DB_SERVER_IP> 1433

# ทดสอบเชื่อมต่อ LDAP
nc -zv <LDAP_SERVER_IP> 389
```

### ตรวจสอบ AD Sync

```bash
# ดู AD Sync log
pm2 logs messenger | grep "AD Sync"
# → [AD Sync] Auto-sync starting...
# → [AD Sync] Sync สำเร็จ: ตรวจ 150 AD users, disabled 2, updated 3

# Trigger sync manual (admin only)
curl -X POST https://messenger.yourdomain.com/api/ad-sync \
  -H "Cookie: authjs.session-token=<admin-token>"

# ดูสถานะ sync ล่าสุด
curl https://messenger.yourdomain.com/api/ad-sync \
  -H "Cookie: authjs.session-token=<admin-token>"
```

> 💡 **AD Sync ทำงานอัตโนมัติ:**
> - ครั้งแรก 30 วินาทีหลัง server start
> - หลังจากนั้นทุก 6 ชั่วโมง
> - User ที่ถูกลบ/disable ใน AD → ถูก disable ใน app อัตโนมัติ
> - Session ของ user ที่ถูก disable → หมดอายุภายใน 5 นาที (IsActive check)

---

## 11. การอัปเดตระบบ

### Script อัปเดตอัตโนมัติ

สร้างไฟล์ script:

```bash
nano /var/www/messenger/deploy.sh
```

```bash
#!/bin/bash
set -e

echo "🔄 เริ่มการอัปเดต Messenger Tracking System..."
cd /var/www/messenger

# ดึง code ล่าสุด
echo "📥 ดึง code จาก GitHub..."
git pull origin master

# ติดตั้ง dependencies (ถ้ามีเปลี่ยน)
echo "📦 ติดตั้ง dependencies..."
npm install --legacy-peer-deps

# Build production
echo "🔨 Build production..."
npm run build

# Restart app
echo "🔄 Restart app..."
pm2 reload messenger

echo "✅ อัปเดตเรียบร้อย!"
pm2 status
```

```bash
# ให้สิทธิ์ execute
chmod +x /var/www/messenger/deploy.sh

# รันอัปเดต
/var/www/messenger/deploy.sh
```

---

## 12. Troubleshooting

### ปัญหาที่พบบ่อย

| ปัญหา | สาเหตุ | วิธีแก้ |
|-------|--------|---------|
| `npm install` ล้มเหลว | peer dependency conflict | ใช้ `--legacy-peer-deps` |
| เชื่อมต่อ DB ไม่ได้ | network/firewall | `nc -zv <DB_SERVER_IP> 1433` |
| LDAP ไม่ทำงาน | network ไม่ถึง AD server | ตรวจสอบ routing ระหว่าง subnet |
| Login ไม่ได้ | `NEXTAUTH_URL` ไม่ตรง | ต้องตรงกับ domain จริง |
| Upload ไม่ได้ | permission | `chown -R $USER:$USER uploads/` |
| Tunnel offline | cloudflared ไม่ทำงาน | `sudo systemctl restart cloudflared` |
| Build ล้มเหลว | memory ไม่พอ | เพิ่ม swap: `sudo fallocate -l 2G /swapfile` |
| User ยัง login ได้หลัง disable | IsActive cache 5 นาที | รอ 5 นาที หรือ restart app: `pm2 restart messenger` |
| AD Sync ไม่ทำงาน | LDAP ไม่ได้เปิดใน Settings | เปิด LDAP ในหน้าตั้งค่า + ตรวจสอบ `LDAP_BIND_DN` |
| AD Sync ไม่พบ user | Base DN ไม่ถูกต้อง | ตรวจสอบ Base DN ในหน้าตั้งค่า LDAP |

### ดู Logs

```bash
# App logs
pm2 logs messenger --lines 100

# Nginx logs
sudo tail -f /var/log/nginx/error.log

# Cloudflare Tunnel logs
sudo journalctl -u cloudflared -f --lines 50

# System logs
sudo journalctl -f
```

### เพิ่ม Swap (ถ้า RAM น้อย)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## สถาปัตยกรรมการ Deploy

```
┌──────────────────────────────────────────────────────┐
│                   Cloudflare Edge                     │
│           messenger.yourdomain.com (HTTPS)            │
│              + Zero Trust Access Policy               │
└──────────────────────┬───────────────────────────────┘
                       │ Tunnel (outbound)
                       ▼
┌──────────────────────────────────────────────────────┐
│              Ubuntu Server                            │
│                                                       │
│   cloudflared ──→ Nginx (:80) ──→ Next.js (:3000)    │
│                                     │                 │
│                   ┌─────────────────┤                 │
│                   ▼                 ▼                 │
│         MS SQL Server         LDAP/AD Server          │
│       <DB_SERVER_IP>:1433    <LDAP_SERVER_IP>:389      │
└──────────────────────────────────────────────────────┘
```

---

> 📅 สร้างเมื่อ: 8 มีนาคม 2569
> 📝 เวอร์ชัน: 1.1 (อัปเดต: 10 มีนาคม 2569 — เพิ่ม AD Sync + IsActive check)
