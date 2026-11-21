# สร้าง data/maintenance.json จากไฟล์ Excel ใบงานซ่อม (ชีต Sheet1) · ใช้: python scripts/maintenance_import.py <ไฟล์.xlsx>
import openpyxl, json, re, statistics as st, datetime as dt, collections, sys
src = sys.argv[1] if len(sys.argv) > 1 else 'data/maintenance/ตาราง_งานซ่อมทั้งหมด_HEA_NOV_2026.xlsx'
wb = openpyxl.load_workbook(src, data_only=True); ws = wb['Sheet1']
rows = list(ws.iter_rows(values_only=True)); H = [str(h).strip() for h in rows[0]]
R = [dict(zip(H, r)) for r in rows[1:] if any(v not in (None, '') for v in r)]
iso = lambda v: v.strftime('%Y-%m-%dT%H:%M') if isinstance(v, dt.datetime) else None
num = lambda v: (float(v) if isinstance(v, (int, float)) else None)
IT_T = {'Notebook, โน้ตบุ๊ค', 'Computer, คอมพิวเตอร์', 'Printer (ปริ้นเตอร์, เครื่องพิมพ์)', 'CCTV System (กล้องวงจรปิด)', 'Installation'}
PROD_T = {'Water Supply System (ระบบประปา)', 'Mobile Pump (ปั๊มน้ำแบบเครื่องยนต์)', 'Chlorine Tank (ถังคลอรีน)'}
VEH_T = {'Car (รถ)', 'Motorcycle (รถจักรยานยนต์)'}
OFF_T = {'เครื่องปรับอากาศ', 'เครื่องใช้ไฟฟ้า', 'อุปกรณ์สำนักงาน'}
def group(r):
    ty, mt, nm = r['ประเภทใบงาน'] or '', r['ประเภทเครื่องจักร'] or '', r['ชื่อเครื่องจักร'] or ''
    if ty == 'งาน IT Helpdesk': return 'it', 'ประเภทใบงาน = งาน IT Helpdesk'
    if ty == 'งานระบบท่อสูบน้ำ' or mt in PROD_T: return 'prod', 'ประเภทใบงาน/ประเภทเครื่องจักรเป็นระบบผลิต-สูบน้ำ'
    if mt.startswith('ทะเบียนทรัพย์สิน') and re.search('สถานีผลิต|แพสูบน้ำ|โรงสูบ|โรงผลิต', nm): return 'prod', 'อาคาร/สิ่งปลูกสร้างของระบบผลิต-สูบน้ำ (จากชื่อทรัพย์สิน)'
    if mt == 'Tool (เครื่องมือ)' and re.search('คลอรีน|Chlorine', nm, re.I): return 'prod', 'อุปกรณ์จ่ายสารเคมีของระบบผลิต (จากชื่อทรัพย์สิน)'
    if mt in IT_T or (mt == 'Tool (เครื่องมือ)' and re.search('พิมพ์|printer', nm, re.I)): return 'it', 'อุปกรณ์ IT (จากประเภท/ชื่อทรัพย์สิน)'
    if mt in VEH_T: return 'veh', 'ยานพาหนะ'
    if mt in OFF_T or ty == 'งานซ่อมเครื่องใช้สำนักงาน': return 'office', 'อุปกรณ์/เครื่องใช้สำนักงาน'
    return 'unk', 'จัดประเภทไม่ได้จากข้อมูลในไฟล์'
SLA_H = lambda u: (lambda m: (int(m.group(1)) * (24 if m.group(2) == 'วัน' else 1)) if m else None)(re.search(r'SLA\s*(\d+)\s*(ชั่วโมง|วัน)', u or ''))
out = []
for r in R:
    g, why = group(r)
    fixc = (r['รายละเอียดรหัสอาการซ่อม'] or '').strip()
    s = r['สถานะ']
    state = {'รอช่างรับงาน': 'wait', 'กำลังซ่อม': 'doing', 'ซ่อมแล้ว รอประเมิน': 'eval', 'ปิดงาน': 'closed'}.get(s, 'other')
    out.append({'no': r['เลขที่ใบงาน'], 'st': state, 'st_raw': s, 'nofix': state == 'closed' and fixc == 'ยกเลิกการซ่อม',
        'reported': iso(r['วันที่แจ้งซ่อม']), 'assigned': iso(r['วันเวลาที่มอบงาน']), 'done': iso(r['วันเวลาที่ซ่อมเสร็จ']),
        'tech_start': iso(r['เริ่มทำจริง (ช่างระบุเอง)']), 'tech_end': iso(r['ซ่อมเสร็จจริง (ช่างระบุเอง)']),
        'target': iso(r['วันที่คาดว่าจะเสร็จ']), 'min_assign': num(r['ระยะเวลาตั้งแต่แจ้งซ่อมถึงมอบหมาย (นาที)']),
        'min_done': num(r['ระยะเวลาตั้งแต่แจ้งซ่อมถึงซ่อมเสร็จ (นาที)']), 'min_tech': num(r['ระยะเวลาเริ่มซ่อมถึงซ่อมเสร็จ (ช่างระบุเอง)']),
        'type': r['ประเภทใบงาน'], 'dept': r['แผนกของเครื่องจักร'], 'qr': r['QR Code'] or None, 'machine': r['ชื่อเครื่องจักร'], 'mtype': r['ประเภทเครื่องจักร'],
        'urg': r['ระดับความด่วน'], 'sla_h': SLA_H(r['ระดับความด่วน']), 'safety': r['ความปลอดภัย'] == 'เกี่ยวข้องกับความปลอดภัย',
        'mstop': r['สถานะเครื่องจักรหยุด'] == 'หยุดทำงาน', 'lstop': r['สถานะไลน์ผลิต'] == 'หยุดผลิต',
        'symptom': re.sub(r'\s+', ' ', str(r['อาการเสีย'] or '')).strip()[:140], 'fail': (r['รายละเอียดรหัสอาการเสีย'] or '').strip() or None, 'fix': fixc or None,
        'team': r['ผู้รับผิดชอบ'], 'grp': g, 'grp_why': why})
nos = [x['no'] for x in out]
dup = [n for n, c in collections.Counter(nos).items() if c > 1]
meta = {'ds': 'maintenance', 'source': 'ไฟล์ ' + 'ตาราง_งานซ่อมทั้งหมด_HEA_NOV_2026.xlsx · ชีต Sheet1', 'n_rows': len(R), 'n_unique': len(set(nos)), 'dup_no': dup,
        'first': min(x['reported'] for x in out), 'last': max(x['reported'] for x in out), 'ref': '2026-11-21',
        'ref_note': 'อายุใบงานเปิดค้างนับถึง 21 พ.ย. 2569 (วันที่ได้รับไฟล์) — ไฟล์ไม่มีวันที่ส่งออก',
        'rows': out}
json.dump(meta, open('data/maintenance.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(meta['n_rows'], meta['n_unique'], dup, meta['first'], meta['last'])
print(collections.Counter(x['grp'] for x in out), collections.Counter(x['st'] for x in out), sum(x['nofix'] for x in out))
for g in ['prod']: print([ (x['no'], x['st']) for x in out if x['grp']==g])
