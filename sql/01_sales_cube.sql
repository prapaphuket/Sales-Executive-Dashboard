-- 01_sales_cube : ยอดขายสุทธิไม่รวม VAT + หน่วยน้ำ รายเดือน x สาขา x กลุ่มลูกค้า x แหล่งเอกสาร
-- ฐานเวลา: วันที่ออกเอกสาร (ใบแจ้งหนี้ค่าน้ำ = record_invoices.issue_date, ใบแจ้งหนี้งานขาย = bill_invoice_fees.bill_date, ใบลดหนี้ = credit_notes.issue_date)
-- $1::date = วันแรกของช่วง (date), $2::date = วันอ้างอิง/วันสุดท้ายของข้อมูล (date)
-- src: W = ค่าน้ำ+ค่าบริการ (ใบแจ้งหนี้ค่าน้ำ) | L = ค่าน้ำลูกค้ารายใหญ่จากใบแจ้งหนี้ระบบเดิม (INT/IMK) | F = งานขายและบริการอื่น | C = ใบลดหนี้ (ติดลบ)
with big as (select unnest(array[4, 2438, 1363]) cw),  -- กปภ. AR00C-00029, ทอท. AR00C-02663, อบต.ไม้ขาว/หอถัง (เดิม NT63020004)
cw as (select c.id, c.branch_id, c.dma_id, split_part(t.name, ' - ', 1) ty from vw_dash_customer_waters c left join customer_water_types t on t.id = c.type_id),
inv as (  -- ตัดแถวซ้ำที่เหมือนกันทุกค่า (เลขเอกสาร ลูกค้า วันที่ ยอด หน่วย) เหลือแถวเดียว
  select distinct on (i.invoice_number, i.customer_water_id, i.issue_date, i.total, i.water_unit) i.*
  from record_invoices i
  where i.status <> 'cancelled' and not exists (select 1 from vw_dash_credit_notes zr where zr.record_invoice_id = i.id and coalesce(zr.status, '') <> 'cancelled' and zr.total >= i.total - 0.01) and i.issue_date between $1::date and $2::date
  order by i.invoice_number, i.customer_water_id, i.issue_date, i.total, i.water_unit, i.id),
w as (
  select to_char(i.issue_date, 'YYYY-MM') m, i.branch_id, coalesce(cw.ty, '?') ty, 'W' src,
         count(*) docs, sum(i.sum) wat, sum(i.sum_service) svc,
         sum(case when coalesce(i.discount, 0) = 0 or coalesce(i.total_before_discount, 0) = 0 then 0
                  else i.discount * (i.sum + i.sum_service) / i.total_before_discount end) disc,
         sum(i.water_unit) units,
         sum(case when i.discount_config ->> 'discount_type' = 'free_units'
                  then least(i.water_unit, (i.discount_config ->> 'discount_value')::numeric) else 0 end) free_units,
         sum(i.vat) vat_doc
  from inv i left join cw on cw.id = i.customer_water_id
  group by 1, 2, 3),
l as (
  select to_char(f.bill_date, 'YYYY-MM') m, f.branch_id,
         case f.customer_water_id when 4 then 'T2.2' when 2438 then 'T3.1' else 'T2.3' end ty, 'L' src,
         count(*) docs, sum(f.subtotal)::numeric wat, 0::numeric svc, 0::numeric disc, null::numeric units, null::numeric free_units, sum(f.vat)::numeric vat_doc
  from vw_dash_bill_invoice_fees f
  where f.status = 'active' and f.bill_date between $1::date and $2::date
    and f.customer_water_id in (select cw from big) and f.invoice_number not like 'BL%'
  group by 1, 2, 3),
f as (
  select to_char(f.bill_date, 'YYYY-MM') m, f.branch_id, coalesce(cw.ty, '?') ty, 'F' src,
         count(*) docs, 0::numeric wat, sum(f.subtotal)::numeric svc, 0::numeric disc, null::numeric units, null::numeric free_units, sum(f.vat)::numeric vat_doc
  from vw_dash_bill_invoice_fees f left join cw on cw.id = f.customer_water_id
  where f.status = 'active' and f.bill_date between $1::date and $2::date
    and not (f.customer_water_id in (select cw from big) and f.invoice_number not like 'BL%')
  group by 1, 2, 3),
c as (
  select to_char(n.issue_date, 'YYYY-MM') m, n.branch_id, coalesce(cw.ty, '?') ty, 'C' src,
         count(*) docs, -sum(n.total * (n.sum + n.sum_service) / nullif(n.sum + n.sum_service + n.vat, 0)) wat, 0::numeric svc, 0::numeric disc, null::numeric units, null::numeric free_units, -sum(n.total - n.total * (n.sum + n.sum_service) / nullif(n.sum + n.sum_service + n.vat, 0)) vat_doc
  from vw_dash_credit_notes n left join cw on cw.id = n.customer_water_id
  where coalesce(n.status, '') <> 'cancelled' and not exists (select 1 from record_invoices zi where zi.id = n.record_invoice_id and n.total >= zi.total - 0.01) and n.issue_date between $1::date and $2::date
  group by 1, 2, 3),
u as (select * from w union all select * from l union all select * from f union all select * from c)
select json_build_object('ds', 'sales_cube',
  'cols', json_build_array('m','br','ty','src','docs','wat','svc','disc','net','units','free','vat'),
  'rows', json_agg(json_build_array(u.m, coalesce(b.name, 'ไม่ระบุ'), u.ty, u.src, u.docs,
           round(u.wat, 2), round(u.svc, 2), round(u.disc, 2), round(u.wat + u.svc - u.disc, 2),
           round(u.units, 0), round(u.free_units, 0), round(u.vat_doc, 2)) order by u.m, b.name, u.ty, u.src),
  'check', json_build_object('net', round(sum(u.wat + u.svc - u.disc), 2), 'units', round(sum(u.units), 0), 'docs', sum(u.docs), 'vat', round(sum(u.vat_doc), 2)))
from u left join branches b on b.id = u.branch_id;
