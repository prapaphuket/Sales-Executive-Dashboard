# สร้าง data/projects.json จากข้อมูล ClickUp ที่ดึงผ่าน MCP (อ่านอย่างเดียว) · ใช้: python scripts/clickup_projects.py
# ข้อมูลดิบอยู่ใน data/clickup/ (ไม่ขึ้น repo): top.tsv = งานระดับบนสุด, kids.tsv = งานย่อยระดับแรก, top_sub.json = วันที่/ผู้สร้าง/รายการงานย่อย
import json, datetime as dt
TZ = dt.timezone(dt.timedelta(hours=7))
TODAY = dt.datetime(2026, 11, 21, tzinfo=TZ)
T0 = int(TODAY.timestamp() * 1000)
d = lambda ms: dt.datetime.fromtimestamp(int(ms) / 1000, TZ).strftime('%Y-%m-%d') if ms else None
LISTS = {'901818930734': 'แหล่งน้ำ', '901818930749': 'อ่างเก็บน้ำ', '901818930763': 'การผลิต/โรงงาน', '901818930772': 'ซ่อมบำรุง/ติดตั้งมิเตอร์',
         '901818957923': 'Customer Care Center', '901818930833': 'ลูกค้าใหม่/เก่า', '901818931143': 'จัดเก็บรายได้', '901819539347': 'คดีความ',
         '901820077724': 'จัดหาผู้ให้บริการภายนอก (Outsource) จดมิเตอร์/ฝ่ายผลิต', '901820171870': 'การวิเคราะห์ข้อมูล'}
CLOSED = {'complete': 'done', 'cancelled': 'cancel'}
# โครงการที่มีขอบเขตและผลส่งมอบชัด (มีแผนงาน/milestone เป็นงานย่อยพร้อมกำหนดส่ง) — ที่เหลือแสดงแยกเป็น "รอยืนยันว่าเป็นโครงการ"
PROJ = {'86eyd8vxr', '86eybfv6p', '86eybgu7y', '86ey27m4h', '86eyaqw40', '86eygxw0n', '86eygxypr', 'L901820077724'}
OUTS = ['86eyfpvuh', '86eyfpvxd', '86eyfpw00', '86eyfpw1v']
top = [l.rstrip('\n').split('\t') for l in open('data/clickup/top.tsv', encoding='utf-8')]
kids = [l.rstrip('\n').split('\t') for l in open('data/clickup/kids.tsv', encoding='utf-8')]
meta = {t['i']: t for t in json.load(open('data/clickup/top_sub.json'))}
rows = []
def kidstats(ks):
    st = {'n': len(ks), 'done': 0, 'cancel': 0, 'open': 0, 'hold': 0, 'overdue': 0, 'nodate': 0}
    late, nxt = [], []
    for k in ks:
        s = k['s']
        if s in CLOSED: st[CLOSED[s]] += 1; continue
        st['open'] += 1
        if s == 'on hold': st['hold'] += 1
        if not k['due']: st['nodate'] += 1; continue
        if k['due'] < T0: st['overdue'] += 1; late.append(k)
        else: nxt.append(k)
    late.sort(key=lambda k: k['due']); nxt.sort(key=lambda k: k['due'])
    fmt = lambda k: {'id': k['id'], 'n': k['n'], 'd': d(k['due']), 's': k['s'], 'url': 'https://app.clickup.com/t/' + k['id']}
    return st, [fmt(k) for k in late], (fmt(nxt[0]) if nxt else None)
K = {}
for p, i, s, due, nsub, name in kids:
    K.setdefault(p, []).append({'id': i, 's': s, 'due': int(due) if due else None, 'n': name if name and not name.startswith('(') else None})
tops = {t[0]: t for t in top}
for i, lst, s, due, owner, name in top:
    if i in OUTS: continue
    m = meta.get(i, {})
    st, late, nxt = kidstats(K.get(i, []))
    rows.append({'id': i, 'name': name, 'list': LISTS[lst], 'status': s, 'owner': owner or None, 'start': d(m.get('sd')), 'due': d(due) if due else None,
                 'updated': d(m.get('u')), 'url': 'https://app.clickup.com/t/' + i, 'kind': 'project' if i in PROJ else 'other', 'kids': st, 'late': late, 'next': nxt})
# รวม 4 ระยะของโครงการ Outsource (เป็นงานระดับบนสุดใน List เดียวกัน) เป็น 1 โครงการ — ระยะ = milestone
ph = [{'id': i, 's': tops[i][2], 'due': int(tops[i][3]) if tops[i][3] else None, 'n': tops[i][5]} for i in OUTS]
st, late, nxt = kidstats(ph)
sub_n = sum(len(K.get(i, [])) for i in OUTS); sub_open = sum(1 for i in OUTS for k in K.get(i, []) if k['s'] not in CLOSED)
rows.append({'id': 'L901820077724', 'name': 'โครงการจัดหาผู้ให้บริการภายนอก (Outsource) เจ้าหน้าที่จดมิเตอร์และฝ่ายผลิต', 'list': LISTS['901820077724'],
             'status': 'not started', 'owner': 'Prasong Prayoonhong', 'start': d(meta['86eyfpvuh']['sd']), 'due': d(tops['86eyfpw1v'][3]),
             'updated': d(max(int(meta[i]['u']) for i in OUTS)), 'url': 'https://app.clickup.com/90182760752/v/li/901820077724', 'kind': 'project',
             'kids': st, 'late': late, 'next': nxt, 'phases': 4, 'sub': {'n': sub_n, 'open': sub_open},
             'note': 'รวม 4 ระยะ (Preparation → Bidding → Selection → Orientation) ที่เป็นงานระดับบนสุดใน List เดียวกัน · ผู้รับผิดชอบ = ผู้สร้างระยะงาน (ไม่มีผู้รับผิดชอบระบุในระยะ)'})
out = {'ds': 'projects', 'source': 'ClickUp · Workspace 90182760752 · Space HEA 901811850930 (อ่านอย่างเดียว)', 'fetched_at': '2026-11-21T16:30:00+07:00', 'today': TODAY.strftime('%Y-%m-%d'),
       'scope': 'งานระดับบนสุดทุก List ใน Space HEA + งานย่อยระดับแรก · ตัดงานระดับบนสุดที่ยกเลิก 29 รายการ (ส่วนใหญ่เป็นแผน Customer Care ชุดเดิมที่ทำซ้ำ)',
       'cancelled_top': 29, 'rows': rows}
json.dump(out, open('data/projects.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
pr = [r for r in rows if r['kind'] == 'project']
print(len(rows), 'rows ·', len(pr), 'projects')
for r in pr: print(r['name'][:40], r['status'], r['due'], r['kids'], (r['next'] or {}).get('n'), (r['next'] or {}).get('d'))
op = [r for r in rows if r['status'] not in CLOSED]
print('open top', len(op), 'overdue top', sum(1 for r in op if r['due'] and r['due'] < '2026-11-21'), 'kids overdue', sum(r['kids']['overdue'] for r in op))
