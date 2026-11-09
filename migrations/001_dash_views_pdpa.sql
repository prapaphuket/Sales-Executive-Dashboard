-- hea_uat : views สำหรับ Sales Executive Dashboard (ตัดข้อมูลส่วนบุคคลออกตาม PDPA)
-- รันด้วย: sudo -u postgres psql -d hea_uat -f dash_views_hea_uat.sql
-- ทุกคำสั่งอยู่บรรทัดเดียว คัดลอกทีละบรรทัดไปใส่ใน sudo -u postgres psql -d hea_uat -c "..." ได้
-- ต้องรันไฟล์นี้ซ้ำทุกครั้งหลัง restore dump ใหม่ (ต่อจาก grants.sql)

-- 1) ทะเบียนผู้ใช้น้ำ: ไม่มีชื่อ เลขบัตร โทร ที่อยู่ บัญชีธนาคาร พิกัด สัญญา
CREATE OR REPLACE VIEW public.vw_dash_customer_waters AS SELECT id, customer_id, registration_number, registration_number_old, type_id, branch_id, dma_id, meter_reading_area_id, water_meter_id, request_id, status, status_debtor, status_discount, installation_type, personal_type, type, payment_by, installation_date, last_ban_date, last_record_date, payment_bond, insuarance_amount, active_insuarance_date, cancel_insuarance_date, created_at, updated_at FROM public.customer_waters;

-- 2) ลูกค้า: เหลือแค่รหัสและประเภทบุคคล/นิติบุคคล
CREATE OR REPLACE VIEW public.vw_dash_customers AS SELECT id, type, created_at FROM public.customers;

-- 3) คำร้อง: ไม่มีชื่อ เลขบัตร โทร LINE ที่อยู่ พิกัด
CREATE OR REPLACE VIEW public.vw_dash_requests AS SELECT id, request_number, request_date, branch, request_type, request_type_id, status, customer_water_id, wmi_customer_type_key, wmi_installation_style, wmi_installation_format, wmi_estimated_price, wmi_water_deposit, completed_at, created_at FROM public.requests;

-- 4) เงินประกัน: ไม่มีชื่อ ที่อยู่ โทร เลขผู้เสียภาษี
CREATE OR REPLACE VIEW public.vw_dash_bill_payment_bonds AS SELECT id, customer_water_id, customer_registration_number, branch_id, bill_number, bill_date, payment_date, payment_type, subtotal, vat, total, remain, status, created_at FROM public.bill_payment_bonds;

-- 5) ใบลดหนี้: ไม่มีชื่อ ที่อยู่ โทร เลขผู้เสียภาษี
CREATE OR REPLACE VIEW public.vw_dash_credit_notes AS SELECT id, credit_note_number, issue_date, status, reason, record_invoice_id, record_bill_id, reference_invoice_number, reference_bill_number, customer_water_id, customer_registration_number, branch_id, type_id, type_name, water_unit, sum, sum_service, vat, discount, total, amount_used_total, cancel_at, created_at FROM public.credit_notes;

-- 6) ใบแจ้งหนี้งานขาย: ไม่มีชื่อ ที่อยู่ โทร เลขผู้เสียภาษี
CREATE OR REPLACE VIEW public.vw_dash_bill_invoice_fees AS SELECT id, bill_fee_id, quotation_id, invoice_number, bill_date, status, type, customer_water_id, customer_registration_number, branch_id, payment_type, payment_date, subtotal, vat, total, withhold_tax_amount, created_at FROM public.bill_invoice_fees;

-- 7) สิทธิ์อ่าน: views ข้างบน + ตารางที่ไม่มีข้อมูลส่วนบุคคล
GRANT SELECT ON public.vw_dash_customer_waters, public.vw_dash_customers, public.vw_dash_requests, public.vw_dash_bill_payment_bonds, public.vw_dash_credit_notes, public.vw_dash_bill_invoice_fees TO mcp_reader;
GRANT SELECT ON public.customer_water_types, public.request_types, public.dmas, public.credit_note_record_bill, public.bill_invoice_fee_items TO mcp_reader;
