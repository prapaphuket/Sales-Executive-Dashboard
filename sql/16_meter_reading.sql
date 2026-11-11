-- 16_meter_reading : ความคืบหน้าการจดมาตรรายรอบ (หน้า "การจดมาตร")
-- ตารางต้นทาง: water_meter_records (รายการจดหน่วยน้ำ; resp_date = วันแรกของรอบ) + record_invoices.water_meter_record_id
-- นิยามตาม "แผงควบคุมงานอ่านมาตร" ของ WMS:
--   ทะเบียน   = ผู้ใช้น้ำสถานะ active (สถานะปัจจุบัน — ระบบไม่เก็บประวัติสถานะรายวัน)
--   อ่านแล้ว   = ทะเบียนข้างต้นที่มีรายการจดในรอบ (ไม่ยกเลิก) นับ 1 ครั้งต่อทะเบียน
--   ผิดปกติ   = meter_wrong_show 2 (เกิน 200% ของเฉลี่ย 3 เดือน) / 3 (ต่ำกว่า 20%)
--   หน่วยผิดปกติ 20 รายแรก เรียงตามผลต่างจากค่าเฉลี่ย 3 เดือน (ลบ.ม.) มากไปน้อย
--   ชื่อพื้นที่ = meter_reading_areas.title
-- $1 = วันแรกของช่วงประวัติ, $2 = วันอ้างอิง
with rec as (
  select r.*, date_trunc('month', r.resp_date)::date rnd
  from water_meter_records r
  where r.status <> 'cancelled' and r.resp_date >= $1::date and r.resp_date <= $2::date
),
cur as (select max(rnd) rnd from rec),
cw as (select c.id, c.registration_number reg, c.personal_type, c.status, c.branch_id, c.meter_reading_area_id area, split_part(t.name, ' - ', 1) ty
       from vw_dash_customer_waters c left join customer_water_types t on t.id = c.type_id),
-- ชื่อ: ใบแจ้งหนี้ล่าสุด → ถ้ายังไม่เคยมีบิลใช้ชื่อในทะเบียน customer_waters.name (อ่านเฉพาะ id, name)
nm as (select w.id cw, coalesce(i.customer_name, nullif(trim(w.name), '')) customer_name from customer_waters w
       left join (select distinct on (customer_water_id) customer_water_id, customer_name from record_invoices where status <> 'cancelled' order by customer_water_id, issue_date desc, id desc) i on i.customer_water_id = w.id),
-- ชื่อพนักงาน: ตัดคำนำหน้า แสดงชื่อ + อักษรแรกของนามสกุล (ข้อมูลภายใน ใช้เท่าที่จำเป็น)
staff as (select distinct on (user_id) user_id, regexp_replace(regexp_replace(coalesce(user_name, ''), '^(นาย|นางสาว|นาง)\s*', ''), '^(\S+)\s+(\S).*$', '\1 \2.') sn
          from water_meter_records where user_id is not null order by user_id, created_at desc),
rd as (select distinct on (customer_water_id) * from rec where rnd = (select rnd from cur) order by customer_water_id, record_date desc),
inv as (select id, water_meter_record_id wid from record_invoices
        where status <> 'cancelled' and issue_date >= (select rnd from cur) and issue_date < ((select rnd from cur) + interval '1 month')),
-- พนักงานที่จดทะเบียนนั้นในรอบก่อน (ใช้เป็นผู้รับผิดชอบรายที่ยังค้าง)
prev_rd as (select distinct on (customer_water_id) customer_water_id, user_id from rec
            where rnd < (select rnd from cur) order by customer_water_id, record_date desc)
