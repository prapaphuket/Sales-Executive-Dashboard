# สร้าง data/finance.json จาก GL ของ TRCLOUD (get_ledger อ่านอย่างเดียว) · ใช้: python scripts/finance_from_gl.py
# ไฟล์ CSV ต่อบัญชีอยู่ใน data/gl/gl_<acc_code>.csv (ไม่ขึ้น repo) คอลัมน์: transaction_id,date,ref_no,acc_code,dr,cr,create_by,formula,book_id,department,project,costcenter
import csv, json, glob, collections
ACC = [('5101002', 'ต้นทุน-ค่าบริการระบบผลิต', 'svc'), ('5101003', 'ต้นทุน-ค่าไฟฟ้า', 'power'), ('5101004', 'ต้นทุน-สารเคมี', 'chem'),
       ('5131000', 'ค่าซ่อมแซมและบำรุงรักษา-เครื่องจักรและอุปกรณ์', 'repair'), ('5131001', 'ค่าซ่อมแซมและบำรุงรักษา-เครื่องมือเครื่องใช้', 'repair'),
       ('5111001', 'ต้นทุนวัสดุสิ้นเปลืองและชิ้นส่วนอะไหล่', 'parts'), ('5305001', 'ค่าไฟฟ้า (สำนักงาน)', 'office_power')]
agg = collections.defaultdict(lambda: [0.0, 0]); first, last = '9', '0'
for code, _, _ in ACC:
    for r in csv.DictReader(open(f'data/gl/gl_{code}.csv', encoding='utf-8')):
        k = (code, r['date'][:7]); agg[k][0] += float(r['dr'] or 0) - float(r['cr'] or 0); agg[k][1] += 1
        first, last = min(first, r['date']), max(last, r['date'])
rows = [[c, m, round(v[0], 2), v[1]] for (c, m), v in sorted(agg.items())]
out = {'ds': 'finance', 'source': 'TRCLOUD (HEA) · get_ledger อ่านอย่างเดียว · ยอด = เดบิต − เครดิต', 'pulled': '2026-11-21', 'from': '2026-01-01', 'to': '2026-10-31',
       'first_line': first, 'last_line': last, 'status': 'ผลเบื้องต้นจาก GL ยังไม่ยืนยันการปิดงวด',
       'notes': ['GL ของบัญชีเหล่านี้เริ่ม ม.ค. 2569 — ไม่มีรายการปี 2568 จึงไม่เทียบปีก่อน',
                 'ม.ค.–ก.ค. 69 ของบัญชี 5101002/5101003/5101004 มาจากรายการปรับปรุงที่ลง 3 ก.ย. 69 (ย้ายจากต้นทุนขายสินค้า) ตั้งแต่ ส.ค. มาจากเอกสารค่าใช้จ่ายจริง',
                 'ค่าไฟฟ้าในทอน ม.ค.–เม.ย. ย้ายจาก 5305001 ไป 5101003 · เม.ย. มีรายการเครดิต 230,507.24 ใน 5101003 (JV2604300052)',
                 '5131001 ก.ย. มีเครดิต 13,423.32 ย้ายงานบริหารจัดการน้ำชั่วคราวไปเป็นสินทรัพย์ (JV2609300038)',
                 'ไม่รวมภาระผูกพันตาม PO และไม่ใช่งบกำไรขาดทุน'],
       'accounts': [{'code': c, 'name': n, 'grp': g} for c, n, g in ACC], 'rows': rows}
json.dump(out, open('data/finance.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
tot = collections.defaultdict(float)
for c, m, v, n in rows: tot[c] += v
print(first, last, {k: round(v, 2) for k, v in tot.items()})
