-- 02_dma_monthly : ยอดขายค่าน้ำ (ใบแจ้งหนี้ค่าน้ำเท่านั้น) และหน่วยน้ำ รายเดือน x DMA ตามทะเบียนปัจจุบัน
with inv as (
  select distinct on (i.invoice_number, i.customer_water_id, i.issue_date, i.total, i.water_unit) i.*
  from record_invoices i where i.status <> 'cancelled' and i.issue_date between $1::date and $2::date
  order by i.invoice_number, i.customer_water_id, i.issue_date, i.total, i.water_unit, i.id),
x as (
  select to_char(i.issue_date, 'YYYY-MM') m, coalesce(d.title, 'ไม่ระบุ DMA') dma, count(*) docs,
         sum(i.sum + i.sum_service - case when coalesce(i.discount, 0) = 0 or coalesce(i.total_before_discount, 0) = 0 then 0
                  else i.discount * (i.sum + i.sum_service) / i.total_before_discount end) net,
         sum(i.water_unit) units
  from inv i left join vw_dash_customer_waters c on c.id = i.customer_water_id left join dmas d on d.id = c.dma_id
  group by 1, 2)
select json_build_object('ds', 'dma_monthly', 'cols', json_build_array('m','dma','docs','net','units'),
  'rows', json_agg(json_build_array(m, dma, docs, round(net, 2), round(units, 0)) order by m, dma),
  'check', json_build_object('net', round(sum(net), 2), 'units', round(sum(units), 0)))
from x;
