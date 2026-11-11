-- 06_collections : ยอดรับชำระตามใบเสร็จ ตามวันที่รับชำระ (payment_date ถ้ามี ไม่มีใช้วันที่ใบเสร็จ) รายเดือน x สาขา x ประเภท x ช่องทาง
-- kind: water = ใบเสร็จค่าน้ำ (record_bills) | water_legacy = ใบเสร็จค่าน้ำลูกค้ารายใหญ่ระบบเดิม (bill_fees) | fee = งานขาย/บริการ (bill_fees) | bond = เงินประกัน (bill_payment_bonds)
-- สาขาของใบเสร็จค่าน้ำใช้สาขาของใบแจ้งหนี้ (ใบเสร็จระบบเดิมจำนวนมากบันทึกสาขาเป็นนาเตย ทั้งที่ใบแจ้งหนี้เป็นไม้ขาว)
-- วันที่ที่บันทึกเป็นปี พ.ศ. (ปี > 2400) แปลงเป็น ค.ศ. โดยลบ 543 ปี
-- ch: qr = สแกน QR บนใบแจ้งหนี้ผ่านแอปธนาคาร (ระบบบันทึกเอง) · epay = E-Payment · direct = ชำระตรงที่พนักงานบันทึก
-- amt = ยอดในใบเสร็จรวม VAT ; ใบเสร็จยอด 0 (ส่วนใหญ่ใช้น้ำไม่เกินโควตาน้ำฟรี free_units · บางใบหักด้วยใบลดหนี้ทั้งใบ) นับใน zero_n แต่ไม่มีผลต่อยอดเงิน
with big as (select unnest(array[4, 2438, 1363]) cw),
r0 as (
  -- ช่องทาง (ยืนยัน 11/11/69): direct ที่ระบบบันทึกเอง (save_by = system, มีเลข transaction) = ลูกค้าสแกน QR บนใบแจ้งหนี้ จ่ายผ่านแอปธนาคาร → qr
  --   scan ที่พนักงานบันทึก (สัปดาห์แรกหลังขึ้นระบบ) = qr · direct ที่ save_by = e-payment → epay
  select coalesce(rb.payment_date, rb.issue_date) d0, coalesce(i.branch_id, rb.branch_id) branch_id, 'water' kind,
         case when rb.payment_type = 'scan' or (rb.payment_type = 'direct' and rb.save_by = 'system') then 'qr'
              when rb.payment_type = 'direct' and rb.save_by = 'e-payment' then 'epay' else rb.payment_type end ch, rb.total amt, coalesce(rb.withhold_tax_amount, 0) wht
  from record_bills rb left join record_invoices i on i.id = rb.record_invoice_id
  where rb.status = 'paymented'
  union all
  select coalesce(payment_date, bill_date), branch_id,
         case when customer_water_id in (select cw from big) and coalesce(bill_number, '') not like 'IV%' then 'water_legacy' else 'fee' end,
         payment_type, total::numeric, coalesce(withhold_tax_amount, 0)
  from bill_fees where status = 'active'
  union all
  select coalesce(payment_date, bill_date), branch_id, 'bond', payment_type, total, 0::numeric  -- view เงินประกันไม่มีคอลัมน์ภาษีหัก ณ ที่จ่าย
  from vw_dash_bill_payment_bonds where coalesce(status, '') <> 'cancelled'),
r as (
  select case when d0 > date '2400-01-01' then (d0 - interval '543 years')::date else d0 end d, branch_id, kind,
         case when ch = 'tranfer' then 'transfer' when ch = 'scan' then 'qr' else coalesce(ch, '?') end ch, amt, wht
  from r0),
x as (select to_char(d, 'YYYY-MM') m, branch_id, kind, ch, count(*) n, sum(amt) amt, sum(wht) wht, count(*) filter (where amt = 0) zero_n
      from r where d between $1::date and $2::date group by 1, 2, 3, 4)
select json_build_object('ds', 'collections', 'cols', json_build_array('m','br','kind','ch','n','amt','wht','zero_n'),
  'rows', json_agg(json_build_array(x.m, coalesce(b.name, 'ไม่ระบุ'), x.kind, x.ch, x.n, round(x.amt, 2), round(x.wht, 2), x.zero_n) order by x.m, b.name, x.kind, x.ch),
  'check', json_build_object('amt', round(sum(x.amt), 2), 'n', sum(x.n)))
from x left join branches b on b.id = x.branch_id;
