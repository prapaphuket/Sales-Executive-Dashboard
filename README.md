# HEA Sales Executive Dashboard

ภาพรวมยอดขายและการจัดเก็บธุรกิจน้ำประปา — บริษัท ไฮโดรเอ็นเตอร์ไพร์ส แอนด์ อะควอดีซายน์ จำกัด

Dashboard 4 หน้าหลัก + 1 หน้าคุณภาพข้อมูล อ่านจากฐานข้อมูล WMS (PostgreSQL) แบบ **อ่านอย่างเดียว**

| หน้า | เนื้อหา |
|---|---|
| ภาพรวมผู้บริหาร | ยอดขายสุทธิ ปริมาณน้ำ ยอดรับชำระ ลูกหนี้ อัตราเก็บเงิน YTD เป้า (ยังไม่กำหนด) แนวโน้ม 2 สาขา ประเด็นที่ควรติดตาม |
| ยอดขายและการใช้น้ำ | ก่อนส่วนลด/ส่วนลด/ใบลดหนี้/สุทธิ ประเภทรายได้ ปริมาณน้ำคิดเงิน/ฟรี ประเภทลูกค้า DMA ลูกค้า 15 รายแรก (drill-down) |
| ลูกค้าและการเติบโต | ลูกค้าที่ออกบิล ลูกค้าใหม่ สถานะทะเบียน การกระจุกตัว รายการเฝ้าระวังลูกค้ายอดลด |
| การจัดเก็บและลูกหนี้ | ยอดรับชำระตามประเภท สัดส่วนรับชำระต่อยอดแจ้งหนี้ อัตราเก็บเงินรายรุ่น ช่องทาง อายุหนี้ ลูกหนี้ 10 รายแรก (drill-down) |
| คุณภาพข้อมูลและนิยาม | ผลตรวจคุณภาพข้อมูล ข้อจำกัด นิยาม KPI |

## สถานะการเชื่อมต่อ (สำคัญ)

ชุดที่ส่งมอบนี้ **ยังไม่ได้เชื่อมต่อฐานข้อมูลสด** หน้าจอทำงานในโหมด `SNAPSHOT` (มีป้ายกำกับบนหัวหน้าจอ)
ข้อมูลใน `data/*.json` ดึงจากฐาน `hea_uat` (restore จาก prod 4 พ.ย. 2569 00:00) เมื่อ 9 พ.ย. 2569 ผ่าน role `mcp_reader`
ด้วย SQL ชุดเดียวกับใน `sql/` (พารามิเตอร์ `$1 = 2024-11-01`, `$2 = 2026-11-03`) — ไม่มีข้อมูลจำลอง

การเปิดโหมดสดต้องติดตั้ง backend บนเครื่องที่เข้าถึงฐานข้อมูลได้ (เช่น Server UAT) ตามขั้นตอนด้านล่าง

## ติดตั้ง

ต้องมี Node.js 18 ขึ้นไป (ทดสอบกับ Node 22)

```bash
npm install --omit=dev
```

### โหมด snapshot (ไม่ต่อฐานข้อมูล)

```bash
SNAPSHOT=1 PORT=8080 npm start
# เปิด http://localhost:8080
```

### โหมดสด (LIVE)

1. ใช้ role อ่านอย่างเดียว (`mcp_reader`) ที่มีสิทธิ์ SELECT บน `record_invoices`, `record_bills`, `bill_fees`, `branches`, `customer_water_types`, `dmas`
   และ views ใน `migrations/001_dash_views_pdpa.sql` (ตัดข้อมูลส่วนบุคคลตาม PDPA — ต้องรันซ้ำหลัง restore ทุกครั้ง)
2. ตั้งค่า environment variables ฝั่ง server (ดู `.env.example`) — **ห้ามใส่รหัสผ่านในไฟล์ที่ commit**
   ```bash
   export PGHOST=127.0.0.1 PGPORT=5432 PGDATABASE=hea_uat PGUSER=mcp_reader
   export PGPASSWORD='...'   # หรือใช้ ~/.pgpass / systemd EnvironmentFile ที่สิทธิ์ 600
   PORT=8080 npm start
   ```
3. ทุก connection ตั้ง `default_transaction_read_only=on` และ `statement_timeout` และทุก query ห่อด้วย `BEGIN READ ONLY`
4. ผลลัพธ์ cache 10 นาที (`CACHE_TTL_SECONDS`) · เพิ่ม `?refresh=1` ที่ `/api/ds/<ชื่อ>` เพื่อดึงใหม่
5. ในโหมดสด ช่อง “วันอ้างอิงลูกหนี้” เลือกได้ (ระบบจะดึงทุกชุดข้อมูลใหม่ด้วย `$2` = วันที่เลือก)

ตัวอย่าง systemd:
```ini
[Service]
WorkingDirectory=/opt/hea-dash
EnvironmentFile=/etc/hea-dash.env
ExecStart=/usr/bin/node server/server.js
User=hea-dash
Restart=on-failure
```
ควรวางหลัง reverse proxy ที่มี HTTPS และการยืนยันตัวตน (dashboard ไม่มีระบบ login ในตัว)

### สร้าง snapshot ใหม่จากฐานข้อมูล

```bash
node server/snapshot.js 2026-11-30    # เขียน data/*.json และ data/_snapshot.json
```

## โครงสร้าง

