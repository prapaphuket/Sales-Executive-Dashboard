# ตรวจความสอดคล้องของตัวเลขใน snapshot: python3 scripts/validate.py > docs/validation_results.md
import json, collections, os
D = lambda n: json.load(open(os.path.join(os.path.dirname(__file__), '..', 'data', n + '.json')))
R = lambda d, k='rows', c='cols': [dict(zip(d[c], r)) for r in d[k]]
out = []; ok_all = True
def chk(name, a, b, tol=0.05, note=''):
    global ok_all
    ok = abs((a or 0) - (b or 0)) <= tol
    ok_all &= ok
    out.append(f"| {'✅' if ok else '❌'} | {name} | {a:,.2f} | {b:,.2f} | {a-b:,.2f} | {note} |")
out.append('# ผลการตรวจสอบตัวเลข (Validation)\n')
out.append('ข้อมูล: snapshot วันอ้างอิง 2026-11-03 (ช่วง 2024-11-01 ถึง 2026-11-03) · สคริปต์ `scripts/validate.py`\n')
out.append('| ผล | รายการตรวจ | ค่า A | ค่า B | ส่วนต่าง | หมายเหตุ |\n|---|---|---:|---:|---:|---|')
s = D('sales_cube'); sr = R(s)
tot = sum(r['net'] for r in sr)
chk('ยอดขายสุทธิ: ผลรวมแถว vs ยอดรวมจาก SQL', tot, s['check']['net'], 0.05, 'ปัดเศษรายแถว')
by = lambda k: sum(collections.Counter({}).values()) 
for k in ['br', 'ty', 'src']:
    g = collections.defaultdict(float)
    for r in sr: g[r[k]] += r['net']
    chk(f'ยอดขาย: ผลรวมตาม {k} = ยอดรวม', sum(g.values()), tot, 0.01)
chk('หน่วยน้ำ: ผลรวมแถว vs SQL', sum(r['units'] or 0 for r in sr), s['check']['units'], 0)
sep = [r for r in sr if r['m'] == '2026-09' and r['src'] == 'W']
chk('ก.ย. 69 หน่วยน้ำ (ใบแจ้งหนี้ค่าน้ำ) vs ผลตรวจรับงวด 3', sum(r['units'] for r in sep), 227085, 0, 'ตรงกับรายงานมาตรฐาน')
inc = sum(r['net'] + r['vat'] for r in sep)
disc = sum(r['disc'] for r in sep)
chk('ก.ย. 69 ยอดรวม VAT (net+vat) vs ยอดใบแจ้งหนี้ตามรายงาน', inc, 4465411.00, 1000, f'ต่างเพราะ WMS-307: ส่วนลดในใบแจ้งหนี้รวม VAT แต่ VAT ไม่ถูกลด (ส่วนลดไม่รวม VAT ก.ย. = {disc:,.2f})')
dm = D('dma_monthly')
wnet = sum(r['net'] for r in sr if r['src'] == 'W')
chk('ยอดค่าน้ำตาม DMA = ยอดใบแจ้งหนี้ค่าน้ำ (W)', sum(r[3] for r in dm['rows']), wnet, 0.5)
chk('หน่วยน้ำตาม DMA = หน่วยรวม', sum(r[4] for r in dm['rows']), s['check']['units'], 1, 'หน่วยมีทศนิยม ปัดรายแถว')
co = D('collections')
chk('ยอดรับชำระ: ผลรวมแถว vs SQL', sum(r[5] for r in co['rows']), co['check']['amt'], 0.05)
ar = D('ar'); arr = R(ar)
chk('ลูกหนี้: ผลรวมช่วงอายุ vs ยอดคงค้างรวม', sum(r['amt'] for r in arr), ar['check']['amt'], 0.05, 'ช่วงอายุไม่ซ้อนกัน')
chk('ลูกหนี้: จำนวนใบรวม', sum(r['n'] for r in arr), ar['check']['n'], 0)
db = D('debtors'); dr = R(db); docs = R(db, 'docs', 'docs_cols')
for r in dr[:3]:
    chk(f"ลูกหนี้ {r['reg']}: ผลรวมใบค้าง (drill-down) vs ยอดคงค้าง", sum(x['amt'] for x in docs if x['cw'] == r['cw']), r['ar'], 0.05)
    chk(f"ลูกหนี้ {r['reg']}: ผลรวมช่วงอายุ 1–4 vs เกินกำหนด", r['b1'] + r['b2'] + r['b3'] + r['b4'], r['overdue'], 0.05)
tc = D('top_customers'); tr = R(tc); dt = R(D('drill_top'))
for r in tr[:15]:
    chk(f"ลูกค้า #{r['rk']} {r['reg']}: เอกสาร drill-down vs ยอด 12 เดือน", sum(x['net'] for x in dt if x['cw'] == r['cw']), r['net'], 0.5)
