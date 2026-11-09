-- 15_pipeline : คำร้องขอติดตั้งมิเตอร์น้ำ (ลูกค้าใหม่ที่รอเข้าระบบ) แยกสถานะ x สาขา x ประเภทที่ขอ พร้อมอายุคำร้อง ณ วันอ้างอิง
-- $1 รับไว้ให้รูปแบบเดียวกับไฟล์อื่น, $2::date = วันอ้างอิง
with r as (select r.status, coalesce(r.branch, 'ไม่ระบุ') br, coalesce(r.wmi_customer_type_key, '?') k, r.request_date d, r.completed_at
           from vw_dash_requests r join request_types t on t.id = r.request_type_id
           where t.name = 'คำร้องขอติดตั้งมิเตอร์น้ำ' and r.request_date <= $2::date and r.request_date >= $1::date)
select json_build_object('ds', 'pipeline',
  'cols', json_build_array('status', 'br', 'k', 'n', 'avg_age', 'over60'),
  'rows', (select json_agg(json_build_array(status, br, k, n, avg_age, over60) order by status, br, k) from
           (select status, br, k, count(*) n, round(avg($2::date - d)) avg_age, count(*) filter (where $2::date - d > 60) over60 from r group by 1, 2, 3) x),
  'done_cols', json_build_array('m', 'n', 'avg_days'),
  'done', (select json_agg(json_build_array(m, n, avg_days) order by m) from
           (select to_char(completed_at, 'YYYY-MM') m, count(*) n, round(avg(completed_at::date - d)) avg_days from r where status = 'completed' and completed_at is not null group by 1) y));
