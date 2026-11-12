-- 17_meter_stuck : มิเตอร์ที่จดได้เลขเดิมซ้ำ (ใช้ 0 ลบ.ม.) ติดต่อกันหลายรอบ — สำรวจมิเตอร์ไม่หมุน / น้ำสูญเสียเชิงพาณิชย์
-- ตารางต้นทาง: water_meter_records (1 รายการล่าสุดต่อทะเบียนต่อรอบ; รอบ = เดือนของ resp_date) · มีข้อมูลจดตั้งแต่ ส.ค. 2568
--   ใช้ 0 = sum_unit = 0 (เลขมาตรครั้งนี้ = ครั้งก่อน)
--   streak = จำนวนรอบล่าสุดที่ใช้ 0 ติดต่อกัน นับย้อนจากรอบล่าสุด (รอบที่ไม่มีการจด = ตัดสาย)
--   avg_before = ค่าเฉลี่ยหน่วยของรอบที่ใช้น้ำ (> 0) ไม่เกิน 6 รอบก่อนเริ่มใช้ 0
--   price = บาท/ลบ.ม. ของลูกค้ารายนั้น (ค่าน้ำ+บริการ ÷ หน่วย) จากใบแจ้งหนี้ที่มีหน่วย 12 เดือนล่าสุด
--   ชื่อ: ใบแจ้งหนี้ล่าสุด → ถ้ายังไม่เคยมีบิลใช้ customer_waters.name · วันติดตั้ง = water_meter_assignments.installed_at
-- ข้อมูลบอกได้แค่ "เลขไม่ขยับ" — มิเตอร์เสีย หรือไม่มีผู้ใช้น้ำ ต้องให้หน้างานยืนยัน
-- $1 = วันแรกของช่วงประวัติ, $2 = วันอ้างอิง
with rec as (
  select distinct on (customer_water_id, date_trunc('month', resp_date)) customer_water_id cw, date_trunc('month', resp_date)::date rnd,
         nullif(sum_unit, '')::numeric u, current_unit cu, record_date
  from water_meter_records
  where status <> 'cancelled' and resp_date >= $1::date and resp_date <= $2::date
  order by customer_water_id, date_trunc('month', resp_date), record_date desc),
cur as (select max(rnd) rnd from rec),
r as materialized (select rec.*, row_number() over (partition by rec.cw order by rec.rnd desc) rn,
             ((extract(year from cur.rnd) - extract(year from rec.rnd)) * 12 + extract(month from cur.rnd) - extract(month from rec.rnd))::int gap
      from rec, cur),
st as materialized (
  select cw, count(*) n_rounds,
         coalesce(min(rn) filter (where u is null or u > 0 or gap <> rn - 1) - 1, count(*)) streak,
         max(rnd) filter (where u > 0) last_use
  from r group by cw having max(gap) filter (where rn = 1) = 0),
cw as (select c.id, c.registration_number reg, c.status, c.branch_id, c.meter_reading_area_id area, split_part(t.name, ' - ', 1) ty
       from vw_dash_customer_waters c left join customer_water_types t on t.id = c.type_id),
sel as materialized (select st.cw, st.streak, st.n_rounds, st.last_use, max(r.cu) filter (where r.rn = 1) cu,
               round(avg(r.u) filter (where r.rn > st.streak and r.rn <= st.streak + 6 and r.u > 0), 1) avg_before
        from st join r on r.cw = st.cw where st.streak >= 3 group by st.cw, st.streak, st.n_rounds, st.last_use),
nm as materialized (select w.id cw, coalesce(i.customer_name, nullif(trim(w.name), '')) customer_name from customer_waters w
       left join (select distinct on (customer_water_id) customer_water_id, customer_name from record_invoices
                  where status <> 'cancelled' and customer_water_id in (select cw from sel) order by customer_water_id, issue_date desc, id desc) i on i.customer_water_id = w.id
       where w.id in (select cw from sel)),
price as (select customer_water_id cw, sum(sum + sum_service) / nullif(sum(water_unit), 0) p from record_invoices ri
          where status <> 'cancelled' and not exists (select 1 from vw_dash_credit_notes zr where zr.record_invoice_id = ri.id and coalesce(zr.status, '') <> 'cancelled' and zr.total >= ri.total - 0.01) and water_unit > 0 and issue_date > $2::date - interval '12 months' and customer_water_id in (select cw from sel) group by 1)
select json_build_object('ds', 'meter_stuck',
  'round', (select to_char(rnd, 'YYYY-MM-DD') from cur),
  'first_round', (select to_char(min(rnd), 'YYYY-MM-DD') from rec),
  'n_read', (select count(*) from st join cw on cw.id = st.cw and cw.status = 'active'),
  'cols', json_build_array('reg', 'name', 'br', 'ty', 'area', 'streak', 'since', 'last_use', 'avg_before', 'price', 'cu', 'inst', 'n_rounds'),
  'rows', (select json_agg(json_build_array(cw.reg, coalesce(nm.customer_name, '–'), coalesce(b.name, 'ไม่ระบุ'), coalesce(cw.ty, '?'), cw.area,
              s.streak, to_char((select rnd from cur) - make_interval(months => (s.streak - 1)::int), 'YYYY-MM-DD'), to_char(s.last_use, 'YYYY-MM-DD'),
              s.avg_before, round(pr.p, 2), s.cu,
              (select to_char(max(wa.installed_at), 'YYYY-MM-DD') from water_meter_assignments wa where wa.customer_water_id = s.cw and wa.action_type = 'install'),
              s.n_rounds) order by coalesce(s.avg_before, 0) * s.streak * coalesce(pr.p, 0) desc, s.streak desc, cw.reg)
           from sel s join cw on cw.id = s.cw and cw.status = 'active' left join nm on nm.cw = s.cw left join branches b on b.id = cw.branch_id left join price pr on pr.cw = s.cw));
