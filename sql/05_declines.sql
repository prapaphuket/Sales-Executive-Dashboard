-- 05_declines : ลูกค้าที่ยอดขายลดลงมาก — 3 เดือนล่าสุดที่ครบเดือน เทียบช่วงเดียวกันปีก่อน
-- เกณฑ์: ปีก่อน >= 15,000 บาท (เฉลี่ย 5,000 บาท/เดือน) และลดลงอย่างน้อย 30% ; เรียงตามบาทที่ลดลง 20 อันดับ
with big as (select unnest(array[4, 2438, 1363]) cw),
p as (select date_trunc('month', $2::date)::date - interval '3 months' a1, date_trunc('month', $2::date)::date - interval '1 day' a2,
             date_trunc('month', $2::date)::date - interval '15 months' b1, date_trunc('month', $2::date)::date - interval '12 months' - interval '1 day' b2),
inv as (
  select distinct on (i.invoice_number, i.customer_water_id, i.issue_date, i.total, i.water_unit) i.*
  from record_invoices i, p where i.status <> 'cancelled' and (i.issue_date between p.a1 and p.a2 or i.issue_date between p.b1 and p.b2)
  order by i.invoice_number, i.customer_water_id, i.issue_date, i.total, i.water_unit, i.id),
s as (
  select i.customer_water_id cw, i.issue_date d, i.sum + i.sum_service - case when coalesce(i.discount, 0) = 0 or coalesce(i.total_before_discount, 0) = 0 then 0
         else i.discount * (i.sum + i.sum_service) / i.total_before_discount end net, i.water_unit units from inv i
  union all
  select f.customer_water_id, f.bill_date, f.subtotal::numeric, null from vw_dash_bill_invoice_fees f, p
  where f.status = 'active' and f.customer_water_id in (select cw from big) and f.invoice_number not like 'BL%'
    and (f.bill_date between p.a1 and p.a2 or f.bill_date between p.b1 and p.b2)
  union all
  select n.customer_water_id, n.issue_date, -(n.total - n.vat), null from vw_dash_credit_notes n, p
  where coalesce(n.status, '') <> 'cancelled' and (n.issue_date between p.a1 and p.a2 or n.issue_date between p.b1 and p.b2)),
agg as (select s.cw, coalesce(sum(net) filter (where d >= p.a1), 0) cur, coalesce(sum(net) filter (where d <= p.b2), 0) prev,
               coalesce(sum(units) filter (where d >= p.a1), 0) ucur, coalesce(sum(units) filter (where d <= p.b2), 0) uprev from s, p group by s.cw),
-- ชื่อ: ใบแจ้งหนี้ล่าสุด → ถ้ายังไม่เคยมีบิลใช้ชื่อในทะเบียน customer_waters.name (อ่านเฉพาะ id, name)
nm as (select w.id cw, coalesce(i.customer_name, nullif(trim(w.name), '')) customer_name from customer_waters w
       left join (select distinct on (customer_water_id) customer_water_id, customer_name from record_invoices where status <> 'cancelled' order by customer_water_id, issue_date desc, id desc) i on i.customer_water_id = w.id),
sel as (select * from agg where prev >= 15000 and cur <= prev * 0.7 order by prev - cur desc limit 20)
select json_build_object('ds', 'declines',
  'window', (select json_build_array(to_char(a1, 'YYYY-MM-DD'), to_char(a2, 'YYYY-MM-DD'), to_char(b1, 'YYYY-MM-DD'), to_char(b2, 'YYYY-MM-DD')) from p),
  'n_match', (select count(*) from agg where prev >= 15000 and cur <= prev * 0.7),
  'cols', json_build_array('cw','reg','name','br','ty','cur','prev','ucur','uprev','status'),
  'rows', (select json_agg(json_build_array(s.cw, c.registration_number,
            coalesce(nm.customer_name, '–'),
            coalesce(b.name, 'ไม่ระบุ'), coalesce(split_part(t.name, ' - ', 1), '?'), round(s.cur, 2), round(s.prev, 2), round(s.ucur, 0), round(s.uprev, 0), c.status)
            order by s.prev - s.cur desc)
           from sel s left join vw_dash_customer_waters c on c.id = s.cw left join customer_water_types t on t.id = c.type_id
           left join branches b on b.id = c.branch_id left join nm on nm.cw = s.cw));
