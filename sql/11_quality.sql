-- 11_quality : ตรวจคุณภาพข้อมูลที่กระทบยอด Dashboard ในช่วงข้อมูล
with r as (select * from record_invoices where issue_date between $1::date and $2::date),
dup as (select invoice_number, customer_water_id, issue_date, total, water_unit, count(*) n from r where status <> 'cancelled' group by 1, 2, 3, 4, 5 having count(*) > 1),
dupnum as (select invoice_number from r where status <> 'cancelled' group by 1 having count(distinct (customer_water_id, issue_date, total, water_unit)) > 1),
rb as (select * from record_bills where coalesce(payment_date, issue_date) between $1::date and $2::date)
select json_build_object('ds', 'quality', 'items', json_build_array(
  json_build_array('dup_identical', (select coalesce(sum(n - 1), 0) from dup), (select round(coalesce(sum((n - 1) * total), 0), 2) from dup)),
  json_build_array('dup_number_diff', (select count(*) from dupnum), null),
  json_build_array('inv_cancelled', (select count(*) from r where status = 'cancelled'), (select round(coalesce(sum(total), 0), 2) from r where status = 'cancelled')),
  json_build_array('inv_no_customer', (select count(*) from r where status <> 'cancelled' and customer_water_id is null), (select round(coalesce(sum(total), 0), 2) from r where status <> 'cancelled' and customer_water_id is null)),
  json_build_array('inv_no_type', (select count(*) from r left join vw_dash_customer_waters c on c.id = r.customer_water_id where r.status <> 'cancelled' and c.type_id is null), null),
  json_build_array('inv_branch_inactive', (select count(*) from r join branches b on b.id = r.branch_id where r.status <> 'cancelled' and b.status <> 'active'), (select round(coalesce(sum(r.total), 0), 2) from r join branches b on b.id = r.branch_id where r.status <> 'cancelled' and b.status <> 'active')),
  json_build_array('inv_zero_total_free', (select count(*) from r where status <> 'cancelled' and total = 0 and coalesce(discount, 0) > 0), (select round(coalesce(sum(discount), 0), 2) from r where status <> 'cancelled' and total = 0 and coalesce(discount, 0) > 0)),
  json_build_array('inv_negative', (select count(*) from r where status <> 'cancelled' and (total < 0 or water_unit < 0)), null),
  json_build_array('inv_units_gt_5000', (select count(*) from r where status <> 'cancelled' and water_unit > 5000), (select round(coalesce(sum(water_unit), 0), 0) from r where status <> 'cancelled' and water_unit > 5000)),
  json_build_array('paid_no_receipt', (select count(*) from r where status = 'paymented' and not exists (select 1 from record_bills b where b.record_invoice_id = r.id and b.status = 'paymented')),
                                      (select round(coalesce(sum(total), 0), 2) from r where status = 'paymented' and not exists (select 1 from record_bills b where b.record_invoice_id = r.id and b.status = 'paymented'))),
  json_build_array('paid_multi_receipt', (select count(*) from (select record_invoice_id from rb where status = 'paymented' group by 1 having count(*) > 1) z), null),
  json_build_array('receipt_ne_invoice', (select count(*) from rb join record_invoices i on i.id = rb.record_invoice_id where rb.status = 'paymented' and abs(rb.total - i.total) > 0.01), null),
  json_build_array('receipt_dup_number', (select count(*) from (select bill_number from rb where status = 'paymented' group by 1 having count(*) > 1) z), null),
  json_build_array('receipt_no_paydate', (select count(*) from rb where status = 'paymented' and payment_date is null), null),
  json_build_array('cn_test', (select count(*) from vw_dash_credit_notes where reason like '%ทดสอบ%' and coalesce(status, '') <> 'cancelled'), (select round(coalesce(sum(total), 0), 2) from vw_dash_credit_notes where reason like '%ทดสอบ%' and coalesce(status, '') <> 'cancelled')),
  json_build_array('receipt_zero_total', (select count(*) from rb where status = 'paymented' and total = 0), (select round(coalesce(sum(vat), 0), 2) from rb where status = 'paymented' and total = 0)),
  json_build_array('date_be_year', (select count(*) from record_invoices where issue_date > date '2400-01-01') + (select count(*) from record_bills where issue_date > date '2400-01-01' or payment_date > date '2400-01-01'), (select round(coalesce(sum(total), 0), 2) from record_bills where issue_date > date '2400-01-01' or payment_date > date '2400-01-01')),
  json_build_array('receipt_branch_ne_invoice', (select count(*) from rb join record_invoices i on i.id = rb.record_invoice_id where rb.status = 'paymented' and rb.branch_id is distinct from i.branch_id), null),
  json_build_array('fee_type_unknown', (select count(*) from vw_dash_bill_invoice_fees f left join vw_dash_customer_waters c on c.id = f.customer_water_id where f.status = 'active' and f.bill_date between $1::date and $2::date and c.type_id is null), null)
));
