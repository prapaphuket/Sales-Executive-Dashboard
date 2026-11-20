-- 20_trc_docs : รายการเอกสาร WMS ของเดือนกระทบยอดกับ TRCloud (เดือนเต็มล่าสุดก่อนวันอ้างอิง $2) — ไม่มีข้อมูลส่วนบุคคล
-- ใช้คู่กับ scripts/trc_recon.py ที่อ่านไฟล์ TRCloud (ดึงผ่าน MCP เดือนละครั้ง) แล้วสร้าง data/trc_recon.json
-- k: BL = ใบแจ้งหนี้ค่าน้ำ (record_invoices) | BF = ใบแจ้งหนี้งานขาย (bill_invoice_fees) | RV = ใบเสร็จค่าน้ำ (record_bills) | RF = ใบเสร็จงานขาย (bill_fees) | CN = ใบลดหนี้
-- วันที่: ใบแจ้งหนี้ = วันที่ออก · ใบเสร็จ = วันที่ออกใบเสร็จ (TRCloud ออก IV ตามวันนั้น) และเก็บวันที่รับชำระแยก · ปี พ.ศ. แปลงเป็น ค.ศ.
-- $1 ไม่ใช้ (คงไว้ให้รูปแบบเหมือนไฟล์อื่น)
with p as (select date_trunc('month', $2::date - interval '1 month')::date a, (date_trunc('month', $2::date) - interval '1 day')::date e, $1::date unused),
d as (
  select 'BL' k, i.invoice_number doc, i.issue_date d, null::date pd, i.branch_id, i.status st,
         (i.sum + i.sum_service - case when coalesce(i.discount, 0) = 0 or coalesce(i.total_before_discount, 0) = 0 then 0 else i.discount * (i.sum + i.sum_service) / i.total_before_discount end) pre,
         i.vat, i.total tot, i.trcloud_id is not null trc, null::text ref
  from record_invoices i, p where i.issue_date between p.a and p.e
  union all
  select 'BF', f.invoice_number, f.bill_date, null, f.branch_id, f.status, f.subtotal::numeric, f.vat::numeric, f.total::numeric, f.trcloud_id is not null, null
  from bill_invoice_fees f, p where f.bill_date between p.a and p.e
  union all
  select 'RV', rb.bill_number, case when rb.issue_date > date '2400-01-01' then (rb.issue_date - interval '543 years')::date else rb.issue_date end,
         rb.payment_date, coalesce(i.branch_id, rb.branch_id), rb.status, rb.sum + rb.sum_service, rb.vat, rb.total, rb.trcloud_id is not null, i.invoice_number
  from record_bills rb left join record_invoices i on i.id = rb.record_invoice_id, p
  where (case when rb.issue_date > date '2400-01-01' then (rb.issue_date - interval '543 years')::date else rb.issue_date end) between p.a and p.e
  union all
  select 'RF', b.bill_number, b.bill_date, b.payment_date, b.branch_id, b.status, b.subtotal::numeric, b.vat::numeric, b.total::numeric, b.trcloud_id is not null, f.invoice_number
  from bill_fees b left join bill_invoice_fees f on f.id = b.bill_invoice_fee_id, p where b.bill_date between p.a and p.e
  union all
  select 'CN', n.credit_note_number, n.issue_date, null, n.branch_id, n.status, n.sum + n.sum_service, n.vat, n.total, null, n.reference_invoice_number
  from vw_dash_credit_notes n, p where n.issue_date between p.a and p.e)
select json_build_object('ds', 'trc_docs', 'month', (select to_char(a, 'YYYY-MM') from p),
  'cols', json_build_array('k','doc','d','pd','br','st','pre','vat','tot','trc','ref'),
  'rows', coalesce(json_agg(json_build_array(d.k, d.doc, to_char(d.d, 'YYYY-MM-DD'), to_char(d.pd, 'YYYY-MM-DD'), coalesce(b.name, 'ไม่ระบุ'), d.st,
           round(d.pre, 2), round(d.vat, 2), round(d.tot, 2), d.trc, d.ref) order by d.k, d.doc), '[]'::json),
  'check', json_build_object('n', count(*), 'tot', round(sum(d.tot), 2)))
from d left join branches b on b.id = d.branch_id;
