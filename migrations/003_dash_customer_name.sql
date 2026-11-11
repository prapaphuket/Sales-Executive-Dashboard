-- hea_uat : สิทธิ์อ่านสำหรับชื่อลูกค้าและหมู่ (ลูกค้ายินยอมเปิดเผยชื่อตอนสมัครใช้น้ำ) — รันแล้ว 11/11/69
-- dashboard อ่านจาก customer_waters เฉพาะ id, name, moo, sub_district (ยังไม่ดึงเลขบัตร โทร ที่อยู่ บัญชีธนาคาร)
-- รันซ้ำหลัง restore ทุกครั้ง (ต่อจาก 001, 002):
--   sudo -u postgres psql -d hea_uat -c "GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_reader;"
GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_reader;
