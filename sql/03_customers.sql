-- 03_customers : ลูกค้าที่มีบิลค่าน้ำในเดือน, ลูกค้าเริ่มมีบิลครั้งแรก (ลูกค้าใหม่ตามการเรียกเก็บ), สถานะทะเบียนปัจจุบัน
with cw as (select c.id, c.branch_id, c.status, split_part(t.name, ' - ', 1) ty from vw_dash_customer_waters c left join customer_water_types t on t.id = c.type_id),
firstbill as (select customer_water_id, min(issue_date) d1 from record_invoices where status <> 'cancelled' group by 1),
act as (
  select to_char(i.issue_date, 'YYYY-MM') m, i.branch_id, coalesce(cw.ty, '?') ty,
         count(distinct i.customer_water_id) active,
         count(distinct i.customer_water_id) filter (where to_char(fb.d1, 'YYYY-MM') = to_char(i.issue_date, 'YYYY-MM')) newc
  from record_invoices i left join cw on cw.id = i.customer_water_id left join firstbill fb on fb.customer_water_id = i.customer_water_id
  where i.status <> 'cancelled' and i.issue_date between $1::date and $2::date
  group by 1, 2, 3),
reg as (select coalesce(b.name, 'ไม่ระบุ') br, coalesce(cw.ty, '?') ty, cw.status, count(*) n from cw left join branches b on b.id = cw.branch_id group by 1, 2, 3),
newreg as (select to_char(c.created_at, 'YYYY-MM') m, count(*) n from vw_dash_customer_waters c where c.created_at::date between $1::date and $2::date group by 1),
-- ยอดขายของลูกค้าใหม่: ผู้ใช้น้ำที่ใบแจ้งหนี้ค่าน้ำใบแรกอยู่ในช่วง แยกตามเดือนใบแรก (fm) และเดือนที่เกิดยอด (m)
-- ค่าน้ำ + ค่าบริการ − ส่วนลด (ไม่รวม VAT) จากใบแจ้งหนี้ค่าน้ำ · fee = งานขาย (เช่น ค่าติดตั้ง/ค่ามาตร) ของลูกค้ากลุ่มเดียวกัน
-- ไม่นับใบแจ้งหนี้ที่ถูกลดหนี้เต็มจำนวน (เหมือน sales_cube)
ninv as (select distinct on (i.invoice_number, i.customer_water_id, i.issue_date, i.total, i.water_unit) i.*
  from record_invoices i join firstbill fb on fb.customer_water_id = i.customer_water_id
  where i.status <> 'cancelled' and not exists (select 1 from vw_dash_credit_notes zr where zr.record_invoice_id = i.id and coalesce(zr.status, '') <> 'cancelled' and zr.total >= i.total - 0.01)
    and fb.d1 between $1::date and $2::date and i.issue_date between $1::date and $2::date
  order by i.invoice_number, i.customer_water_id, i.issue_date, i.total, i.water_unit, i.id),
nu as (
  select to_char(fb.d1, 'YYYY-MM') fm, to_char(i.issue_date, 'YYYY-MM') m, i.branch_id, coalesce(cw.ty, '?') ty, i.customer_water_id cwid,
         i.sum + i.sum_service - case when coalesce(i.discount, 0) = 0 or coalesce(i.total_before_discount, 0) = 0 then 0 else i.discount * (i.sum + i.sum_service) / i.total_before_discount end net,
         i.water_unit units, 0::numeric fee, 'W' k
  from ninv i join firstbill fb on fb.customer_water_id = i.customer_water_id left join cw on cw.id = i.customer_water_id
  union all
  select to_char(fb.d1, 'YYYY-MM'), to_char(f.bill_date, 'YYYY-MM'), f.branch_id, coalesce(cw.ty, '?'), f.customer_water_id, 0, 0, f.subtotal::numeric, 'F'
  from vw_dash_bill_invoice_fees f join firstbill fb on fb.customer_water_id = f.customer_water_id left join cw on cw.id = f.customer_water_id
  where f.status = 'active' and fb.d1 between $1::date and $2::date and f.bill_date between $1::date and $2::date),
newrev as (select fm, m, branch_id, ty, count(distinct cwid) filter (where k = 'W') n, sum(net) net, sum(units) units, sum(fee) fee from nu group by 1, 2, 3, 4)
select json_build_object('ds', 'customers',
  'cols', json_build_array('m','br','ty','active','new'),
  'rows', (select json_agg(json_build_array(a.m, coalesce(b.name, 'ไม่ระบุ'), a.ty, a.active, a.newc) order by a.m, b.name, a.ty) from act a left join branches b on b.id = a.branch_id),
  'status', (select json_agg(json_build_array(br, ty, status, n) order by br, ty, status) from reg),
  'created', (select json_agg(json_build_array(m, n) order by m) from newreg),
  'newrev_cols', json_build_array('fm','m','br','ty','n','net','units','fee'),
  'newrev', (select json_agg(json_build_array(x.fm, x.m, coalesce(b.name, 'ไม่ระบุ'), x.ty, x.n, round(x.net, 2), round(x.units, 0), round(x.fee, 2)) order by x.fm, x.m, b.name, x.ty) from newrev x left join branches b on b.id = x.branch_id),
  'newrev_check', (select json_build_object('net', round(sum(net), 2), 'fee', round(sum(fee), 2)) from newrev));