tw = tc['window']
m12 = [r for r in sr if tw[0][:7] <= r['m'] <= tw[1][:7]]
chk('ยอดขาย 12 เดือนที่ใช้จัดอันดับลูกค้า vs sales_cube ช่วงเดียวกัน (ไม่รวมงานขาย F)', tc['total_net'], sum(r['net'] for r in m12 if r['src'] != 'F'), 1.0, f"การจัดอันดับลูกค้าใช้ค่าน้ำ+บริการ−ส่วนลด−ใบลดหนี้ ไม่รวมงานขาย F {sum(r['net'] for r in m12 if r['src']=='F'):,.2f} บาท")
ch = D('cohort'); cr = R(ch)
wv = sum(r['net'] + r['vat'] for r in sr if r['src'] == 'W' and r['m'] >= '2026-03')
chk('รุ่นใบแจ้งหนี้ (มี.ค.–พ.ย. 69): ยอดแจ้งหนี้ cohort vs net+vat ของ W', sum(r['billed'] for r in cr), wv, 20000, 'ต่างจาก WMS-307 (VAT ส่วนลด) ซึ่งเป็นยอดเล็ก')
out.append('\n**สรุป:** ' + ('ผ่านทุกข้อ' if ok_all else 'มีข้อไม่ผ่าน ดูรายการ ❌'))
# contrast
def lum(h):
    h = h.lstrip('#'); c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
def cr_(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True); return (la + 0.05) / (lb + 0.05)
out.append('\n## Contrast (WCAG 2.1)\n\n| คู่สี | การใช้งาน | อัตราส่วน | เกณฑ์ | ผล |\n|---|---|---:|---|---|')
pairs = [
 ('#1C1C1E', '#FFFFFF', 'ข้อความหลักบนการ์ด', 4.5), ('#1C1C1E', '#F7F9FB', 'ข้อความบนพื้นหน้าจอ', 4.5), ('#4A5160', '#FFFFFF', 'ข้อความรอง', 4.5), ('#5F6675', '#FFFFFF', 'คำอธิบายประกอบ', 4.5),
 ('#2A3D7A', '#FFFFFF', 'หัวข้อ Deep Navy', 4.5), ('#FFFFFF', '#3C549A', 'เมนูขาวบน Navy', 4.5), ('#FFFFFF', '#2A3D7A', 'เมนูที่เลือก', 4.5), ('#E8EEF8', '#3C549A', 'ชื่อบริษัทท้ายเมนู', 4.5),
 ('#2A3D7A', '#C1E7F2', 'ข้อความบน Aqua (การ์ดเป้า/ตัวกรองที่เลือก)', 4.5), ('#1C1C1E', '#C1E7F2', 'ค่าในตัวกรองที่เลือก', 4.5), ('#3C549A', '#FFFFFF', 'ปุ่มรอง/ลิงก์ Navy', 4.5), ('#2A3D7A', '#EEF2F8', 'หัวตาราง', 4.5),
 ('#1E7D45', '#E7F4EC', 'สถานะดี', 4.5), ('#8A5300', '#FFF4E0', 'สถานะเตือน', 4.5), ('#B42318', '#FDECEA', 'สถานะไม่ดี', 4.5),
 ('#3C549A', '#FFFFFF', 'กราฟ: ไม้ขาว', 3.0), ('#6B8E4E', '#FFFFFF', 'กราฟ: สาคู (Olive Sage ปรับเข้ม)', 3.0), ('#8A8F98', '#FFFFFF', 'กราฟ: อื่น ๆ', 3.0),
 ('#9BB87A', '#FFFFFF', 'Olive Sage ต้นฉบับ (ไม่ใช้เป็นเส้น/ข้อความ)', 3.0), ('#C1E7F2', '#FFFFFF', 'Aqua (ใช้เป็นพื้นเท่านั้น)', 3.0), ('#CEE2BA', '#FFFFFF', 'Sage (ใช้เป็นพื้นเท่านั้น)', 3.0), ('#7BCCDF', '#FFFFFF', 'Sky Aqua (กราฟชุดรอง มีตาราง/legend กำกับ)', 3.0),
]
for a, b, use, th in pairs:
    r = cr_(a, b); out.append(f"| {a} / {b} | {use} | {r:.2f}:1 | ≥ {th}:1 | {'ผ่าน' if r >= th else 'ไม่ผ่าน → ' + ('ไม่ใช้กับข้อความ/เส้น' if 'พื้น' in use or 'ไม่ใช้' in use else 'มีตาราง/legend/ขอบขาวกำกับ')} |")
print('\n'.join(out))
