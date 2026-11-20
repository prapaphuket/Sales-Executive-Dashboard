-- hea_uat : ให้ mcp_reader อ่านตารางนำเข้าข้อมูล (import_batches, import_batch_rows)
-- ใช้ตรวจใบค่าน้ำที่นำเข้าจาก Pay2Head (กปภ. / ทอท. / หอถัง อบต.ไม้ขาว) ซึ่ง WMS ใช้ map แสดงผลบนหน้าจอ
-- รันด้วย: sudo -u postgres psql -d hea_uat -f 004_grant_import_batches.sql
-- ต้องรันซ้ำทุกครั้งหลัง restore dump ใหม่ (ต่อจาก 001-003)
GRANT SELECT ON public.import_batches, public.import_batch_rows TO mcp_reader;
