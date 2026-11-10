-- hea_uat : ให้ dashboard อ่านชื่อพื้นที่การอ่านมาตร (ตารางไม่มีข้อมูลส่วนบุคคล: id, title, description, status)
-- รันด้วย: sudo -u postgres psql -d hea_uat -c "GRANT SELECT ON public.meter_reading_areas TO mcp_reader;"
-- ต้องรันซ้ำทุกครั้งหลัง restore dump ใหม่ (ต่อจาก 001_dash_views_pdpa.sql)
GRANT SELECT ON public.meter_reading_areas TO mcp_reader;
