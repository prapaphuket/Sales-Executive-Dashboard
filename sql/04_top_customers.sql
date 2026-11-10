-- 04_top_customers : ลูกค้าตามยอดขายสุทธิ 12 เดือนล่าสุดที่ครบเดือน เทียบ 12 เดือนก่อนหน้า + หนี้เกินกำหนด ณ วันอ้างอิง
-- ชื่อลูกค้าแสดงเต็ม (ลูกค้ายินยอมเปิดเผยชื่อตอนสมัครใช้น้ำ) · ไม่แสดงเลขบัตร โทร ที่อยู่
with big as (select unnest(array[4, 2438, 1363]) cw),
p as (select date_trunc('month', $2::date)::date - interval '12 months' a1, date_trunc('month', $2::date)::date - interval '1 day' a2,
             date_trunc('month', $2::date)::date - interval '24 months' b1, date_trunc('month', $2::date)::date - interval '12 months' - interval '1 day' b2),
inv as (
  select distinct on (i.invoice_number, i.customer_water_id, i.issue_date, i.total, i.water_unit) i.*
  from record_invoices i, p where i.status <> 'cancelled' and i.issue_date between p.b1 and p.a2
  order by i.invoice_number, i.customer_water_id, i.issue_date, i.total, i.water_unit, i.id),
s as (
  select i.customer_water_id cw, i.issue_date d, i.sum + i.sum_service - case when coalesce(i.discount, 0) = 0 or coalesce(i.total_before_discount, 0) = 0 then 0
         else i.discount * (i.sum + i.sum_service) / i.total_before_discount end net, i.water_unit units, i.customer_name nm from inv i
  union all
  select f.customer_water_id, f.bill_date, f.subtotal::numeric, null, null from vw_dash_bill_invoice_fees f, p
  where f.status = 'active' and f.customer_water_id in (select cw from big) and f.invoice_number not like 'BL%' and f.bill_date between p.b1 and p.a2
  union all
  select n.customer_water_id, n.issue_date, -(n.total - n.vat), null, null from vw_dash_credit_notes n, p
  where coalesce(n.status, '') <> 'cancelled' and n.issue_date between p.b1 and p.a2),
nm as (select distinct on (customer_water_id) customer_water_id cw, customer_name from record_invoices where status <> 'cancelled' order by customer_water_id, issue_date desc, id desc),
agg as (
  select s.cw, sum(net) filter (where d >= p.a1) net, sum(net) filter (where d < p.a1) prev, sum(units) filter (where d >= p.a1) units
  from s, p group by s.cw),
ar as (select customer_water_id cw, sum(total) ar, sum(total) filter (where due_date < $2::date) overdue from record_invoices where status = 'pending' and issue_date <= $2::date group by 1),
tot as (select sum(net) total_net, count(*) filter (where net > 0) n_cust from agg),
ranked as (select agg.*, row_number() over (order by net desc nulls last) rk from agg)
select json_build_object('ds', 'top_customers',
  'window', (select json_build_array(to_char(a1, 'YYYY-MM-DD'), to_char(a2, 'YYYY-MM-DD'), to_char(b1, 'YYYY-MM-DD'), to_char(b2, 'YYYY-MM-DD')) from p),
  'total_net', (select round(total_net, 2) from tot), 'n_cust', (select n_cust from tot),
  'top10_net', (select round(sum(net), 2) from ranked where rk <= 10), 'top20_net', (select round(sum(net), 2) from ranked where rk <= 20),
  'cols', json_build_array('rk','cw','reg','name','br','ty','net','prev','units','ar','overdue','status'),
  'rows', (select json_agg(json_build_array(r.rk, r.cw, c.registration_number,
            coalesce(nm.customer_name, '–'),
            coalesce(b.name, 'ไม่ระบุ'), coalesce(split_part(t.name, ' - ', 1), '?'), round(r.net, 2), round(r.prev, 2), round(r.units, 0),
            round(coalesce(ar.ar, 0), 2), round(coalesce(ar.overdue, 0), 2), c.status) order by r.rk)
           from ranked r left join vw_dash_customer_waters c on c.id = r.cw left join customer_water_types t on t.id = c.type_id
           left join branches b on b.id = c.branch_id left join nm on nm.cw = r.cw left join ar on ar.cw = r.cw where r.rk <= 15));
