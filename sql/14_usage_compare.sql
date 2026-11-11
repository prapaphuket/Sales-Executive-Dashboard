-- 14_usage_compare : การใช้น้ำ (ลบ.ม.) 4 เดือนเต็มล่าสุด เทียบช่วงเดียวกันปีก่อน รายผู้ใช้น้ำ (ลูกค้าทั่วไป ไม่รวม กปภ./ทอท./หอถัง อบต.)
-- + ปริมาณน้ำรายเดือนของลูกค้าเดิม (มีบิลก่อนปีนี้) + ตรวจทะเบียนเทียบการออกบิล
-- $2::date = วันอ้างอิง ($1 รับไว้ให้รูปแบบเดียวกับไฟล์อื่น)
with p as (select (date_trunc('month', $2::date) - interval '1 day')::date e1, $1::date dummy),
w as (select (date_trunc('month', e1) - interval '3 months')::date s1, e1, (date_trunc('month', e1) - interval '15 months')::date s0, (e1 - interval '1 year')::date e0,
             date_trunc('year', e1)::date ys, (date_trunc('year', e1) - interval '1 year')::date ys0 from p),
cw as (select c.id, c.registration_number reg, c.status, c.personal_type, c.branch_id, split_part(t.name, ' - ', 1) ty
       from vw_dash_customer_waters c left join customer_water_types t on t.id = c.type_id),
gen as (select * from cw where coalesce(ty, '?') not in ('T2.2', 'T3.1')),   -- หอถัง อบต. (T2.3) นับเป็นลูกค้าทั่วไป (11/11/69)
first_bill as (select customer_water_id cw, min(issue_date) fb, max(issue_date) lb from record_invoices where status <> 'cancelled' group by 1),
inv as (select distinct on (i.invoice_number, i.customer_water_id, i.issue_date, i.total, i.water_unit) i.*
        from record_invoices i, w where i.status <> 'cancelled' and i.issue_date between w.ys0 and w.e1
        order by i.invoice_number, i.customer_water_id, i.issue_date, i.total, i.water_unit, i.id),
q as (select g.id, g.reg, g.branch_id, g.ty, g.status, g.personal_type,
             coalesce(sum(i.water_unit) filter (where i.issue_date between w.s1 and w.e1), 0) q1,
             coalesce(sum(i.water_unit) filter (where i.issue_date between w.s0 and w.e0), 0) q0
      from gen g cross join w left join inv i on i.customer_water_id = g.id group by 1, 2, 3, 4, 5, 6),
cls as (select q.*, case when q0 = 0 and q1 = 0 then null when q0 = 0 then 'new' when q1 = 0 then 'stop'
                         when q1 >= q0 * 1.1 then 'up' when q1 <= q0 * 0.9 then 'down' else 'flat' end k from q),
-- ชื่อ: ใบแจ้งหนี้ล่าสุด → ถ้ายังไม่เคยมีบิลใช้ชื่อในทะเบียน customer_waters.name (อ่านเฉพาะ id, name)
nm as (select w.id cw, coalesce(i.customer_name, nullif(trim(w.name), '')) customer_name from customer_waters w
       left join (select distinct on (customer_water_id) customer_water_id, customer_name from record_invoices where status <> 'cancelled' order by customer_water_id, issue_date desc, id desc) i on i.customer_water_id = w.id),
monthly as (
  select to_char(i.issue_date, 'YYYY-MM') m, coalesce(b.name, 'ไม่ระบุ') br,
         sum(i.water_unit) filter (where coalesce(g.ty, '?') not in ('T2.2', 'T3.1') and fb.fb < w.ys) q_exist,
         sum(i.water_unit) filter (where coalesce(g.ty, '?') <> 'T2.2') q_excl_pwa,
         sum(i.water_unit) q_all
  from inv i cross join w left join cw g on g.id = i.customer_water_id left join first_bill fb on fb.cw = i.customer_water_id left join branches b on b.id = i.branch_id
  group by 1, 2),
audit as (
  select c.reg, c.branch_id, c.status, c.ty, c.personal_type, c.id, fb.lb,
         case when c.status = 'active' and (fb.lb is null or fb.lb < (date_trunc('month', w.e1) - interval '1 month')::date) then 'active_no_bill'
              when c.status in ('closed', 'disconnected') and fb.lb >= date_trunc('month', w.e1)::date then 'inactive_billed'
              when c.status = 'pending_install' and fb.lb is not null then 'pending_billed' end issue
  from cw c cross join w left join first_bill fb on fb.cw = c.id)
select json_build_object('ds', 'usage_compare',
  'window', (select json_build_array(to_char(s1, 'YYYY-MM-DD'), to_char(e1, 'YYYY-MM-DD'), to_char(s0, 'YYYY-MM-DD'), to_char(e0, 'YYYY-MM-DD')) from w),
  'status_cols', json_build_array('br', 'k', 'n', 'q0', 'q1'),
  'status', (select json_agg(json_build_array(coalesce(b.name, 'ไม่ระบุ'), k, n, q0, q1) order by b.name, k) from
             (select branch_id, k, count(*) n, round(sum(q0)) q0, round(sum(q1)) q1 from cls where k is not null group by 1, 2) s left join branches b on b.id = s.branch_id),
  'decl_cols', json_build_array('reg', 'name', 'br', 'ty', 'q0', 'q1'),
  'decl', (select json_agg(json_build_array(d.reg, coalesce(nm.customer_name, '–'), coalesce(b.name, 'ไม่ระบุ'), coalesce(d.ty, '?'), round(d.q0), round(d.q1)) order by d.q1 - d.q0)
           from (select * from cls where k in ('down', 'stop') order by q1 - q0 limit 20) d left join nm on nm.cw = d.id left join branches b on b.id = d.branch_id),
  'monthly_cols', json_build_array('m', 'br', 'q_exist', 'q_excl_pwa', 'q_all'),
  'monthly', (select json_agg(json_build_array(m, br, round(q_exist), round(q_excl_pwa), round(q_all)) order by m, br) from monthly),
  'audit_cols', json_build_array('reg', 'name', 'br', 'status', 'ty', 'last_bill', 'issue', 'inst'),
  'audit', (select json_agg(json_build_array(a.reg, coalesce(nm.customer_name, '–'), coalesce(b.name, 'ไม่ระบุ'), a.status, coalesce(a.ty, '?'), to_char(a.lb, 'YYYY-MM-DD'), a.issue,
              (select to_char(max(wa.installed_at), 'YYYY-MM-DD') from water_meter_assignments wa where wa.customer_water_id = a.id and wa.action_type = 'install')) order by a.issue, b.name, a.reg)
            from audit a left join nm on nm.cw = a.id left join branches b on b.id = a.branch_id where a.issue is not null and b.status = 'active'));
