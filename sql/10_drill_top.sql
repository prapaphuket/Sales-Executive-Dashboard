-- 10_drill_top : เอกสารต้นทางของลูกค้า 15 อันดับแรก (12 เดือนล่าสุดที่ครบเดือน) — ใบแจ้งหนี้ค่าน้ำ / ใบแจ้งหนี้ระบบเดิม / ใบลดหนี้
with big as (select unnest(array[4, 2438, 1363]) cw),
p as (select date_trunc('month', $2::date)::date - interval '12 months' a1, date_trunc('month', $2::date)::date - interval '1 day' a2),
inv as (
  select distinct on (i.invoice_number, i.customer_water_id, i.issue_date, i.total, i.water_unit) i.*
  from record_invoices i, p where i.status <> 'cancelled' and not exists (select 1 from vw_dash_credit_notes zr where zr.record_invoice_id = i.id and coalesce(zr.status, '') <> 'cancelled' and zr.total >= i.total - 0.01) and i.issue_date between p.a1 and p.a2
  order by i.invoice_number, i.customer_water_id, i.issue_date, i.total, i.water_unit, i.id),
s as (
  select i.customer_water_id cw, 'W' src, i.invoice_number doc, i.issue_date d, i.status st, i.water_unit units,
         i.sum + i.sum_service - case when coalesce(i.discount, 0) = 0 or coalesce(i.total_before_discount, 0) = 0 then 0
         else i.discount * (i.sum + i.sum_service) / i.total_before_discount end net from inv i
  union all
  select f.customer_water_id, 'L', f.invoice_number, f.bill_date, case when f.bill_fee_id is null then 'pending' else 'paymented' end, null, f.subtotal::numeric
  from vw_dash_bill_invoice_fees f, p where f.status = 'active' and f.customer_water_id in (select cw from big) and f.invoice_number not like 'BL%' and f.bill_date between p.a1 and p.a2
  union all
  select n.customer_water_id, 'C', n.credit_note_number, n.issue_date, n.status, null, -(n.total * (n.sum + n.sum_service) / nullif(n.sum + n.sum_service + n.vat, 0)) from vw_dash_credit_notes n, p
  where coalesce(n.status, '') <> 'cancelled' and not exists (select 1 from record_invoices zi where zi.id = n.record_invoice_id and n.total >= zi.total - 0.01) and n.issue_date between p.a1 and p.a2),
rk as (select cw, row_number() over (order by sum(net) desc) r from s group by cw)
select json_build_object('ds', 'drill_top', 'cols', json_build_array('cw','src','doc','date','status','units','net'),
  'rows', json_agg(json_build_array(s.cw, s.src, s.doc, to_char(s.d, 'YYYY-MM-DD'), s.st, round(s.units, 0), round(s.net, 2)) order by s.cw, s.d, s.doc))
from s join rk on rk.cw = s.cw and rk.r <= 15;
