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
newreg as (select to_char(c.created_at, 'YYYY-MM') m, count(*) n from vw_dash_customer_waters c where c.created_at::date between $1::date and $2::date group by 1)
select json_build_object('ds', 'customers',
  'cols', json_build_array('m','br','ty','active','new'),
  'rows', (select json_agg(json_build_array(a.m, coalesce(b.name, 'ไม่ระบุ'), a.ty, a.active, a.newc) order by a.m, b.name, a.ty) from act a left join branches b on b.id = a.branch_id),
  'status', (select json_agg(json_build_array(br, ty, status, n) order by br, ty, status) from reg),
  'created', (select json_agg(json_build_array(m, n) order by m) from newreg));
