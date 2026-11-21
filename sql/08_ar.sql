-- สาขาของ BL งานขายที่ไม่ผูกสาขาใน WMS (คุณวิชาญยืนยัน 21/11/69): BL2611040002 = สาคู (1) · BL2605230004, BL2606100002 = ไม้ขาว (2)
-- 08_ar : ลูกหนี้คงค้าง ณ วันอ้างอิง (สถานะเอกสาร ณ เวลาที่สำรองข้อมูล) แยกช่วงอายุตามวันครบกำหนด x สาขา x กลุ่มลูกค้า
-- ใบค่าน้ำที่ยังเป็น pending แต่ใบเลขเดียวกันในระบบงานขายมีใบเสร็จแล้ว (ใบนำเข้าจาก Pay2Head เช่น IMK69020004 ชำระ 9/4/69) ถือว่าชำระแล้ว
-- ช่วง: 0 ยังไม่ครบกำหนด (due >= วันอ้างอิง) | 1 = 1-30 | 2 = 31-60 | 3 = 61-90 | 4 = มากกว่า 90 วัน | 9 = ไม่มีวันครบกำหนด
with cw as (select c.id, split_part(t.name, ' - ', 1) ty from vw_dash_customer_waters c left join customer_water_types t on t.id = case when c.id = 1363 then 11 else c.type_id end),
a as (
  select i.branch_id, coalesce(cw.ty, '?') ty, 'water' kind,
         case when i.due_date is null then 9 when i.due_date >= $2::date then 0 when $2::date - i.due_date <= 30 then 1 when $2::date - i.due_date <= 60 then 2 when $2::date - i.due_date <= 90 then 3 else 4 end bk,
         i.total amt, (i.issue_date < date '2026-03-01') legacy
  from record_invoices i left join cw on cw.id = i.customer_water_id where i.status = 'pending' and i.issue_date <= $2::date and not exists (select 1 from bill_invoice_fees zf join bill_fees zb on zb.id = zf.bill_fee_id where zf.invoice_number = i.invoice_number and zf.customer_water_id = i.customer_water_id and zf.status = 'active' and zb.status = 'active')
  union all
  select coalesce(f.branch_id, case f.invoice_number when 'BL2611040002' then 1 when 'BL2605230004' then 2 when 'BL2606100002' then 2 end), coalesce(cw.ty, '?'), 'fee', 9, f.total::numeric, f.bill_date < date '2026-03-01'
  from vw_dash_bill_invoice_fees f left join cw on cw.id = f.customer_water_id where f.status = 'active' and f.bill_fee_id is null and f.bill_date <= $2::date and not exists (select 1 from record_invoices zd where zd.invoice_number = f.invoice_number and zd.customer_water_id = f.customer_water_id and zd.status <> 'cancelled')),
x as (select branch_id, ty, kind, bk, legacy, count(*) n, sum(amt) amt from a group by 1, 2, 3, 4, 5)
select json_build_object('ds', 'ar', 'asof', to_char($2::date, 'YYYY-MM-DD'), 'cols', json_build_array('br','ty','kind','bk','legacy','n','amt'),
  'rows', json_agg(json_build_array(coalesce(b.name, 'ไม่ระบุ'), x.ty, x.kind, x.bk, x.legacy, x.n, round(x.amt, 2)) order by b.name, x.ty, x.kind, x.bk),
  'check', json_build_object('amt', round(sum(x.amt), 2), 'n', sum(x.n)),
  'cn_unused', (select json_build_object('n', count(*), 'amt', round(sum(total - coalesce(amount_used_total, 0)), 2)) from vw_dash_credit_notes where status = 'issued' and issue_date <= $2::date),
  'legacy_paid_no_receipt', (select json_build_object('n', count(*), 'amt', round(sum(i.total), 2)) from record_invoices i
       where i.status = 'paymented' and not exists (select 1 from record_bills b where b.record_invoice_id = i.id and b.status = 'paymented')))
from x left join branches b on b.id = x.branch_id;
