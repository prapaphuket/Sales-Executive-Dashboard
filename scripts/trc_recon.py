# กระทบยอดเอกสาร WMS ↔ TRCloud รายเดือน
# ใช้: python3 scripts/trc_recon.py <โฟลเดอร์ไฟล์ TRCloud> [วันที่ดึง TRCloud YYYY-MM-DD]
# อินพุต : data/trc_docs.json (จาก sql/20_trc_docs.sql) + <โฟลเดอร์>/bl_YYYYMM.csv, iv_YYYYMM.csv, cn_YYYYMM.csv (ดึงผ่าน MCP เดือนละครั้ง)
# เอาต์พุต: data/trc_recon.json (ยอดรวม + รายการที่ต้องตรวจ · ไม่มีชื่อ ที่อยู่ เลขผู้เสียภาษี)
#
# กติกาจับคู่ (ยืนยันจากเอกสารตัวอย่าง 20/11/69)
# - เลขเอกสารเดียวกันทั้งสองระบบ: TRCloud ref_no = เลข WMS (BL..., IV...) → จับคู่ด้วยเลขเอกสาร ไม่ถือว่าทุกคู่เป็น 1:1 (นับกรณีพบหลายใบ)
# - ใบแจ้งหนี้ (BL ค่าน้ำ + BL งานขาย) ↔ TRCloud BL · ใบเสร็จ (IV ค่าน้ำ + IV งานขาย) ↔ TRCloud IV (IV.bill = เลข BL)
# - รายได้ลงบัญชีครั้งเดียวตามวันที่ BL (บัญชี 4001000/4101000) · IV ไม่ลงรายได้ซ้ำ → ไม่รวม BL กับ IV เป็นรายได้สองครั้ง
# - TRCloud เก็บยอดทศนิยม 4–6 ตำแหน่ง: ต่าง ≤ 0.01 บาท = ตรง · ≤ 1 บาท = ปัดเศษ · มากกว่า = ยอดต่าง
import csv, json, os, sys, collections
from datetime import date

ROOT = os.path.join(os.path.dirname(__file__), '..')
DATA = os.path.join(ROOT, 'data')
TOL, ROUND_TOL = 0.01, 1.0
WH = {'MK': 'ไม้ขาว', 'ไม้ขาว': 'ไม้ขาว', 'SK': 'สาคู', 'สาคู': 'สาคู', 'LY': 'หล่อยูง', 'หล่อยูง': 'หล่อยูง', 'NT': 'ไม้ขาว', 'นาเตย': 'ไม้ขาว'}
BRMAP = {'นาเตย': 'ไม้ขาว'}

def num(v):
    try: return float(v)
    except (TypeError, ValueError): return 0.0

def read_csv(p):
    if not os.path.exists(p): return None
    with open(p, encoding='utf-8-sig', newline='') as f: return list(csv.DictReader(f))

