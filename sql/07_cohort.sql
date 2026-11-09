-- 07_cohort : อัตราจัดเก็บตามกลุ่มบิล — ใบแจ้งหนี้ค่าน้ำระบบใหม่ (ออกตั้งแต่ 1 มี.ค. 2569) ตามเดือนที่ออก ชำระแล้ว ณ วันอ้างอิง
-- ตัวตั้งและตัวหารใช้ยอดรวม VAT ตามใบแจ้งหนี้ (total) ฐานเดียวกัน; ใบที่ส่วนลดเต็มจำนวน (total = 0) ไม่มีผลต่ออัตรา
with inv as (
  select distinct on (i.invoice_number, i.customer_water_id, i.issue_date, i.total, i.water_unit) i.*
  from record_invoices i where i.status <> 'cancelled' and i.issue_date between greatest($1::date, date '2026-03-01') and $2::date
  order by i.invoice_number, i.customer_water_id, i.issue_date, i.total, i.water_unit, i.id),
pay as (select record_invoice_id, min(coalesce(payment_date, issue_date)) pd, sum(total) paid from record_bills where status = 'paymented' group by 1),
x as (
  select to_char(i.issue_date, 'YYYY-MM') m, i.branch_id, count(*) n, sum(i.total) billed,
         sum(i.total) filter (where i.status = 'paymented' and p.pd <= $2::date) paid,
         sum(i.total) filter (where i.status = 'paymented' and p.pd <= i.due_date) ontime,
         sum(i.total) filter (where i.status = 'pending') open,
         sum(i.total) filter (where i.status = 'paymented' and p.pd is null) paid_norcpt
  from inv i left join pay p on p.record_invoice_id = i.id group by 1, 2)
select json_build_object('ds', 'cohort', 'cols', json_build_array('m','br','n','billed','paid','ontime','open','paid_norcpt'),
  'rows', json_agg(json_build_array(x.m, coalesce(b.name, 'ไม่ระบุ'), x.n, round(x.billed, 2), round(coalesce(x.paid, 0), 2), round(coalesce(x.ontime, 0), 2), round(coalesce(x.open, 0), 2), round(coalesce(x.paid_norcpt, 0), 2)) order by x.m, b.name))
from x left join branches b on b.id = x.branch_id;