select json_build_object(
  'round', (select to_char(rnd, 'YYYY-MM-DD') from cur),
  'summary', (select json_build_object(
      'reg', count(*) filter (where cw.status = 'active'),
      'read', count(rd.id) filter (where cw.status = 'active'),
      'read_inactive', count(rd.id) filter (where cw.status <> 'active'),
      'cut', count(*) filter (where cw.status = 'disconnected'),
      'wrong', count(rd.id) filter (where rd.meter_wrong_show in ('2', '3')),
      'wrong_hi', count(rd.id) filter (where rd.meter_wrong_show = '2'),
      'wrong_lo', count(rd.id) filter (where rd.meter_wrong_show = '3'),
      'inv', (select count(*) from inv),
      'inv_from_read', (select count(*) from inv where wid in (select id from rd)),
      'inv_no_read', (select count(*) from inv where wid is null or wid not in (select id from rd)),
      'read_no_inv', (select count(*) from rd where id not in (select wid from inv where wid is not null)),
      'first_read', (select to_char(min(record_date), 'YYYY-MM-DD') from rd),
      'last_read', (select to_char(max(record_date), 'YYYY-MM-DD') from rd))
    from cw left join rd on rd.customer_water_id = cw.id),
  'rounds', (select json_agg(json_build_array(to_char(rnd, 'YYYY-MM-DD'), n, w, to_char(d0, 'YYYY-MM-DD'), to_char(d1, 'YYYY-MM-DD')) order by rnd)
             from (select rnd, count(distinct customer_water_id) n, count(distinct customer_water_id) filter (where meter_wrong_show in ('2','3')) w,
                          min(record_date) d0, max(record_date) d1 from rec group by rnd) x),
  'daily_cols', json_build_array('d', 'n'),
  'daily', (select json_agg(json_build_array(to_char(d, 'YYYY-MM-DD'), n) order by d)
            from (select record_date::date d, count(*) n from rd join cw on cw.id = rd.customer_water_id and cw.status = 'active' group by 1) x),
  -- inst = วันติดตั้งมาตรล่าสุด (water_meter_assignments.installed_at, action_type = install) · regd = วันลงทะเบียน
  -- binv = ใบแจ้งหนี้ค่าน้ำที่ออกในเดือนของรอบ (ไม่ยกเลิก; รวมแบบฟอร์มลูกค้าสัญญาใน bill_invoice_fees) แม้ไม่มีรายการจด
  -- ncx / lcx = จำนวนและวันที่ล่าสุดของใบแจ้งหนี้ที่ถูกยกเลิก
  'pending_cols', json_build_array('reg', 'name', 'br', 'ty', 'area', 'staff', 'last', 'inst', 'regd', 'binv', 'ncx', 'lcx'),
  'pending', (select json_agg(json_build_array(cw.reg,
                coalesce(nm.customer_name, '–'),
                coalesce(b.name, 'ไม่ระบุ'), coalesce(cw.ty, '?'), cw.area, s.sn,
                (select to_char(max(record_date), 'YYYY-MM-DD') from water_meter_records x where x.customer_water_id = cw.id and x.status <> 'cancelled'),
                (select to_char(max(wa.installed_at), 'YYYY-MM-DD') from water_meter_assignments wa where wa.customer_water_id = cw.id and wa.action_type = 'install'),
                (select to_char(v.created_at, 'YYYY-MM-DD') from vw_dash_customer_waters v where v.id = cw.id),
                (select to_char(max(z.d), 'YYYY-MM-DD') from (select i.issue_date d from record_invoices i, cur where i.customer_water_id = cw.id and i.status <> 'cancelled' and date_trunc('month', i.issue_date) = cur.rnd
                   union all select f.bill_date from bill_invoice_fees f, cur where f.customer_water_id = cw.id and f.status = 'active' and f.invoice_number not like 'BL%' and date_trunc('month', f.bill_date) = cur.rnd) z),
                (select count(*) from record_invoices i where i.customer_water_id = cw.id and i.status = 'cancelled'),
                (select to_char(max(i.issue_date), 'YYYY-MM-DD') from record_invoices i where i.customer_water_id = cw.id and i.status = 'cancelled')) order by cw.reg)
              from cw left join rd on rd.customer_water_id = cw.id left join nm on nm.cw = cw.id left join branches b on b.id = cw.branch_id
                   left join prev_rd p on p.customer_water_id = cw.id left join staff s on s.user_id = p.user_id
              where cw.status = 'active' and rd.id is null),
  'areas_cols', json_build_array('area', 'br', 'all', 'read', 'cut', 'inv'),
  'areas', (select json_agg(json_build_array(area, br, n_all, n_read, n_cut, n_inv) order by (n_all - n_read) desc, area)
            -- ทั้งหมด = ทะเบียนใช้งาน + ทะเบียนที่จดในรอบแล้วถูกงดจ่ายน้ำภายหลัง · ถูกตัดมาตร = งดจ่ายน้ำที่ไม่ได้จดในรอบ (ปรับ 11/11/69 ให้ตรงกับการ์ดหลัก)
            from (select cw.area, min(b.name) br, count(*) filter (where cw.status = 'active' or rd.id is not null) n_all,
                         count(rd.id) n_read, count(*) filter (where cw.status = 'disconnected' and rd.id is null) n_cut,
                         count(rd.id) filter (where rd.id in (select wid from inv)) n_inv
                  from cw left join rd on rd.customer_water_id = cw.id left join branches b on b.id = cw.branch_id
                  where cw.status in ('active', 'disconnected') group by cw.area) x where n_all > 0),
  -- ชื่อพื้นที่การอ่านมาตร (ต้อง GRANT SELECT ON meter_reading_areas TO mcp_reader — migrations/002)
  'area_names', (select json_object_agg(id, trim(title)) from meter_reading_areas where deleted_at is null),
  -- gps = รายการจดที่มีพิกัด (จดผ่านเครื่องโมบายหน้างาน) · ไม่มีพิกัด = คีย์จากสำนักงาน/เคาน์เตอร์ (ตรวจ 11/11/69)
  'staff_cols', json_build_array('staff', 'areas', 'assigned', 'read', 'gps'),
  'staff', (select json_agg(json_build_array(sn, areas, assigned, nread, ngps) order by nread desc)
            from (select s.sn, count(distinct cw.area) areas,
                         count(distinct p.customer_water_id) filter (where cw.status = 'active') assigned,
                         (select count(*) from rd where rd.user_id = s.user_id) nread,
                         (select count(*) from rd where rd.user_id = s.user_id and nullif(trim(rd.lat), '') is not null and rd.lat <> '0') ngps
                  from staff s join prev_rd p on p.user_id = s.user_id join cw on cw.id = p.customer_water_id
                  group by s.user_id, s.sn) x where nread > 0 or assigned > 0),
  'wrong_cols', json_build_array('reg', 'name', 'ty', 'date', 'prev', 'cur', 'units', 'avg3', 'pct'),
  'wrong', (select json_agg(json_build_array(reg, name, ty, d, pu, cu, su, avg3, pct) order by sev desc)
            from (select cw.reg,
                         coalesce(nm.customer_name, '–') name,
                         cw.ty, to_char(rd.record_date, 'YYYY-MM-DD') d, rd.previous_unit pu, rd.current_unit cu, rd.sum_unit su,
                         case when rd.meter_wrong_show_percent > 0 then round(nullif(rd.sum_unit, '')::numeric * 100 / rd.meter_wrong_show_percent, 0) end avg3,
                         rd.meter_wrong_show_percent pct,
                         abs(nullif(rd.sum_unit, '')::numeric - coalesce(nullif(rd.sum_unit, '')::numeric * 100 / nullif(rd.meter_wrong_show_percent, 0), nullif(rd.sum_unit, '')::numeric)) sev
                  from rd join cw on cw.id = rd.customer_water_id left join nm on nm.cw = cw.id
                  where rd.meter_wrong_show in ('2', '3')
                  order by sev desc limit 20) x)
) as data;