def main():
    if len(sys.argv) < 2: print(__doc__ or 'ใช้: python3 scripts/trc_recon.py <โฟลเดอร์> [YYYY-MM-DD]'); sys.exit(1)
    src = sys.argv[1]; pulled = sys.argv[2] if len(sys.argv) > 2 else date.today().isoformat()
    w = json.load(open(os.path.join(DATA, 'trc_docs.json'), encoding='utf-8'))
    snap = json.load(open(os.path.join(DATA, '_snapshot.json'), encoding='utf-8'))
    month = w['month']; ym = month.replace('-', '')
    cols = w['cols']; wd = [dict(zip(cols, r)) for r in w['rows']]
    for r in wd: r['br'] = BRMAP.get(r['br'], r['br'])
    t = {k: read_csv(os.path.join(src, f'{k}_{ym}.csv')) for k in ('bl', 'iv', 'cn')}
    if t['bl'] is None or t['iv'] is None: print('ไม่พบไฟล์ bl/iv ของเดือน', month); sys.exit(1)

    issues = []; summary = {}; reasons = collections.Counter()

    def recon(kind, wms_rows, trc_rows, active, trc_ref='ref_no'):
        idx = collections.defaultdict(list)
        for r in trc_rows: idx[r[trc_ref]].append(r)
        seen = set(); s = collections.defaultdict(float); n = collections.Counter()
        by_br = collections.defaultdict(lambda: collections.defaultdict(float))
        for r in wms_rows:
            ok = r['st'] in active; ts = [x for x in idx.get(r['doc'], [])]; seen.add(r['doc'])
            live = [x for x in ts if x.get('status', '').lower() not in ('cancel', 'cancelled', 'void')]
            if ok:
                n['wms'] += 1; s['wms_pre'] += num(r['pre']); s['wms_vat'] += num(r['vat']); s['wms_tot'] += num(r['tot'])
                by_br[r['br']]['wms_tot'] += num(r['tot']); by_br[r['br']]['wms_n'] += 1
            if ok and not live:
                why = 'trc_cancelled' if ts else ('not_sent' if not r.get('trc') else 'missing_in_trc')
                reasons[(kind, why)] += 1; issues.append([kind, r['doc'], why, r['br'], num(r['tot']), None, None])
                continue
            if not ok and live:
                reasons[(kind, 'cancelled_in_wms')] += 1
                issues.append([kind, r['doc'], 'cancelled_in_wms', r['br'], num(r['tot']), num(live[0]['grand_total']), None]); continue
            if not ok: continue
            if len(live) > 1:
                reasons[(kind, 'multiple_in_trc')] += 1
                issues.append([kind, r['doc'], 'multiple_in_trc', r['br'], num(r['tot']), sum(num(x['grand_total']) for x in live), len(live)])
            x = live[0]; tt = num(x['grand_total']); tv = num(x.get('tax')); d = tt - num(r['tot'])
            n['matched'] += 1; s['trc_tot'] += tt; s['trc_vat'] += tv; s['trc_pre'] += tt - tv
            by_br[r['br']]['trc_tot'] += tt; by_br[r['br']]['matched'] += 1
            if abs(d) <= TOL: n['exact'] += 1
            elif abs(d) <= ROUND_TOL: n['rounding'] += 1; s['rounding'] += d
            else:
                reasons[(kind, 'amount_diff')] += 1; issues.append([kind, r['doc'], 'amount_diff', r['br'], num(r['tot']), tt, round(d, 2)])
        # เอกสาร TRCloud ที่ไม่มีใน WMS ของเดือนนี้ (อาจเป็นเอกสารข้ามเดือน หรือสร้างใน TRCloud เอง)
        pre = 'BL' if kind in ('BL', 'BF') else 'IV'
        for ref, xs in idx.items():
            if ref in seen: continue
            for x in xs:
                if x.get('status', '').lower() in ('cancel', 'cancelled', 'void'): continue
                why = 'cross_month' if ref.startswith(pre) and ref[2:6] != ym[2:] else 'trc_only'
                if kind in ('BF', 'RF'): continue  # ตรวจรวมกับ BL/RV (เลขชุดเดียวกัน)
                reasons[(kind, why)] += 1; issues.append([kind, ref, why, WH.get(x.get('warehouse', ''), x.get('warehouse', '?')), None, num(x['grand_total']), None])
                n['trc_only'] += 1; s['trc_only_tot'] += num(x['grand_total'])
        summary[kind] = {'n': dict(n), 'amt': {k: round(v, 2) for k, v in s.items()},
                         'by_br': {b: {k: round(v, 2) for k, v in d.items()} for b, d in sorted(by_br.items())}}

    bl_inv = [r for r in wd if r['k'] in ('BL', 'BF', 'BB')]
    recon('BL', bl_inv, t['bl'], active={'pending', 'paymented', 'active'})
    rcpt = [r for r in wd if r['k'] in ('RV', 'RF', 'RB')]
    recon('RV', rcpt, t['iv'], active={'paymented', 'active', 'normal'})
    # ใบเสร็จที่ IV ใน TRCloud อ้างใบแจ้งหนี้ไม่ตรงกับ WMS
    ivx = {x['ref_no']: x for x in t['iv']}
    for r in rcpt:
        x = ivx.get(r['doc'])
        if x and r.get('ref') and x.get('bill') and x['bill'] != r['ref']:
            # reference ตรงกับ WMS แต่ IV ไปผูกกับ BL อีกใบ → ใบที่ถูกตัดชำระใน TRCloud ผิดใบ (สถานะ BL ใน TRCloud คลาด)
            why = 'bill_link_wrong' if x.get('reference') == r['ref'] else 'bill_link_diff'
            reasons[('RV', why)] += 1; issues.append(['RV', r['doc'], why, r['br'], num(r['tot']), num(x['grand_total']), None])
    cn_w = [r for r in wd if r['k'] == 'CN']
    cn_t = t['cn'] or []
    summary['CN'] = {'wms_n': len(cn_w), 'wms_tot': round(sum(num(r['tot']) for r in cn_w), 2),
                     'trc_n': len([x for x in cn_t if x.get('status', '').lower() not in ('cancel', 'cancelled')]),
                     'trc_tot': round(sum(num(x['grand_total']) for x in cn_t if x.get('status', '').lower() not in ('cancel', 'cancelled')), 2)}

    out = {'ds': 'trc_recon', 'month': month, 'wms_asof': snap['asof'], 'trc_pulled': pulled,
           'rules': {'tol': TOL, 'round_tol': ROUND_TOL, 'match': 'ref_no = เลขเอกสาร WMS', 'revenue': 'BL (วันที่ BL) — IV ไม่ลงรายได้ซ้ำ'},
           'summary': summary,
           'reasons': [[k, r, c] for (k, r), c in sorted(reasons.items())],
           'issue_cols': ['kind', 'doc', 'reason', 'br', 'wms_tot', 'trc_tot', 'diff'],
           'issues': sorted(issues, key=lambda r: (r[2], -(abs(r[4] or r[5] or 0))))[:300], 'issues_total': len(issues)}
    json.dump(out, open(os.path.join(DATA, 'trc_recon.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print(json.dumps({k: out[k] for k in ('month', 'summary', 'reasons', 'issues_total')}, ensure_ascii=False, indent=1))

if __name__ == '__main__': main()
