-- 19_reg_moo : หมู่และตำบลที่ตั้งมาตรรายทะเบียน — ใช้แสดง "หมู่ · ตำบล" ในตารางรายทะเบียน (หน้าจดมาตร ฯลฯ)
-- หมู่: สูตรเดียวกับ 02/13/18 (ทะเบียน → รายที่ยืนยัน → ที่อยู่ใบแจ้งหนี้ → เลขหมู่ในชื่อพื้นที่จดมาตร → ทำเนียบหมู่บ้าน)
-- ตำบล: ตำบลในทะเบียนถ้าเป็นไม้ขาว/สาคู ไม่งั้นใช้สาขาของทะเบียน (สาขา = ตำบล)
-- ผลลัพธ์: map { ทะเบียน: "เลขหมู่|ตำบล" } (เลขหมู่ว่าง = ไม่ระบุ)
with addr as (select distinct on (customer_water_id) customer_water_id cw, customer_address a from record_invoices
              where status <> 'cancelled' and customer_water_id is not null order by customer_water_id, issue_date desc, id desc),
x as (
  select wt.registration_number reg,
         case when wt.sub_district in ('ไม้ขาว', 'ใม้ขาว', 'สาคู', 'สาคุ') and wt.moo ~ '^\s*\d{1,2}\s*$' then trim(wt.moo)::int::text
              when wt.registration_number = 'AR00C-02708' then '3'
              when m.moo is not null and (m.tb is null or m.tb in ('ไม้ขาว', 'ใม้ขาว', 'สาคู', 'สาคุ')) then m.moo::int::text
              when ar.title ~ 'หมู่\s*\d' then substring(ar.title from 'หมู่\s*(\d{1,2})')::int::text
              when ar.title ~ 'ในทอน' then '4' when ar.title ~ 'บางม่าเหลา' then '5' when ar.title ~ 'บ้านสาคู' then '3'
              when ar.title ~ 'หมากปรก' then '1' when ar.title ~ 'คอเอน' then '2' when ar.title ~ 'สวนมะพร้าว' then '3'
              when ar.title ~ 'บ้านไม้ขาว' then '4' when ar.title ~ 'ท่าฉัตรไชย' then '5' when ar.title ~ 'บ่อไทร' then '6' when ar.title ~ 'บ้านหยิด' then '7'
              else '' end moo,
         case when wt.sub_district in ('ไม้ขาว', 'ใม้ขาว') then 'ไม้ขาว' when wt.sub_district in ('สาคู', 'สาคุ') then 'สาคู' else coalesce(b.name, '') end tb
  from customer_waters wt
  left join branches b on b.id = wt.branch_id
  left join meter_reading_areas ar on ar.id = wt.meter_reading_area_id
  left join lateral (select substring(x.a from '(?:หมู่ที่|หมู่|ม\.)\s*(\d{1,2})') moo, substring(x.a from '(?:ตำบล|ต\.)\s*([ก-๙]+)') tb from addr x where x.cw = wt.id) m on true
  where wt.registration_number is not null)
select json_build_object('ds', 'reg_moo', 'map', (select json_object_agg(reg, moo || '|' || tb) from x));