```
server/server.js      Express: /api/config, /api/ds/:name (live หรือ snapshot) + static
server/snapshot.js    ดึงทุกชุดข้อมูลเป็นไฟล์
sql/01..12_*.sql      SQL ของแต่ละชุดข้อมูล ($1 วันเริ่ม, $2 วันอ้างอิง) — อ่านอย่างเดียว
data/*.json           snapshot ที่ใช้ในชุดส่งมอบ
public/               index.html, app.js, styles.css, vendor (ECharts 5.5.1, ฟอนต์ Prompt), assets (โลโก้)
migrations/           SQL ที่เสนอให้ DBA รัน (views ตัดข้อมูลส่วนบุคคล) — dashboard ไม่สร้าง object ในฐานข้อมูลเอง
docs/                 นิยาม KPI + source mapping, ปัญหาข้อมูล, ผลตรวจ, design tokens
scripts/              validate.py (ตรวจตัวเลข), screens.js (ภาพหน้าจอ), inline.py/extract.py (เครื่องมือดึง snapshot ผ่าน MCP)
screenshots/          ภาพหน้าจอทุกหน้า
```

## ความปลอดภัยและข้อมูลส่วนบุคคล

- ไม่มีรหัสผ่านหรือ connection string ใน frontend หรือ source code
- ไม่มี INSERT/UPDATE/DELETE/DDL ใด ๆ ใน `sql/`
- ไม่เรียกบริการภายนอก: ฟอนต์ ไลบรารีกราฟ MSAL และโลโก้อยู่ในโฟลเดอร์ `public/` ทั้งหมด (เว็บ static ติดต่อเฉพาะ login.microsoftonline.com และ graph.microsoft.com เพื่อเข้าสู่ระบบ/ดึงกุญแจ)
- ชื่อบุคคลธรรมดาถูกแทนด้วย “บุคคลธรรมดา” ตั้งแต่ระดับ SQL · ไม่แสดงที่อยู่ เบอร์โทร เลขประจำตัว
- ตารางทะเบียนผู้ใช้น้ำอ่านผ่าน view `vw_dash_customer_waters` ที่ไม่มีข้อมูลส่วนบุคคล

## เอกสารเพิ่มเติม

- `docs/kpi_dictionary.md` — นิยาม KPI, สูตร, ฐานเวลา, ตาราง/คอลัมน์ต้นทาง, ตัวกรองที่มีผล
- `docs/data_issues.md` — ปัญหาข้อมูลที่ยังเปิดอยู่และผลต่อตัวเลข
- `docs/validation_results.md` — ผลตรวจความสอดคล้อง + contrast
- `docs/design_tokens.md`, `public/styles.css` (`:root`) — design tokens, ฟอนต์, asset

## เผยแพร่บน GitHub Pages (ล็อกอินด้วย Microsoft 365)

รูปแบบเดียวกับ WMS dashboard เดิม: หน้าเว็บเป็น static ข้อมูลเข้ารหัส AES-256-GCM อยู่ใน `site/data.enc.js`
ผู้ใช้ต้องเข้าสู่ระบบ Microsoft 365 → ระบบตรวจ tenant และกลุ่ม → ดึงไฟล์กุญแจจาก SharePoint ด้วยสิทธิ์ของผู้ใช้เอง → ถอดรหัสในเบราว์เซอร์
ไฟล์บน GitHub จึงมีแต่ข้อมูลที่เข้ารหัส ใครไม่มีสิทธิ์อ่านไฟล์กุญแจใน SharePoint ก็เปิดไม่ได้

ตั้งค่าครั้งแรก
1. อัปโหลดไฟล์กุญแจ (เช่น `hea-dash-key.txt`) ขึ้น SharePoint/OneDrive แล้วแชร์ให้ **เฉพาะกลุ่มที่ดูได้** คัดลอกลิงก์แชร์
2. แก้ `static/auth-config.js` (และ `site/auth-config.js`): ใส่ `keyShareUrl` และเปลี่ยน `groupId`/`groupName` ถ้าจะใช้กลุ่มอื่น
3. Entra ID → App registrations → `75b5084b-…` → Authentication → Single-page application → เพิ่ม Redirect URI `https://<owner>.github.io/<repo>/`
   (App เดิมให้สิทธิ์ `User.Read`, `Files.Read.All` และส่ง groups claim ใน ID token อยู่แล้ว)
4. GitHub → Settings → Pages → Source = **GitHub Actions** แล้ว push — workflow `.github/workflows/pages.yml` เผยแพร่โฟลเดอร์ `site/`

อัปเดตข้อมูล (บนเครื่องที่ต่อฐานข้อมูลได้ เช่น Server UAT)
```bash
node server/snapshot.js 2026-11-30                       # ดึงข้อมูลใหม่ลง data/ (ไม่ขึ้น Git)
node scripts/build-static.js --key /secure/hea-dash-key.txt   # สร้าง site/ ใหม่ด้วยกุญแจเดิม
git add site && git commit -m "ข้อมูล ณ 30 พ.ย. 69" && git push
```
ถ้าต้องการใช้กุญแจเดียวกับ WMS dashboard เดิม ให้ชี้ `--key` ไปที่ไฟล์ `wms-key.txt` และใส่ลิงก์แชร์เดิมใน `keyShareUrl`
**ห้าม commit ไฟล์กุญแจ** (กันไว้ใน `.gitignore` แล้ว) · หากกุญแจหลุด ให้สร้างกุญแจใหม่ (ระบุ path ที่ยังไม่มีไฟล์) build ใหม่ และเปลี่ยนไฟล์ใน SharePoint
