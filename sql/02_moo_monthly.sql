-- 02_moo_monthly : ยอดขายค่าน้ำ (ใบแจ้งหนี้ค่าน้ำเท่านั้น) และหน่วยน้ำ รายเดือน x สาขา x ประเภท x หมู่
-- ใช้แทน 02_dma_monthly (การผูก DMA ในทะเบียนยังไม่ครบ จึงยังไม่ใช้ DMA ในรายงาน)
-- หมู่: อ่านจากที่อยู่ในใบแจ้งหนี้ล่าสุดของผู้ใช้น้ำ (ข้อความ "หมู่ที่/หมู่/ม.") เหมือน 13_revenue_groups
--       ใช้เฉพาะที่อยู่ในตำบลไม้ขาว/สาคู หรือไม่ระบุตำบล นอกนั้น = ไม่ระบุหมู่ · สาขา = สาขาของใบแจ้งหนี้
with addr as (select distinct on (customer_water_id) customer_water_id cw, customer_address a from record_invoices
         where status <> 'cancelled' and customer_water_id is not null order by customer_water_id, issue_date desc, id desc),
cw as (
  select c.id, split_part(t.name, ' - ', 1) ty,
         case when m.moo is not null and (m.tb is null or m.tb in ('ไม้ขาว', 'ใม้ขาว', 'สาคู', 'สาคุ')) then 'หมู่ ' || m.moo::int else 'ไม่ระบุหมู่' end moo
  from vw_dash_customer_waters c left join customer_water_types t on t.id = c.type_id
  left join lateral (select substring(x.a from '(?:หมู่ที่|หมู่|ม\.)\s*(\d{1,2})') moo, substring(x.a from '(?:ตำบล|ต\.)\s*([ก-๙]+)') tb from addr x where x.cw = c.id) m on true),
inv as (
  select distinct on (i.invoice_number, i.customer_water_id, i.issue_date, i.total, i.water_unit) i.*
  from record_invoices i where i.status <> 'cancelled' and i.issue_date between $1::date and $2::date
  order by i.invoice_number, i.customer_water_id, i.issue_date, i.total, i.water_unit, i.id),
x as (
  select to_char(i.issue_date, 'YYYY-MM') m, coalesce(b.name, 'ไม่ระบุ') br, coalesce(cw.ty, '?') ty, coalesce(cw.moo, 'ไม่ระบุหมู่') moo, count(*) docs,
         sum(i.sum + i.sum_service - case when coalesce(i.discount, 0) = 0 or coalesce(i.total_before_discount, 0) = 0 then 0
                  else i.discount * (i.sum + i.sum_service) / i.total_before_discount end) net,
         sum(i.water_unit) units, count(distinct i.customer_water_id) cust
  from inv i left join cw on cw.id = i.customer_water_id left join branches b on b.id = i.branch_id
  group by 1, 2, 3, 4)
select json_build_object('ds', 'moo_monthly', 'cols', json_build_array('m','br','ty','moo','docs','net','units','cust'),
  'rows', json_agg(json_build_array(m, br, ty, moo, docs, round(net, 2), round(units, 0), cust) order by m, br, ty, moo),
  'check', json_build_object('net', round(sum(net), 2), 'units', round(sum(units), 0)))
from x;
