-- 09_debtors : ลูกหนี้เกินกำหนดรายใหญ่ 25 ราย ณ วันอ้างอิง + รายการใบแจ้งหนี้ค้าง (drill-down)
with cw as (select c.id, c.registration_number, c.personal_type, c.status, c.branch_id, split_part(t.name, ' - ', 1) ty from vw_dash_customer_waters c left join customer_water_types t on t.id = c.type_id),
pend as (select * from record_invoices where status = 'pending' and issue_date <= $2::date),
agg as (select customer_water_id cw, count(*) n, sum(total) ar, sum(total) filter (where due_date < $2::date) overdue, min(due_date) oldest,
               sum(total) filter (where $2::date - due_date between 1 and 30) b1, sum(total) filter (where $2::date - due_date between 31 and 60) b2,
               sum(total) filter (where $2::date - due_date between 61 and 90) b3, sum(total) filter (where $2::date - due_date > 90) b4
        from pend group by 1),
top as (select * from agg where overdue > 0 order by overdue desc limit 25),
nm as (select distinct on (customer_water_id) customer_water_id cw, customer_name from record_invoices where status <> 'cancelled' order by customer_water_id, issue_date desc, id desc)
select json_build_object('ds', 'debtors', 'asof', to_char($2::date, 'YYYY-MM-DD'),
  'n_overdue_cust', (select count(*) from agg where overdue > 0),
  'cols', json_build_array('cw','reg','name','br','ty','status','n','ar','overdue','oldest','b1','b2','b3','b4'),
  'rows', (select json_agg(json_build_array(t.cw, cw.registration_number,
            coalesce(nm.customer_name, '–'),
            coalesce(b.name, 'ไม่ระบุ'), coalesce(cw.ty, '?'), cw.status, t.n, round(t.ar, 2), round(t.overdue, 2), to_char(t.oldest, 'YYYY-MM-DD'),
            round(coalesce(t.b1, 0), 2), round(coalesce(t.b2, 0), 2), round(coalesce(t.b3, 0), 2), round(coalesce(t.b4, 0), 2)) order by t.overdue desc)
           from top t left join cw on cw.id = t.cw left join branches b on b.id = cw.branch_id left join nm on nm.cw = t.cw),
  'docs_cols', json_build_array('cw','doc','issue','due','days','amt','units'),
  'docs', (select json_agg(json_build_array(p.customer_water_id, p.invoice_number, to_char(p.issue_date, 'YYYY-MM-DD'), to_char(p.due_date, 'YYYY-MM-DD'),
            $2::date - p.due_date, round(p.total, 2), round(p.water_unit, 0)) order by p.customer_water_id, p.due_date)
           from pend p where p.customer_water_id in (select cw from top)));
