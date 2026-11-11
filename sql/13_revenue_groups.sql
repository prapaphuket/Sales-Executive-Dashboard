-- 13_revenue_groups : รายได้ตามกลุ่มลูกค้า (ม.ค. – เดือนเต็มล่าสุดของปี) เทียบช่วงเดียวกันปีก่อน แยกสาขา(ตำบล) x ประเภท x หมู่
-- $2::date = วันอ้างอิง -> ปีนี้ = ม.ค. ถึงสิ้นเดือนก่อนวันอ้างอิง, ปีก่อน = ช่วงเดียวกันปีก่อน ($1 ไม่ใช้ แต่รับไว้ให้รูปแบบเดียวกับไฟล์อื่น)
-- หมู่: อ่านจากที่อยู่ในใบแจ้งหนี้ล่าสุดของผู้ใช้น้ำ (ข้อความ "หมู่ที่/หมู่/ม.") ใช้เฉพาะที่อยู่ในตำบลไม้ขาว/สาคู หรือไม่ระบุตำบล นอกนั้น = ไม่ระบุหมู่
-- src: W = ใบแจ้งหนี้ค่าน้ำ | L = ค่าน้ำลูกค้ารายใหญ่ระบบเดิม (ไม่มีหน่วย) | F = งานขาย/บริการอื่น | C = ใบลดหนี้ (ติดลบ)
-- หมู่ (ปรับ 11/11/69): ใช้หมู่ + ตำบลในทะเบียน customer_waters (moo, sub_district = ที่ตั้งมาตร) ก่อน
--       ถ้าทะเบียนไม่ระบุหรืออยู่นอกตำบลไม้ขาว/สาคู จึงอ่านจากที่อยู่ในใบแจ้งหนี้ล่าสุดเหมือนเดิม
with big as (select unnest(array[4, 2438, 1363]) cw),
p as (select (date_trunc('month', $2::date) - interval '1 day')::date e1, greatest($1::date, $1::date) dummy),
w as (select date_trunc('year', e1)::date s1, e1, (date_trunc('year', e1) - interval '1 year')::date s0, (e1 - interval '1 year')::date e0 from p),
addr as (select distinct on (customer_water_id) customer_water_id cw, customer_address a from record_invoices
         where status <> 'cancelled' and customer_water_id is not null order by customer_water_id, issue_date desc, id desc),
cw as (
  select c.id, split_part(t.name, ' - ', 1) ty,
         case when wt.sub_district in ('ไม้ขาว', 'ใม้ขาว', 'สาคู', 'สาคุ') and wt.moo ~ '^\s*\d{1,2}\s*$' then 'หมู่ ' || trim(wt.moo)::int
              when m.moo is not null and (m.tb is null or m.tb in ('ไม้ขาว', 'ใม้ขาว', 'สาคู', 'สาคุ')) then 'หมู่ ' || m.moo::int else 'ไม่ระบุหมู่' end moo
  from vw_dash_customer_waters c left join customer_water_types t on t.id = c.type_id
  left join customer_waters wt on wt.id = c.id
  left join lateral (select substring(x.a from '(?:หมู่ที่|หมู่|ม\.)\s*(\d{1,2})') moo, substring(x.a from '(?:ตำบล|ต\.)\s*([ก-๙]+)') tb from addr x where x.cw = c.id) m on true),
inv as (select distinct on (i.invoice_number, i.customer_water_id, i.issue_date, i.total, i.water_unit) i.*
        from record_invoices i, w where i.status <> 'cancelled' and (i.issue_date between w.s1 and w.e1 or i.issue_date between w.s0 and w.e0)
        order by i.invoice_number, i.customer_water_id, i.issue_date, i.total, i.water_unit, i.id),
u as (
  select i.issue_date d, i.branch_id, i.customer_water_id cwid, 'W' src, i.sum wat, i.sum_service svc,
         case when coalesce(i.discount, 0) = 0 or coalesce(i.total_before_discount, 0) = 0 then 0 else i.discount * (i.sum + i.sum_service) / i.total_before_discount end disc,
         i.water_unit units,
         case when i.discount_config ->> 'discount_type' = 'free_units' then least(i.water_unit, (i.discount_config ->> 'discount_value')::numeric) else 0 end free
  from inv i
  union all
  select f.bill_date, f.branch_id, f.customer_water_id, case when f.customer_water_id in (select cw from big) and f.invoice_number not like 'BL%' then 'L' else 'F' end,
         case when f.customer_water_id in (select cw from big) and f.invoice_number not like 'BL%' then f.subtotal else 0 end::numeric,
         case when f.customer_water_id in (select cw from big) and f.invoice_number not like 'BL%' then 0 else f.subtotal end::numeric, 0::numeric, null::numeric, 0::numeric
  from vw_dash_bill_invoice_fees f, w where f.status = 'active' and (f.bill_date between w.s1 and w.e1 or f.bill_date between w.s0 and w.e0)
  union all
  select n.issue_date, n.branch_id, n.customer_water_id, 'C', -(n.total - n.vat), 0::numeric, 0::numeric, null::numeric, 0::numeric
  from vw_dash_credit_notes n, w where coalesce(n.status, '') <> 'cancelled' and (n.issue_date between w.s1 and w.e1 or n.issue_date between w.s0 and w.e0)),
x as (
  select extract(year from u.d)::int y, to_char(u.d, 'MM') mm, coalesce(b.name, 'ไม่ระบุ') br,
         coalesce(case when u.cwid = 4 then 'T2.2' when u.cwid = 2438 then 'T3.1' when u.cwid = 1363 and u.src = 'L' then 'T2.3' else cw.ty end, '?') ty, coalesce(cw.moo, 'ไม่ระบุหมู่') moo, u.src,
         sum(u.wat) wat, sum(u.svc) svc, sum(u.disc) disc, sum(u.units) units, sum(u.free) free,
         count(distinct u.cwid) filter (where u.src in ('W', 'L')) cm
  from u left join cw on cw.id = u.cwid left join branches b on b.id = u.branch_id
  group by 1, 2, 3, 4, 5, 6),
cust as (
  select extract(year from u.d)::int y, coalesce(b.name, 'ไม่ระบุ') br, coalesce(case when u.cwid = 4 then 'T2.2' when u.cwid = 2438 then 'T3.1' when u.cwid = 1363 and u.src = 'L' then 'T2.3' else cw.ty end, '?') ty,
         coalesce(cw.moo, 'ไม่ระบุหมู่') moo, count(distinct u.cwid) n
  from u left join cw on cw.id = u.cwid left join branches b on b.id = u.branch_id where u.src in ('W', 'L') group by 1, 2, 3, 4)
select json_build_object('ds', 'revenue_groups',
  'window', (select json_build_array(to_char(s1, 'YYYY-MM-DD'), to_char(e1, 'YYYY-MM-DD'), to_char(s0, 'YYYY-MM-DD'), to_char(e0, 'YYYY-MM-DD')) from w),
  'cols', json_build_array('y','mm','br','ty','moo','src','wat','svc','disc','net','units','free','cm'),
  'rows', (select json_agg(json_build_array(y, mm, br, ty, moo, src, round(wat, 2), round(svc, 2), round(disc, 2), round(wat + svc - disc, 2), round(units, 0), round(free, 0), cm) order by y, mm, br, ty, moo, src) from x),
  'cust_cols', json_build_array('y','br','ty','moo','n'),
  'cust', (select json_agg(json_build_array(y, br, ty, moo, n) order by y, br, ty, moo) from cust),
  'check', (select json_build_object('net', round(sum(wat + svc - disc), 2), 'units', round(sum(units), 0)) from x));
