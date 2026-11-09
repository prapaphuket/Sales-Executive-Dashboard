-- 12_meta : วันที่ล่าสุดของข้อมูลในฐาน (แยกจากเวลาที่ Dashboard ดึงข้อมูล)
select json_build_object('ds', 'meta',
  'invoice_last_issue', (select to_char(max(issue_date), 'YYYY-MM-DD') from record_invoices where issue_date <= current_date),
  'invoice_last_created', (select to_char(max(created_at), 'YYYY-MM-DD HH24:MI') from record_invoices),
  'receipt_last', (select to_char(max(coalesce(payment_date, issue_date)), 'YYYY-MM-DD') from record_bills where coalesce(payment_date, issue_date) <= current_date),
  'receipt_last_created', (select to_char(max(created_at), 'YYYY-MM-DD HH24:MI') from record_bills),
  'fee_last', (select to_char(max(bill_date), 'YYYY-MM-DD') from bill_fees where bill_date <= current_date),
  'bad_future_dates', (select count(*) from record_invoices where issue_date > current_date) + (select count(*) from record_bills where issue_date > current_date),
  'db_now', to_char(now(), 'YYYY-MM-DD HH24:MI'));
