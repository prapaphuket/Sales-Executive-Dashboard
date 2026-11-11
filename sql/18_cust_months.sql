-- 18_cust_months : หน่วยน้ำรายเดือนรายผู้ใช้น้ำ — ใช้คำนวณตามช่วงเดือนที่เลือกบนหน้าเว็บ
--   (หน้าการใช้น้ำเทียบปีก่อน: จัดกลุ่มเพิ่ม/ลด/ใหม่/หยุดใช้ · หน้ารายได้ตามกลุ่มลูกค้า: นับจำนวนลูกค้าไม่ซ้ำในช่วง)
-- ช่วงข้อมูล = 12 เดือนก่อน $1 ถึงสิ้นเดือนก่อนวันอ้างอิง $2 · months = รายชื่อเดือนเรียงตามช่อง u
-- u = ค่าต่อเดือนคั่นด้วย , : ตัวเลข = หน่วยน้ำในใบแจ้งหนี้ค่าน้ำ (W) · L = มีบิลค่าน้ำลูกค้ารายใหญ่ระบบเดิม (ไม่มีหน่วย) · ว่าง = ไม่มีบิล
-- ประเภท: ตามทะเบียน ยกเว้นบิลระบบเดิม (L) ของ cw 4 = T2.2, 2438 = T3.1, 1363 = T2.3 (เหมือน 13_revenue_groups) · สาขา = สาขาของใบแจ้งหนี้
-- หมู่: ทะเบียน customer_waters (moo, sub_district) ก่อน แล้วจึงที่อยู่ในใบแจ้งหนี้ล่าสุด (เหมือน 13_revenue_groups)
-- ชื่อ: ใบแจ้งหนี้ล่าสุด → ถ้ายังไม่เคยมีบิลใช้ customer_waters.name
with big as (select unnest(array[4, 2438, 1363]) cw),
p as (select (date_trunc('month', $2::date) - interval '1 day')::date e1, (date_trunc('month', $1::date) - interval '12 months')::date a0),
mon as (select to_char(g, 'YYYY-MM') m, row_number() over (order by g) i from p, generate_series(p.a0, p.e1, interval '1 month') g),
addr as (select distinct on (customer_water_id) customer_water_id cw, customer_address a, customer_name nm from record_invoices
         where status <> 'cancelled' and customer_water_id is not null order by customer_water_id, issue_date desc, id desc),
cw as (
  select c.id, c.registration_number reg, split_part(t.name, ' - ', 1) ty, coalesce(m.nm, nullif(trim(wt.name), '')) nm,
         case when wt.sub_district in ('ไม้ขาว', 'ใม้ขาว', 'สาคู', 'สาคุ') and wt.moo ~ '^\s*\d{1,2}\s*$' then 'หมู่ ' || trim(wt.moo)::int
              when wt.registration_number = 'AR00C-02708' then 'หมู่ 3'   -- ภูเก็ตไพล (หมู่บ้านบูกิตตา): ไม้ขาว หมู่ 3 ตามหมุดพิกัด (ยืนยัน 11/11/69)
              when m.moo is not null and (m.tb is null or m.tb in ('ไม้ขาว', 'ใม้ขาว', 'สาคู', 'สาคุ')) then 'หมู่ ' || m.moo::int
              when ar.title ~ 'หมู่\s*\d' then 'หมู่ ' || substring(ar.title from 'หมู่\s*(\d{1,2})')::int   -- ชื่อพื้นที่จดมาตรมีเลขหมู่ เช่น "ไม้ขาว หมู่ 4"
              -- ชื่อหมู่บ้านในพื้นที่จดมาตร (ทำเนียบหมู่บ้านจากฝ่ายกลยุทธ์ 11/11/69) · บ้านในยาง = สาคู หมู่ 1 และ 2 จึงไม่ใช้
              when ar.title ~ 'ในทอน' then 'หมู่ 4' when ar.title ~ 'บางม่าเหลา' then 'หมู่ 5' when ar.title ~ 'บ้านสาคู' then 'หมู่ 3'
              when ar.title ~ 'หมากปรก' then 'หมู่ 1' when ar.title ~ 'คอเอน' then 'หมู่ 2' when ar.title ~ 'สวนมะพร้าว' then 'หมู่ 3'
              when ar.title ~ 'บ้านไม้ขาว' then 'หมู่ 4' when ar.title ~ 'ท่าฉัตรไชย' then 'หมู่ 5' when ar.title ~ 'บ่อไทร' then 'หมู่ 6' when ar.title ~ 'บ้านหยิด' then 'หมู่ 7'
              else 'ไม่ระบุหมู่' end moo
  from vw_dash_customer_waters c left join customer_water_types t on t.id = c.type_id
  left join customer_waters wt on wt.id = c.id
  left join meter_reading_areas ar on ar.id = wt.meter_reading_area_id
  left join lateral (select x.nm, substring(x.a from '(?:หมู่ที่|หมู่|ม\.)\s*(\d{1,2})') moo, substring(x.a from '(?:ตำบล|ต\.)\s*([ก-๙]+)') tb from addr x where x.cw = c.id) m on true),
inv as (select distinct on (i.invoice_number, i.customer_water_id, i.issue_date, i.total, i.water_unit) i.*
        from record_invoices i, p where i.status <> 'cancelled' and i.issue_date between p.a0 and p.e1 and i.customer_water_id is not null
        order by i.invoice_number, i.customer_water_id, i.issue_date, i.total, i.water_unit, i.id),
u as (
  select i.customer_water_id cwid, i.branch_id, null::text tyo, to_char(i.issue_date, 'YYYY-MM') m, i.water_unit q, false l from inv i
  union all
  select f.customer_water_id, f.branch_id, case f.customer_water_id when 4 then 'T2.2' when 2438 then 'T3.1' else 'T2.3' end, to_char(f.bill_date, 'YYYY-MM'), null, true
  from vw_dash_bill_invoice_fees f, p where f.status = 'active' and f.customer_water_id in (select cw from big) and f.invoice_number not like 'BL%' and f.bill_date between p.a0 and p.e1),
g as (
  select u.cwid, coalesce(u.tyo, cw.ty, '?') ty, coalesce(b.name, 'ไม่ระบุ') br, u.m, sum(u.q) q, bool_or(u.l) l
  from u left join cw on cw.id = u.cwid left join branches b on b.id = u.branch_id group by 1, 2, 3, 4),
k as (select distinct cwid, ty, br from g),
agg as (
  select k.cwid, k.ty, k.br, string_agg(case when g.m is null then '' when g.q is not null then round(g.q)::text else 'L' end, ',' order by mon.i) u
  from k cross join mon left join g on g.cwid = k.cwid and g.ty = k.ty and g.br = k.br and g.m = mon.m group by 1, 2, 3)
select json_build_object('ds', 'cust_months',
  'months', (select json_agg(m order by i) from mon),
  'cols', json_build_array('reg', 'name', 'br', 'ty', 'moo', 'u'),
  'rows', (select json_agg(json_build_array(cw.reg, coalesce(cw.nm, '–'), a.br, a.ty, coalesce(cw.moo, 'ไม่ระบุหมู่'), a.u) order by cw.reg, a.ty)
           from agg a join cw on cw.id = a.cwid));
