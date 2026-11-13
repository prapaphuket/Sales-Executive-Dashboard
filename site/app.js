/* HEA Sales Executive Dashboard — frontend (ไม่มีรหัสผ่านหรือ connection string ในไฟล์นี้) */
'use strict';
(function () {
  // ---------- tokens (ชุดเดียวกับ styles.css) ----------
  const C = {
    navy: '#3C549A', deep: '#2A3D7A', aqua: '#C1E7F2', sage: '#CEE2BA', sky: '#7BCCDF', olive: '#9BB87A',
    oliveChart: '#6B8E4E', neutral: '#8A8F98', body: '#1C1C1E', text2: '#4A5160', line: '#DCE2EA',
    good: '#1E7D45', warn: '#8A5300', bad: '#B42318',
  };
  const BR_COLOR = { 'ไม้ขาว': 1, 'สาคู': 2 };
  const brColor = (b) => (BR_COLOR[b] === 1 ? C.navy : BR_COLOR[b] === 2 ? C.oliveChart : C.neutral);
  // สาขาที่ปิดแล้ว/ไม่ระบุ รวมเป็นกลุ่มเดียวในกราฟ (ตารางยังแยกตามจริง)
  const OTHER = 'อื่น ๆ (สาขาปิด/ไม่ระบุ)';
  const brG = (b) => (BR_COLOR[b] ? b : OTHER);
  const chartBranches = (pred) => { const g = [...new Set(S.branches.filter(okBr).filter(pred).map(brG))]; return g.sort((a, b) => (a === OTHER) - (b === OTHER) || BR_ORDER(a) - BR_ORDER(b)); };
  const AGING = [
    { k: 0, name: 'ยังไม่ครบกำหนด', v: 'ag0' },
    { k: 1, name: '1–30 วัน', v: 'ag1' },
    { k: 2, name: '31–60 วัน', v: 'ag2' },
    { k: 3, name: '61–90 วัน', v: 'ag3' },
    { k: 4, name: '> 90 วัน', v: 'ag4' },
    { k: 9, name: 'ไม่มีวันครบกำหนด (รอตรวจสอบ)', v: 'neutral' },
  ];
  // อ่านสีกราฟจาก CSS variables ของธีมปัจจุบัน (สว่าง/มืด)
  function readTheme() {
    const cs = getComputedStyle(document.documentElement), v = (n) => cs.getPropertyValue('--ch-' + n).trim();
    Object.assign(C, { navy: v('br1'), oliveChart: v('br2'), sky: v('sky'), neutral: v('neutral'), disc: v('disc'), text2: v('text'), body: v('fg'), line: v('axis'), grid: v('grid'), surface: v('surface'),
      ag0: v('ag0'), ag1: v('ag1'), ag2: v('ag2'), ag3: v('ag3'), ag4: v('ag4'), orange: v('orange') || '#C2620A' });
    AGING.forEach((g) => { g.color = C[g.v]; });
    baseText.color = C.text2;
  }
  const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  // หมู่บ้านมอร์แกน (AR00C-03022, หอถัง T2.3): ใช้น้ำจริง จดหน่วยแบบแมนนวล ยังไม่ลงใน WMS (บิลในระบบยกเลิกทั้งหมด) — แจ้ง 11/11/69
  // แสดงหมายเหตุจนกว่าจะมีหน่วยน้ำของทะเบียนนี้ในระบบ
  const MORGAN = 'AR00C-03022';
  const morganMissing = () => !(S.cm || []).some((r) => r.reg === MORGAN && r.u.some((v) => typeof v === 'number' && v > 0));
  const MORGAN_TXT = 'ยังไม่รวมหมู่บ้านมอร์แกน (AR00C-03022) — ใช้น้ำจริง จดหน่วยไว้นอกระบบ ยังไม่ได้ลงใน WMS';
  const TY_NAME = { T1: 'T1', T2: 'T2', 'T2.1': 'T2.1 ตำรวจภูธรภาค 8', 'T2.2': 'T2.2 กปภ.', 'T2.3': 'T2.3 อบต. (หอถังสูง)', T3: 'T3', 'T3.1': 'T3.1 ทอท.', 'ชั่วคราว-ไม้ขาว': 'ชั่วคราว', '?': 'ไม่ระบุ/รอตรวจสอบ' };
  // qr = ลูกค้าสแกน QR บนใบแจ้งหนี้ จ่ายผ่านแอปธนาคาร (ระบบบันทึกใบเสร็จเอง) · ยืนยัน 11/11/69
  const CH_NAME = { qr: 'สแกน QR (แอปธนาคาร)', epay: 'E-Payment', transfer: 'โอน', direct: 'ชำระตรง (พนักงานบันทึก)', cash: 'เงินสด', cheque: 'เช็ค', scan: 'สแกน QR', zero: 'ไม่มีการชำระ (ยอด 0)', '?': 'ไม่ระบุ' };
  const KIND_NAME = { water: 'ค่าน้ำ', water_legacy: 'ค่าน้ำ', fee: 'งานขาย/บริการ', bond: 'เงินประกัน' };

  // ---------- format ----------
  const nf0 = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nf1 = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const baht = (v) => (v == null || isNaN(v) ? '–' : nf2.format(v));
  const int = (v) => (v == null || isNaN(v) ? '–' : nf0.format(v));
  const mb = (v) => (v == null || isNaN(v) ? '–' : nf2.format(v / 1e6));
  const pct = (v) => (v == null || !isFinite(v) ? '–' : nf1.format(v * 100) + '%');
  const mLabel = (m) => { const [y, mo] = m.split('-').map(Number); return TH_M[mo - 1] + ' ' + String((y + 543) % 100).padStart(2, '0'); };
  const mLong = (m) => { const [y, mo] = m.split('-').map(Number); return TH_M[mo - 1] + ' ' + (y + 543); };
  const dLabel = (d) => { if (!d) return '–'; const [y, m, dd] = d.slice(0, 10).split('-').map(Number); return dd + ' ' + TH_M[m - 1] + ' ' + (y + 543); };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const addM = (m, k) => { const [y, mo] = m.split('-').map(Number); const d = new Date(Date.UTC(y, mo - 1 + k, 1)); return d.toISOString().slice(0, 7); };
  const monthsBetween = (a, b) => { const out = []; for (let m = a; m <= b; m = addM(m, 1)) out.push(m); return out; };
  const sum = (arr, f) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0);
  const rowsOf = (ds) => ds.rows.map((r) => Object.fromEntries(ds.cols.map((c, i) => [c, r[i]])));

  // ---------- state ----------
  const S = { cfg: null, d: {}, fetched: null, asof: null, f: {}, page: 'snapshot', charts: [] };
  const $ = (id) => document.getElementById(id);

  async function getJSON(url) {
    // โหมดเว็บ static (GitHub Pages): ข้อมูลถูกถอดรหัสแล้วส่งเข้ามาทาง HEADash.start(bundle)
    if (S.bundle) {
      if (url === '/api/config') return S.bundle.config;
      const name = url.replace(/^\/api\/ds\//, '').split('?')[0];
      if (!(name in S.bundle.ds)) throw new Error('ไม่มีชุดข้อมูล ' + name);
      return { data: S.bundle.ds[name], fetched_at: S.bundle.config.snapshot.fetched_at, asof: S.bundle.config.snapshot.asof, mode: 'snapshot' };
    }
    const r = await fetch(url, { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.detail || j.error || r.statusText);
    return j;
  }

  async function load(asof) {
    $('page').innerHTML = '<div class="grid g4">' + '<div class="skel"></div>'.repeat(4) + '</div><div class="skel" style="height:300px;margin-top:16px"></div>';
    const names = S.cfg.datasets;
    const q = asof ? '?asof=' + encodeURIComponent(asof) : '';
    const res = await Promise.all(names.map((n) => getJSON('/api/ds/' + n + q)));
    names.forEach((n, i) => { S.d[n] = res[i].data; });
    S.fetched = res.map((r) => r.fetched_at).filter(Boolean).sort()[0] || null;
    S.asof = res[0].asof || S.cfg.asof_default;
    prep();
  }

  // ---------- data prep ----------
  function prep() {
    const d = S.d;
    S.sales = rowsOf(d.sales_cube);
    S.mooM = d.moo_monthly ? rowsOf(d.moo_monthly) : [];
    S.cust = rowsOf(d.customers);
    S.custStatus = d.customers.status.map(([br, ty, status, n]) => ({ br, ty, status, n }));
    S.custCreated = d.customers.created.map(([m, n]) => ({ m, n }));
    S.newRev = d.customers.newrev ? d.customers.newrev.map((r) => Object.fromEntries(d.customers.newrev_cols.map((c, i) => [c, r[i]]))) : [];
    S.coll = rowsOf(d.collections).map((r) => ({ ...r, k: r.kind === 'water_legacy' ? 'water' : r.kind }));
    S.cohort = rowsOf(d.cohort);
    S.ar = rowsOf(d.ar);
    S.top = rowsOf(d.top_customers);
    S.decl = rowsOf(d.declines);
    S.debt = rowsOf(d.debtors);
    S.debtDocs = d.debtors.docs.map((r) => Object.fromEntries(d.debtors.docs_cols.map((c, i) => [c, r[i]])));
    S.drill = rowsOf(d.drill_top);
    S.rev = d.revenue_groups ? rowsOf(d.revenue_groups) : [];
    S.revCust = d.revenue_groups ? d.revenue_groups.cust.map((r) => Object.fromEntries(d.revenue_groups.cust_cols.map((c, i) => [c, r[i]]))) : [];
    // หน่วยน้ำรายเดือนรายผู้ใช้น้ำ (คำนวณตามช่วงเดือนที่เลือก) · u: ตัวเลข = ลบ.ม., 'L' = มีบิลระบบเดิมไม่มีหน่วย, ว่าง = ไม่มีบิล
    S.regMoo = d.reg_moo ? d.reg_moo.map : {};
    S.cmMonths = d.cust_months ? d.cust_months.months : [];
    S.cm = d.cust_months ? rowsOf(d.cust_months).map((r) => ({ ...r, u: r.u.split(',').map((v) => (v === '' ? null : v === 'L' ? 'L' : +v)) })) : [];
    S.asofMonth = S.asof.slice(0, 7);
    // ---- ทำความสะอาด/เสริมข้อมูล ----
    // 1) นาเตย = ชื่อสาขาไม้ขาวในระบบเดิม -> รวมเป็นไม้ขาว
    const BRMAP = { 'นาเตย': 'ไม้ขาว' };
    const nb = (arr) => arr.forEach((r) => { if (BRMAP[r.br]) r.br = BRMAP[r.br]; });
    [S.sales, S.mooM, S.cust, S.newRev, S.custStatus, S.coll, S.cohort, S.ar, S.top, S.decl, S.debt, S.rev, S.revCust, S.cm].forEach(nb);
    if (d.usage_compare) { d.usage_compare.status.forEach((r) => { if (BRMAP[r[0]]) r[0] = BRMAP[r[0]]; }); d.usage_compare.monthly.forEach((r) => { if (BRMAP[r[1]]) r[1] = BRMAP[r[1]]; }); }
    // 2) หน่วยน้ำ (และบิลที่ขาด) ของลูกค้ารายใหญ่ระบบเดิม จากไฟล์ตรวจเทียบ Pay2Head — ใช้ชั่วคราวจนกว่าจะนำเข้า WMS
    S.leg = d.legacy_units ? rowsOf(d.legacy_units) : [];
    S.legAdded = [];
    const legBy = {};
    S.leg.forEach((r) => { const k = r.d.slice(0, 7) + '|' + r.ty; const x = legBy[k] || (legBy[k] = { m: r.d.slice(0, 7), ty: r.ty, q: 0, amt: 0, vat: 0, n: 0 }); x.q += r.q || 0; x.amt += r.amt; x.vat += r.vat; x.n += 1; });
    Object.values(legBy).forEach((x) => {
      const ls = S.sales.filter((r) => r.src === 'L' && r.m === x.m && r.ty === x.ty);
      if (ls.length) { const tot = sum(ls, (r) => r.net) || 1; ls.forEach((r) => { r.units = Math.round(x.q * r.net / tot); r.free = 0; }); }
      else if (x.m >= S.sales.reduce((a, r) => (r.m < a ? r.m : a), '9999')) {
        S.sales.push({ m: x.m, br: 'ไม้ขาว', ty: x.ty, src: 'L', docs: x.n, wat: x.amt, svc: 0, disc: 0, net: x.amt, units: Math.round(x.q), free: 0, vat: x.vat, supp: 1 });
        S.legAdded.push(x);
      }
      if (S.rev.length) {
        const y = Number(x.m.slice(0, 4)), mm = x.m.slice(5, 7);
        const rs = S.rev.filter((r) => r.src === 'L' && r.y === y && r.mm === mm && r.ty === x.ty);
        if (rs.length) { const tot = sum(rs, (r) => r.net) || 1; rs.forEach((r) => { r.units = Math.round(x.q * r.net / tot); }); }
      }
    });
    if (d.usage_compare) {
      Object.values(legBy).forEach((x) => { const r = d.usage_compare.monthly.find((z) => z[0] === x.m && z[1] === 'ไม้ขาว'); if (r) { r[4] = (r[4] || 0) + x.q; if (x.ty !== 'T2.2') r[3] = (r[3] || 0) + x.q; } });
    }
    const months = [...new Set(S.sales.map((r) => r.m))].sort();
    S.months = months;
    S.lastFull = addM(S.asofMonth, -1);
    S.partialMonth = months.includes(S.asofMonth) ? S.asofMonth : null;
    S.branches = [...new Set(S.sales.map((r) => r.br).concat(S.ar.map((r) => r.br)))].sort((a, b) => (BR_ORDER(a) - BR_ORDER(b)));
    S.types = [...new Set(S.sales.map((r) => r.ty).concat(S.ar.map((r) => r.ty)))].sort();
    // หมู่ของแต่ละตำบล (ใช้แทน DMA ที่การผูกในทะเบียนยังไม่ครบ) · ค่า = "ตำบล|หมู่ N"
    const mooSet = new Set(S.mooM.concat(S.rev).filter((r) => MOO_BR.includes(r.br)).map((r) => r.br + '|' + r.moo));
    S.moos = [...mooSet].sort((a, b) => mooKey(a) - mooKey(b));
    // เดือนที่ไม่มีรายได้ กปภ. (T2.2): หน้าแล้งไม่มีน้ำส่ง หรือหลังสัญญาสิ้นสุด -> บอกเหตุเมื่อเปรียบเทียบ
    S.pwaMissing = months.filter((m) => m !== S.partialMonth && sum(S.sales.filter((r) => r.m === m && r.ty === 'T2.2' && (r.src === 'W' || r.src === 'L')), (r) => r.net) === 0);
  }
  // กปภ. (T2.2): สัญญาขายส่งสิ้นสุดแล้ว (บิลสุดท้าย ก.ค. 69) · พ.ค. 69 หน้าแล้งไม่มีน้ำส่ง
  const PWA_LAST = '2026-07', PWA_DRY = ['2026-05'];
  const pwaWhy = (m) => (m > PWA_LAST ? 'สัญญาสิ้นสุดแล้ว' : PWA_DRY.includes(m) ? 'หน้าแล้งไม่มีน้ำส่ง' : 'ไม่พบใบแจ้งหนี้');
  // สรุปเดือนที่ไม่มีรายได้ กปภ. ตามสาเหตุ เช่น "พ.ค. 69 หน้าแล้งไม่มีน้ำส่ง · ส.ค.–ต.ค. 69 สัญญาสิ้นสุดแล้ว"
  const pwaTxt = (ms) => { const g = {}; ms.slice().sort().forEach((m) => (g[pwaWhy(m)] = g[pwaWhy(m)] || []).push(m)); return Object.entries(g).map(([w, l]) => `${l.length > 2 ? mLabel(l[0]) + '–' + mLabel(l[l.length - 1]) : l.map(mLabel).join(', ')} ${w}`).join(' · '); };
  const MOO_BR = ['ไม้ขาว', 'สาคู'];
  const mooNum = (m) => (/\d+/.test(m) ? +m.match(/\d+/)[0] : 99);
  const mooKey = (k) => { const [b, m] = k.split('|'); return MOO_BR.indexOf(b) * 100 + mooNum(m); };
  const okMoo = (br, moo) => !S.f.moo || br + '|' + moo === S.f.moo;
  const BR_ORDER = (b) => ({ 'ไม้ขาว': 1, 'สาคู': 2, 'นาเตย': 3, 'หล่อยูง': 4 }[b] || 9);

  // ---------- filters ----------
  const FX = [
    ['ช่วงเดือน', 'ยอดขาย ปริมาณน้ำ ลูกค้าใช้งาน/ลูกค้าใหม่ ยอดรับชำระ อัตราเก็บเงินรายรุ่น ยอดตามหมู่ · รายได้ตามกลุ่มลูกค้าและการใช้น้ำเทียบปีก่อน (เทียบเดือนเดียวกันปีก่อน)', 'ลูกหนี้คงค้าง (ใช้วันอ้างอิง) · ลูกค้ารายใหญ่ (12 เดือนเต็มล่าสุด) · รายการลูกค้าลดลง (3 เดือนเต็มล่าสุด)'],
    ['สาขา (ตำบล)', 'ทุก KPI และกราฟ ยกเว้นที่ระบุ · สาขาและตำบลคือชุดเดียวกัน (ไม้ขาว, สาคู) · ตัวกรองหมู่จะแสดงเฉพาะหมู่ของตำบลที่เลือก', 'ข้อมูลเก่าที่สาขาปิดหรือไม่ระบุสาขา (ยอดเล็กน้อย) นับรวมเฉพาะใน “ทุกสาขา”'],
    ['ประเภทลูกค้า (เลือกได้หลายประเภท)', 'ยอดขาย ปริมาณน้ำ ลูกค้า ลูกหนี้ ลูกค้ารายใหญ่ ลูกค้าลดลง ยอดตามหมู่', 'ยอดรับชำระ · อัตราเก็บเงินรายรุ่น'],
    ['หมู่', 'ตารางยอดค่าน้ำตามหมู่ (หน้ายอดขาย) · ตารางรายได้แยกหมู่ (หน้ารายได้)', 'KPI และกราฟอื่นทั้งหมด (ใบแจ้งหนี้งานขาย/ใบลดหนี้/ใบเสร็จไม่มีข้อมูลหมู่)'],
    ['วันอ้างอิงลูกหนี้', 'ลูกหนี้คงค้าง อายุหนี้ ลูกหนี้รายใหญ่ อัตราเก็บเงินรายรุ่น (นับรับชำระถึงวันนี้)', 'ยอดขายและยอดรับชำระ (ใช้ช่วงเดือน)'],
  ];
  function initFilters() {
    const mOpts = S.months.map((m) => `<option value="${m}">${mLong(m)}${m === S.partialMonth ? ' (ไม่ครบเดือน)' : ''}</option>`).join('');
    $('f-from').innerHTML = mOpts; $('f-to').innerHTML = mOpts;
    // สาขา = ตำบล (ไม้ขาว, สาคู) · ข้อมูลเก่าที่สาขาปิด/ไม่ระบุ (ยอดเล็กน้อย) ยังนับใน "ทุกสาขา"
    $('f-br').innerHTML = '<option value="">ทุกสาขา</option>' + MOO_BR.filter((b) => S.branches.includes(b)).map((b) => `<option>${esc(b)}</option>`).join('');
    // ประเภทลูกค้า: เลือกได้หลายประเภท (ฝ่ายกลยุทธ์ขอ 11/11/69) · ค่าเก็บใน #f-ty เป็น "T1,T2" ('' = ทุกประเภท)
    $('f-ty-pop').innerHTML = '<div class="msel-top"><button type="button" class="linkbtn" data-all="1">ทุกประเภท</button><button type="button" class="linkbtn" data-close="1">ปิด</button></div>' +
      S.types.map((t) => `<label class="msel-opt"><input type="checkbox" value="${esc(t)}"> ${esc(TY_NAME[t] || t)}</label>`).join('');
    initTySel();
    fillMoo();
    $('fx-body').innerHTML = '<table class="t small"><thead><tr><th>ตัวกรอง</th><th>มีผลกับ</th><th>ไม่มีผลกับ</th></tr></thead><tbody>' +
      FX.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('') + '</tbody></table>';
    const asofEl = $('f-asof');
    if (S.cfg.mode === 'snapshot') { asofEl.type = 'text'; asofEl.value = dLabel(S.asof) + ' (คงที่)'; asofEl.disabled = true; asofEl.title = 'โหมด snapshot: ลูกหนี้คำนวณได้เฉพาะ ณ วันที่ดึงข้อมูล'; }
    else asofEl.value = S.asof;
    restoreFilters();
    ['f-from', 'f-to', 'f-ty', 'f-moo'].forEach((id) => $(id).addEventListener('change', onFilter));
    $('f-br').addEventListener('change', () => { fillMoo(); onFilter(); });
    asofEl.addEventListener('change', async () => { if (!asofEl.value) return; await load(asofEl.value); initFilters(); render(); });
    $('f-reset').onclick = () => { setDefaults(); onFilter(); };
  }
  // ตัวเลือกหมู่: เลือกตำบลแล้วแสดงเฉพาะหมู่ของตำบลนั้น · ไม่เลือกตำบล = แยกกลุ่มตามตำบล
  function fillMoo() {
    const el = $('f-moo'), br = $('f-br').value, cur = el.value;
    const opt = (k) => `<option value="${esc(k)}">${esc(br ? k.split('|')[1] : k.replace('|', ' '))}</option>`;
    const list = S.moos.filter((k) => !br || k.startsWith(br + '|'));
    el.innerHTML = '<option value="">ทุกหมู่</option>' + (br ? list.map(opt).join('') : MOO_BR.map((b) => `<optgroup label="ตำบล${esc(b)}">${list.filter((k) => k.startsWith(b + '|')).map(opt).join('')}</optgroup>`).join(''));
    el.value = list.includes(cur) ? cur : '';
    el.disabled = br && !MOO_BR.includes(br);
  }
  function setDefaults() {
    const to = S.lastFull;
    const from = to.slice(0, 4) + '-01' >= S.months[0] ? to.slice(0, 4) + '-01' : S.months[0];
    $('f-from').value = from; $('f-to').value = to; $('f-br').value = ''; $('f-ty').value = ''; fillMoo(); $('f-moo').value = '';
  }
  function restoreFilters() {
    setDefaults();
    try {
      const saved = JSON.parse(localStorage.getItem('hea-dash-f') || 'null');
      if (saved) for (const k of ['f-from', 'f-to', 'f-br', 'f-ty', 'f-moo']) { const el = $(k), v = saved[k]; if (k === 'f-moo') fillMoo(); if (k === 'f-ty') { if (typeof v === 'string') el.value = v.split(',').filter((t) => S.types.includes(t)).join(','); continue; } if (el && v != null && [...el.options].some((o) => o.value === v)) el.value = v; }
    } catch (e) { /* storage อาจใช้ไม่ได้ */ }
    readFilters();
  }
  function readFilters() {
    let from = $('f-from').value, to = $('f-to').value;
    if (from > to) { [from, to] = [to, from]; $('f-from').value = from; $('f-to').value = to; }
    S.f = { from, to, br: $('f-br').value, ty: $('f-ty').value, moo: $('f-moo').value };
    ['f-br', 'f-moo'].forEach((id) => $(id).classList.toggle('active', !!$(id).value));
    S.tySet = new Set(S.f.ty ? S.f.ty.split(',') : []); syncTySel();
    try { localStorage.setItem('hea-dash-f', JSON.stringify({ 'f-from': from, 'f-to': to, 'f-br': S.f.br, 'f-ty': S.f.ty, 'f-moo': S.f.moo })); } catch (e) { /* ignore */ }
  }
  function onFilter() { readFilters(); render(); }
  const okBr = (b) => !S.f.br || b === S.f.br;
  const okTy = (t) => !S.f.ty || (S.tySet ? S.tySet.has(t) : S.f.ty.split(',').includes(t));
  const tyLabel = (v) => (v || '').split(',').filter(Boolean).map((t) => TY_NAME[t] || t).join(', ');
  function syncTySel() {
    const v = $('f-ty').value, sel = v ? v.split(',') : [], btn = $('f-ty-btn');
    document.querySelectorAll('#f-ty-pop input[type=checkbox]').forEach((c) => { c.checked = sel.includes(c.value); });
    btn.textContent = !sel.length ? 'ทุกประเภท' : sel.length <= 2 ? tyLabel(v) : `${sel.length} ประเภท`;
    btn.title = sel.length ? tyLabel(v) : 'ทุกประเภท'; btn.classList.toggle('active', !!sel.length);
  }
  function initTySel() {
    const pop = $('f-ty-pop'), btn = $('f-ty-btn'), hid = $('f-ty');
    if (btn.dataset.init) return; btn.dataset.init = '1';
    const open = (on) => { pop.hidden = !on; btn.setAttribute('aria-expanded', String(on)); };
    btn.addEventListener('click', (e) => { e.stopPropagation(); open(pop.hidden); });
    pop.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => open(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pop.hidden) { open(false); btn.focus(); } });
    const fire = () => { hid.dispatchEvent(new Event('change')); };
    pop.addEventListener('change', () => { hid.value = [...pop.querySelectorAll('input:checked')].map((c) => c.value).join(','); fire(); });
    pop.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.all) { hid.value = ''; fire(); } if (b.dataset.close) { open(false); btn.focus(); } });
  }
  const inR = (m, a, b) => m >= a && m <= b;

  // ---------- metrics ----------
  function salesAgg(a, b, opt = {}) {
    const rows = S.sales.filter((r) => inR(r.m, a, b) && okBr(r.br) && (opt.ignoreTy || okTy(r.ty)));
    const W = rows.filter((r) => r.src === 'W'), L = rows.filter((r) => r.src === 'L'), F = rows.filter((r) => r.src === 'F'), Cn = rows.filter((r) => r.src === 'C');
    const water = sum(W, (r) => r.wat) + sum(L, (r) => r.wat), service = sum(W, (r) => r.svc), fee = sum(F, (r) => r.svc), cn = sum(Cn, (r) => r.wat);
    const disc = sum(W, (r) => r.disc);
    return {
      water, service, fee, cn, disc, gross: water + service + fee, net: sum(rows, (r) => r.net),
      units: sum(W.concat(L), (r) => r.units), free: sum(W, (r) => r.free), docs: sum(rows, (r) => r.docs),
      billWaterInclVat: sum(W.concat(L), (r) => r.net + r.vat), legacyNoUnits: sum(L.filter((r) => r.units == null), (r) => r.net),
    };
  }
  function collAgg(a, b) {
    const rows = S.coll.filter((r) => inR(r.m, a, b) && okBr(r.br));
    const by = (k) => sum(rows.filter((r) => r.k === k), (r) => r.amt);
    return { water: by('water'), fee: by('fee'), bond: by('bond'), total: sum(rows, (r) => r.amt), wht: sum(rows, (r) => r.wht), n: sum(rows, (r) => r.n), zero: sum(rows, (r) => r.zero_n) };
  }
  function arAgg() {
    const rows = S.ar.filter((r) => okBr(r.br) && okTy(r.ty));
    const b = {}; AGING.forEach((g) => { b[g.k] = sum(rows.filter((r) => r.bk === g.k), (r) => r.amt); });
    return { rows, b, total: sum(rows, (r) => r.amt), overdue: b[1] + b[2] + b[3] + b[4], n: sum(rows, (r) => r.n), legacy: sum(rows.filter((r) => r.legacy), (r) => r.amt) };
  }
  function cmpPill(cur, prev, label, opts = {}) {
    if (opts.na) return `<span class="pill na" title="${esc(opts.na)}">${label}: ไม่เปรียบเทียบ</span>`;
    if (!prev) return `<span class="pill na">${label}: ไม่มีฐานเทียบ</span>`;
    const ch = (cur - prev) / Math.abs(prev);
    const up = ch >= 0;
    const warn = opts.warn ? ` <span title="${esc(opts.warn)}">⚠</span>` : '';
    return `<span class="pill ${opts.warn ? 'warn' : up ? 'up' : 'down'}" title="${esc(opts.warn || '')}">${up ? '▲' : '▼'} ${label} ${up ? '+' : ''}${nf1.format(ch * 100)}%${warn}</span>`;
  }
  function periodCompare() {
    const { from, to } = S.f;
    const n = monthsBetween(from, to).length;
    const partial = S.partialMonth && to === S.partialMonth;
    const yoyOk = addM(from, -12) >= S.months[0];
    const momFrom = addM(from, -n), momTo = addM(to, -n);
    const momOk = momFrom >= S.months[0];
    const rangeMonths = monthsBetween(from, to), prevMonths = monthsBetween(addM(from, -12), addM(to, -12));
    const pwaGap = rangeMonths.concat(prevMonths).filter((m) => S.pwaMissing.includes(m));
    return { n, partial, yoyOk, momOk, momFrom, momTo, pwaGap };
  }

  // ---------- chart helpers ----------
  function disposeCharts() { S.charts.forEach((c) => c.dispose()); S.charts = []; }
  const baseText = { fontFamily: 'Prompt', color: C.text2, fontSize: 12 };
  const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // ลูกเล่นจาก WMS dashboard เดิม: เส้นกราฟค่อย ๆ ลากเส้น + จุดล่าสุดกระพริบเป็นคลื่น
  function withEffects(opt) {
    const lines = (opt.series || []).filter((x) => x.type === 'line');
    lines.forEach((x) => { x.animationDuration = REDUCED ? 0 : 2400; x.animationEasing = 'cubicInOut'; });
    if (!REDUCED && opt.xAxis && opt.xAxis.data) {
      const cats = opt.xAxis.data;
      lines.filter((x) => !x.noPulse).forEach((x) => {
        let i = x.data.length - 1; while (i >= 0 && x.data[i] == null) i--;
        if (i < 0 || i !== cats.length - 1) return;   // กระพริบเฉพาะเส้นที่มีค่าเดือนล่าสุด
        opt.series.push({ type: 'effectScatter', name: '', data: [[cats[i], x.data[i]]], symbolSize: 9, z: 5, tooltip: { show: false }, legendHoverLink: false, silent: true,
          itemStyle: { color: (x.itemStyle && x.itemStyle.color) || C.navy }, rippleEffect: { scale: 3.2, brushType: 'stroke', period: 2.4 }, showEffectOn: 'render', animationDelay: 2200 });
      });
    }
    if (opt.legend !== undefined && opt.legend.show === false) return opt;
    opt.legend = Object.assign({ top: 0, left: 0, textStyle: { ...baseText, color: C.body, fontSize: 12.5 }, itemWidth: 12, itemHeight: 12, icon: 'roundRect' }, opt.legend || {},
      { data: (opt.series || []).filter((x) => x.type !== 'effectScatter' && !x.noLegend).map((x) => x.name) });
    return opt;
  }
  function chart(el, opt) {
    const c = echarts.init(el, null, { renderer: 'svg' });
    opt = withEffects(opt);
    c.setOption(Object.assign({
      textStyle: baseText, animationDuration: REDUCED ? 0 : 900, animationEasing: 'cubicOut', animationDurationUpdate: 500, animationDelay: (i) => (REDUCED ? 0 : i * 25),
      grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
      legend: { top: 0, left: 0, textStyle: { ...baseText, color: C.body, fontSize: 12.5 }, itemWidth: 12, itemHeight: 12, icon: 'roundRect' },
      tooltip: chartTT(),
    }, opt));
    S.charts.push(c);
    return c;
  }
  const valAxis = (fmt) => ({ type: 'value', axisLabel: { ...baseText, formatter: fmt || ((v) => nf2.format(v / 1e6)) }, splitLine: { lineStyle: { color: C.grid } } });
  const catAxis = (cats) => ({ type: 'category', data: cats, axisTick: { show: false }, axisLine: { lineStyle: { color: C.line } }, axisLabel: { ...baseText } });
  const ttMoney = (unit) => (ps) => {
    const arr = Array.isArray(ps) ? ps : [ps];
    let tot = 0;
    const lines = arr.filter((p) => p.value != null && p.seriesType !== 'effectScatter').map((p) => { tot += Number(p.value) || 0; return `${p.marker}${esc(p.seriesName)} <b style="float:right;margin-left:16px">${unit === 'u' ? int(p.value) : baht(p.value)}</b>`; });
    return `<div style="min-width:220px"><b>${esc(arr[0].axisValueLabel || arr[0].name)}</b><br>${lines.join('<br>')}${arr.length > 1 && !arr.some((p) => p.seriesType === 'line') ? `<br><span style="border-top:1px solid #ddd;display:block;margin-top:4px">รวม <b style="float:right">${unit === 'u' ? int(tot) : baht(tot)}</b></span>` : ''}</div>`;
  };
  // ผสมสี hex สองสี (t = 0..1) ใช้ทำเฉดอ่อนของสีกลุ่ม
  const mixHex = (a, b, t) => { const h = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16)); const A = h(a), B = h(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const barStyle = (color) => ({ color, borderColor: C.surface, borderWidth: 1 });

  // ---------- generic UI ----------
  // การ์ด: ชื่อ 16px + คำอธิบายบรรทัดเดียว · ปุ่ม ตาราง/CSV ชิดขวา · "ตัวกรองที่มีผล" อยู่ใน title ของหัวการ์ด
  // opts.w / opts.min = น้ำหนักและความกว้างต่ำสุดในแถว (.row) · opts.foot = ข้อความสรุปใต้การ์ด · opts.tools = ปุ่มเพิ่มเติม
  function card(id, title, hint, applies, body, opts = {}) {
    const st = (opts.w ? `--w:${opts.w};` : '') + (opts.min ? `--min:${opts.min}px;` : '');
    return `<div class="card ${opts.cls || ''}" id="${id}"${st ? ` style="${st}"` : ''}><div class="card-head"${applies ? ` title="ตัวกรองที่มีผล: ${esc(applies)}"` : ''}><div><h3>${title}</h3>${hint ? `<div class="hint">${hint}</div>` : ''}</div>
      <div class="tools">${opts.tools || ''}${opts.table ? `<button class="btn ghost small" data-tbl="${id}" aria-pressed="false">ตาราง</button>` : ''}${opts.csv ? `<button class="btn ghost small" data-csv="${id}"${opts.csvLabel ? ' title="ไฟล์ CSV มีตัวเลขเต็มหน่วยบาท"' : ''}>${opts.csvLabel || 'CSV'}</button>` : ''}</div></div>
      ${body}${opts.foot ? `<div class="card-foot">${opts.foot}</div>` : ''}</div>`;
  }
  const stripTags = (h) => String(h == null ? '' : h).replace(/<br\s*\/?>/g, ' · ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  // KPI: ชื่อ + ปุ่ม ⓘ (คำอธิบายยาวอยู่ใน title) → ตัวเลขใหญ่ + หน่วย → แถวเปรียบเทียบ (ซ้าย = คำอธิบาย, ขวา = ค่าสี)
  // cmp: สตริง HTML (pill เดิม) หรืออาร์เรย์ [[ป้าย, ค่า HTML, คลาสสี], ...]
  function kpi(label, value, unit, sub, cmp, cls = '', opts = {}) {
    const info = sub ? `<button type="button" class="info" aria-label="คำอธิบาย: ${esc(stripTags(sub))}" title="${esc(stripTags(sub))}"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/><path d="M8 7.2v4M8 4.8v.2"/></svg></button>` : '';
    const rows = Array.isArray(cmp) ? `<div class="rows">${cmp.filter(Boolean).map(([k, v, c]) => `<div><span class="k">${k}</span><span class="v ${c || ''}">${v}</span></div>`).join('')}</div>` : (cmp ? `<div class="cmp">${cmp}</div>` : '');
    return `<div class="card kpi ${cls}"><div class="k-top"><span class="label">${label}</span>${info}</div><div class="value${opts.vcls ? ' ' + opts.vcls : ''}">${value}<span class="unit">${unit || ''}</span></div>${rows}${opts.link ? `<a class="klink" href="${opts.link[0]}">${opts.link[1]}</a>` : ''}</div>`;
  }
  // แถวเปรียบเทียบในการ์ด KPI: ▲ +1.1% (เขียว) / ▼ −3.8% (แดง)
  function cmpRow(label, cur, prev, opts = {}) {
    if (opts.na) return [label, 'ไม่เปรียบเทียบ', 'v-mute'];
    if (!prev) return [label, 'ไม่มีฐานเทียบ', 'v-mute'];
    const ch = (cur - prev) / Math.abs(prev), up = ch >= 0, good = opts.invert ? !up : up;
    return [label, `${up ? '▲ +' : '▼ −'}${nf1.format(Math.abs(ch * 100))}%${opts.warn ? ` <span title="${esc(opts.warn)}">⚠</span>` : ''}`, opts.warn ? 'v-warn' : good ? 'v-good' : 'v-bad'];
  }
  // แถบเล็กในเซลล์ตาราง (เทียบขนาด) — v/max เป็นสัดส่วนของความกว้าง 72px
  function barCell(txt, v, max, color, opts = {}) {
    const w = max > 0 ? Math.max(0, Math.min(1, v / max)) : 0;
    return `<span class="bc"><span class="track"><span class="bar" style="width:${(w * 100).toFixed(1)}%;background:${color || 'var(--accent)'}"></span></span>${opts.after ? '' : ''}<span>${txt}</span></span>`;
  }
  function table(cols, rows, foot, opts = {}) {
    const th = cols.map((c) => `<th class="${c.n ? 'n' : ''}" scope="col">${c.h}</th>`).join('');
    const tr = rows.map((r, i) => `<tr ${opts.click ? `class="click" tabindex="0" data-row="${i}"` : ''}>${cols.map((c) => `<td class="${c.n ? 'n' : ''}${c.nw ? ' nw' : ''}${c.cls ? ' ' + c.cls : ''}"${c.v ? ` data-v="${esc(c.v(r))}"` : ''}>${c.f ? c.f(r) : esc(r[c.k])}</td>`).join('')}</tr>`).join('');
    const tf = foot ? `<tfoot><tr>${cols.map((c, i) => { const f = foot[i]; const o = f && typeof f === 'object'; return `<td class="${c.n ? 'n' : ''}"${o && f.v != null ? ` data-v="${esc(f.v)}"` : ''}>${f == null ? '' : o ? f.h : f}</td>`; }).join('')}</tr></tfoot>` : '';
    if (!rows.length) return '<div class="state">ไม่มีข้อมูลตามตัวกรองที่เลือก</div>';
    return `<div class="tbl-wrap"><table class="t" data-csvable="1"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody>${tf}</table></div>`;
  }
  // ตารางสำรองของกราฟ (สำหรับผู้ที่แยกสีไม่ได้ / ต้องการตัวเลข)
  const tableStore = {};
  function chartTable(id, cats, series, unit) {
    tableStore[id] = { cats, series, unit };
  }
  function wireCardTools(root) {
    root.querySelectorAll('[data-tbl]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.tbl, cardEl = $(id), t = tableStore[id];
      let box = cardEl.querySelector('.alt-table');
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', on);
      if (!on) { if (box) box.remove(); return; }
      if (!t) return;
      const fmt = t.unit === 'u' ? int : t.unit === 'p' ? pct : t.unit === 'p2' ? ((v) => (v == null ? '–' : nf2.format(v))) : baht;
      const cols = [{ h: '', k: 'c' }].concat(t.series.map((s, i) => ({ h: esc(s.name), n: 1, f: (r) => fmt(r.v[i]) })));
      const rows = t.cats.map((c, j) => ({ c, v: t.series.map((s) => s.data[j]) }));
      box = document.createElement('div'); box.className = 'alt-table'; box.style.marginTop = '10px';
      box.innerHTML = table(cols, rows);
      cardEl.insertBefore(box, cardEl.querySelector('.card-foot'));
    }));
    root.querySelectorAll('[data-csv]').forEach((b) => b.addEventListener('click', () => {
      const tbls = [...$(b.dataset.csv).querySelectorAll('table[data-csvable]')];
      if (!tbls.length) return;
      // ทุกตารางในการ์ด (เช่น ตำบลไม้ขาว + ตำบลสาคู) ต่อกัน คั่นด้วยบรรทัดว่างและชื่อหัวตาราง
      const lines = [];
      tbls.forEach((tbl, k) => {
        const h = tbl.closest('.tam') && tbl.closest('.tam').querySelector('h4');
        if (k) lines.push('');
        if (h) lines.push('"' + h.textContent.trim() + '"');
        [...tbl.querySelectorAll('tr')].forEach((tr) => lines.push([...tr.children].map((td) => '"' + (td.dataset.v != null ? td.dataset.v : td.textContent).replace(/"/g, '""').trim() + '"').join(',')));
      });
      const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'HEA_' + b.dataset.csv + '_' + S.asof + '.csv'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }));
  }

  function drill(title, cols, rows, note) {
    $('drill-title').textContent = title;
    $('drill-body').innerHTML = (note ? `<p class="small muted">${note}</p>` : '') + table(cols, rows, null);
    $('drill').showModal();
  }

  // ---------- header ----------
  function renderFresh() {
    const m = S.d.meta, cfg = S.cfg;
    const mode = cfg.mode === 'live'
      ? '<span class="mode live">LIVE</span>เชื่อมต่อฐานข้อมูลโดยตรง (อ่านอย่างเดียว)'
      : `<span class="mode snapshot">SNAPSHOT</span>ข้อมูลชุดคงที่ ไม่ได้เชื่อมต่อสด${cfg.snapshot && cfg.snapshot.db_restored_from ? ' · ' + esc(cfg.snapshot.db_restored_from) : ''}`;
    $('fresh').innerHTML = `${mode}<br>
      ข้อมูลล่าสุดในฐานข้อมูล: ใบแจ้งหนี้ออกถึง <b>${dLabel(m.invoice_last_issue)}</b> (บันทึกล่าสุด ${dLabel(m.invoice_last_created)} ${esc((m.invoice_last_created || '').slice(11))} น.) · ใบเสร็จถึง <b>${dLabel(m.receipt_last)}</b> (บันทึกล่าสุด ${esc((m.receipt_last_created || '').slice(11))} น.)<br>
      วันอ้างอิงลูกหนี้: <b>${dLabel(S.asof)}</b> · เวลาดึงข้อมูล: <b>${S.fetched ? new Date(S.fetched).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }) + ' น.' : '–'}</b>`;
    $('asof-chip').innerHTML = `<span class="mode ${cfg.mode === 'live' ? 'live' : 'snapshot'}">${cfg.mode === 'live' ? 'LIVE' : 'SNAPSHOT'}</span><span id="page-scope"></span> ข้อมูล ณ ${dLabel(cfg.mode === 'live' ? m.receipt_last : S.asof)} · <a href="#fresh">ที่มาของข้อมูล</a>`;
    const msgs = [];
    if (S.f.to === S.partialMonth) msgs.push(`เดือน ${mLong(S.partialMonth)} ยังไม่ครบเดือน (ข้อมูลถึง ${dLabel(S.asof)}) — ไม่แสดงการเปรียบเทียบ MoM/YoY ของช่วงนี้`);
    const banner = $('banner');
    banner.hidden = !msgs.length; banner.innerHTML = msgs.map((x) => '⚠ ' + esc(x)).join('<br>');
  }

  // ================= การจดมาตร (ขั้นที่ 8) =================
  // กติกา: เริ่มจดวันที่ 20 · ต้องจดครบภายในวันสิ้นเดือนเพื่อออกใบแจ้งหนี้ในเดือนนั้น · ดีเลย์ = วันอ้างอิง − วันสิ้นเดือนของรอบ
  const METER_START = 20, METER_WARN_DAYS = 3;
  function pMeter(el) {
    const D = S.d.meter_reading;
    if (!D || !D.summary) { setTitle('การจดมาตรและออกใบแจ้งหนี้'); el.innerHTML = '<div class="state">ยังไม่มีข้อมูลการจดมาตร (ชุดข้อมูล meter_reading)</div>'; return; }
    const sm = D.summary, rnd = D.round.slice(0, 7), y = +rnd.slice(0, 4), mo = +rnd.slice(5, 7);
    const eom = new Date(Date.UTC(y, mo, 0)).getUTCDate(), eomD = `${rnd}-${String(eom).padStart(2, '0')}`;
    const ref = S.asof, dayMs = 86400000;
    const delay = Math.round((Date.parse(ref) - Date.parse(eomD)) / dayMs); // + = เลยกำหนด
    const closed = delay > 0, refDay = ref.slice(0, 7) === rnd ? +ref.slice(8, 10) : (closed ? eom : 0);
    const pend = rowsOf({ cols: D.pending_cols, rows: D.pending || [] });
    // สาเหตุที่เป็นไปได้ของทะเบียนค้างจด (จากวันติดตั้งมาตร ประเภท และประวัติการจด) — เป็นข้อสังเกต ไม่ใช่ข้อสรุป
    const startD = `${rnd}-${String(METER_START).padStart(2, '0')}`;
    const why = (r) => {
      if (r.inst && r.inst >= startD) return { k: 'new', cls: 'info-line', t: `ติดตั้งมาตร ${dLabel(r.inst)} หลังวันเริ่มจดรอบนี้ (${METER_START} ${TH_M[mo - 1]}) — จะเริ่มจดรอบถัดไป` };
      if (r.ty === 'T2.2') return { k: 'pwa', cls: 'info-line', t: 'สัญญาขายส่ง กปภ. สิ้นสุดแล้ว — ทะเบียนยังเป็นสถานะใช้งาน' };
      if (r.reg === MORGAN) return { k: 'manual', cls: 'warn-line', t: 'หมู่บ้านมอร์แกน — ใช้น้ำจริง จดหน่วยแบบแมนนวล ยังไม่ลงใน WMS · รอผู้บริหารพิจารณาวิธีลงระบบ' };
      if (r.binv) return { k: 'billed', cls: 'info-line', t: `ออกใบแจ้งหนี้รอบนี้แล้ว ${dLabel(r.binv)} ตามแบบฟอร์มของสัญญา (ไม่ผ่านการจดมาตรในระบบ)` };
      if (['T2.3', 'T3.1'].includes(r.ty) && !r.last) return { k: 'contract', cls: 'warn-line', t: `${r.ty === 'T2.3' ? 'หอถัง อบต.' : 'ลูกค้าสัญญา'} ไม่เคยจดผ่านระบบ และยังไม่มีใบแจ้งหนี้รอบนี้${r.inst ? ` · ติดตั้งมาตร ${dLabel(r.inst)}` : ''}${r.ncx ? ` · ใบแจ้งหนี้ถูกยกเลิก ${int(r.ncx)} ใบ (ล่าสุด ${dLabel(r.lcx)})` : ''} — ควรตรวจสอบ` };
      if (!r.last) return { k: 'never', cls: 'warn-line', t: `ยังไม่เคยจด${r.inst ? ` ทั้งที่ติดตั้งมาตรตั้งแต่ ${dLabel(r.inst)}` : ` (ลงทะเบียน ${dLabel(r.regd)})`}` };
      return { k: 'late', cls: '', t: `จดล่าสุด ${dLabel(r.last)}` };
    };
    pend.forEach((r) => { r.why = why(r); });
    // บันทึกที่สำนักงาน (มีใบแจ้งหนี้ค่าน้ำในเดือนของรอบตามแบบฟอร์มสัญญา) = นับว่าจดแล้ว และไม่แสดงในรายการค้างจด
    const back = pend.filter((r) => r.why.k === 'billed');
    pend.splice(0, pend.length, ...pend.filter((r) => r.why.k !== 'billed'));
    // นิยาม (ยืนยัน 11/11/69): จด = บันทึกเลขแล้วออกใบแจ้งหนี้ทันทีจากเครื่องโมบาย · บันทึกที่สำนักงาน = ทอท. (ไม่ผ่านเครื่อง)
    // ทะเบียนที่จดในรอบแล้วถูกงดจ่ายน้ำภายหลัง (สถานะไม่ใช่ใช้งาน ณ วันดึงข้อมูล) ยังนับว่าจดแล้ว และนับในฐานทะเบียนที่ต้องจด
    // → จดผ่านเครื่อง + บันทึกที่สำนักงาน = ใบแจ้งหนี้ค่าน้ำในรอบ
    const nCutAfter = sm.read_inactive || 0, nMob = sm.read + nCutAfter;
    const nOut = back.length, readN = nMob + nOut;
    // ติดตั้งมาตรหลังวันเริ่มจด = ยังไม่ครบรอบ ไม่นับเป็นค้างจด และไม่นับในฐานทะเบียนที่ต้องจด (ฝ่ายกลยุทธ์ขอ 11/11/69)
    const newL = pend.filter((r) => r.why.k === 'new'), nNew = newL.length;
    pend.splice(0, pend.length, ...pend.filter((r) => r.why.k !== 'new'));
    const base = sm.reg - nNew + nCutAfter;
    const newTxt = nNew ? `ไม่นับติดตั้งใหม่ ${int(nNew)} ราย (${newL.map((r) => r.reg).join(', ')}) — ติดตั้งหลังวันเริ่มจด จะเริ่มจดรอบถัดไป` : '';
    const WHY_L = { new: 'ติดตั้งมาตรหลังวันเริ่มจด', pwa: 'สัญญา กปภ. สิ้นสุด', contract: 'ลูกค้าสัญญาไม่เคยจดผ่านระบบ', manual: 'จดแมนนวล ยังไม่ลงระบบ', never: 'ยังไม่เคยจด', late: 'ค้างจดจากรอบปกติ' };
    const whySum = Object.entries(WHY_L).map(([k, l]) => [l, pend.filter((r) => r.why.k === k).length]).filter(([, n]) => n).map(([l, n]) => `${l} ${n}`).join(' · ');
    const nPend = Math.max(0, base - readN), pctRead = base ? readN / base : 0;
    const daysLeft = closed ? 0 : eom - refDay;
    const plan = (d) => (d < METER_START ? 0 : Math.min(1, (d - METER_START + 1) / (eom - METER_START + 1)));
    const pp = (v) => nf1.format(v * 100) + '%';
    let kicker, headline, sub, badge;
    if (closed) {
      kicker = `รอบ ${mLong(rnd)} · ปิดรอบ ${dLabel(eomD)}`;
      headline = nPend ? `จดครบ ${pp(pctRead)} — เหลือ ${int(nPend)} ทะเบียนที่ยังไม่ได้จด` : `จดครบ 100% ภายในกำหนด`;
      sub = `ออกใบแจ้งหนี้ค่าน้ำแล้ว ${int(sm.inv)} ใบ${sm.read_no_inv ? ` · อ่านแล้วยังไม่มีบิล ${int(sm.read_no_inv)} ราย` : ` · รับรู้รายได้ค่าน้ำเดือน ${TH_M[mo - 1]} แล้ว`}`;
      badge = nPend ? { cls: 'bad', ic: '!', main: `เลยกำหนด ${delay} วัน`, sub: `${int(nPend)} ราย ยังไม่ได้จด` } : { cls: 'good', ic: '✓', main: 'จดครบ', sub: 'ตามกำหนด' };
    } else if (refDay < METER_START) {
      kicker = `รอบ ${mLong(rnd)} · วันที่ ${refDay}`; headline = `ยังไม่ถึงวันเริ่มจด — เริ่มวันที่ ${METER_START}`; sub = `ต้องจดครบ ${int(sm.reg)} ทะเบียนภายใน ${dLabel(eomD)}`;
      badge = { cls: 'info', ic: 'i', main: `อีก ${METER_START - refDay} วัน`, sub: 'เริ่มจดมาตร' };
    } else {
      const gap = pctRead - plan(refDay), perDay = daysLeft > 0 ? Math.ceil(nPend / daysLeft) : nPend;
      kicker = `รอบ ${mLong(rnd)} · วันที่ ${refDay}`;
      headline = `เหลือ ${daysLeft} วัน — จดแล้ว ${pp(pctRead)} (${gap >= 0 ? 'เร็ว' : 'ช้า'}กว่าแผน ${nf1.format(Math.abs(gap * 100))}%)`;
      sub = `ต้องจดอีกราว ${int(perDay)} ทะเบียน/วัน เพื่อให้ครบภายใน ${dLabel(eomD)}`;
      badge = { cls: daysLeft <= METER_WARN_DAYS && nPend ? 'warn' : 'info', ic: daysLeft <= METER_WARN_DAYS && nPend ? '⚠' : 'i', main: `เหลือ ${daysLeft} วัน`, sub: `ค้างจด ${int(nPend)} ทะเบียน` };
    }
    // ไทม์ไลน์: วันที่ 1 → เริ่มจด 20 → วันอ้างอิง → ครบกำหนดสิ้นเดือน (วันอ้างอิงที่เลยสิ้นเดือนแสดงต่อท้าย)
    const span = eom + Math.max(0, delay) + 1, pos = (d) => ((d - 1) / (span - 1)) * 100;
    const marks = [[1, 'เปิดรอบ 1', 'done'], [METER_START, `เริ่มจด ${METER_START}`, 'done'], [eom, `ครบกำหนด ${eom} ${TH_M[mo - 1]}`, closed ? 'done' : 'todo'], [closed ? eom + delay : refDay, `วันอ้างอิง ${dLabel(ref)}`, 'now']];
    const sevPill = (d) => (d > 0 ? `<span class="pill down">+${d} วัน</span>` : d >= -METER_WARN_DAYS ? `<span class="pill warn">เหลือ ${-d} วัน</span>` : `<span class="pill na">เหลือ ${-d} วัน</span>`);
    const water = sum(S.sales.filter((r) => r.m === rnd && (r.src === 'W' || r.src === 'L')), (r) => r.net);
    // ชื่อพื้นที่การอ่านมาตรจาก WMS · ชื่อยาวตัดด้วย … ชี้เมาส์เห็นชื่อเต็ม
    const AN = D.area_names || {};
    const aName = (id) => (id == null ? 'ไม่ระบุพื้นที่' : AN[id] || `พื้นที่ ${id}`);
    const aCell = (id) => `<span class="trunc" title="${esc(aName(id))}">${esc(aName(id))}</span>`;
    // ที่ตั้งมาตร: "หมู่ N · ตำบล" (จาก 19_reg_moo) · ชื่อพื้นที่จดมาตรอยู่ใน tooltip · ไม่พบหมู่ใช้ชื่อพื้นที่แทน
    const loc = (reg, area, br) => { const v = (S.regMoo || {})[reg]; if (!v) return null; const [m, tb] = v.split('|'); return { m, tb: tb || br }; };
    const locCell = (r) => { const L = loc(r.reg, r.area, r.br);
      if (!L || !L.m) return `${aCell(r.area)}<br><span class="muted small">${esc((L && L.tb) || r.br)}</span>`;
      return `<span title="พื้นที่จดมาตร: ${esc(aName(r.area))}">หมู่ ${esc(L.m)} · ${esc(L.tb)}</span>`; };
    const locV = (r) => { const L = loc(r.reg, r.area, r.br); return (L && L.m ? `หมู่ ${L.m} ${L.tb}` : `${(L && L.tb) || r.br}`) + ` (พื้นที่จดมาตร: ${aName(r.area)})`; };
    const areas = rowsOf({ cols: D.areas_cols, rows: D.areas || [] }), staff = rowsOf({ cols: D.staff_cols, rows: D.staff || [] }), wrong = rowsOf({ cols: D.wrong_cols, rows: D.wrong || [] });
    // ช่องทางจด (ตรวจ 11/11/69): รายการจดที่มีพิกัด GPS = จดหน้างานด้วยเครื่องโมบาย · ไม่มีพิกัด = คีย์จากเคาน์เตอร์ที่สำนักงาน · ทอท. = ไม่มีรายการจด (ออกบิลตามแบบฟอร์มสัญญา)
    const hasGps = staff.length && staff.every((r) => r.gps != null);
    const nGps = hasGps ? sum(staff, (r) => r.gps) : null, nKey = hasGps ? sum(staff, (r) => r.read) - nGps : 0;
    setTitle(`การจดมาตรและออกใบแจ้งหนี้ · รอบ ${mLong(rnd)}`);
    setScope(`จาก WMS · รอบ ${dLabel(D.round)} – ${dLabel(eomD)}`);
    el.innerHTML = `
      <section class="hero" aria-label="สถานะรอบการจดมาตรและออกใบแจ้งหนี้">
        <div class="hero-top"><div class="hero-t"><span class="k">${esc(kicker)}</span><span class="h">${esc(headline)}</span><span class="s">${esc(sub)}</span></div>
          <div class="hero-badge ${badge.cls}"><span class="ic" aria-hidden="true">${badge.ic}</span><div><b>${esc(badge.main)}</b><small>${esc(badge.sub)}</small></div></div></div>
        <div class="hero-prog"><div class="hp-l"><span>จดแล้ว <b>${int(readN)}</b> จาก ${int(base)} ทะเบียน${nNew ? ` <span class="small" style="opacity:.75">(ไม่นับติดตั้งใหม่ ${int(nNew)})</span>` : ''}</span><b>${pp(pctRead)}</b></div>
          <div class="hp-bar" role="img" aria-label="จดแล้ว ${pp(pctRead)}"><i style="width:${(pctRead * 100).toFixed(1)}%"></i>${!closed && refDay >= METER_START ? `<s style="left:${(plan(refDay) * 100).toFixed(1)}%" title="แผน ${pp(plan(refDay))}"></s>` : ''}</div></div>
        <div class="hero-tl" aria-label="ไทม์ไลน์รอบการจด"><div class="tl-line"></div><div class="tl-fill" style="width:${Math.min(100, pos(closed ? eom + delay : Math.max(1, refDay))).toFixed(1)}%"></div>
          ${marks.map(([d, t, c], i) => `<div class="tl-m ${c}${i === 0 ? ' first' : ''}${i === 3 && closed && delay > 0 ? ' late' : ''}" style="left:${pos(d).toFixed(1)}%"><span></span><em>${esc(t)}</em></div>`).join('')}</div>
      </section>
      <div class="kpis">
        ${kpi('จดแล้ว / ทะเบียน', `${int(readN)}`, `/ ${int(base)}`, `จดแล้ว = ทุกทะเบียนที่มีการจดหน่วยในรอบ ไม่ว่าจดหน้างานหรือสำนักงาน = ใบแจ้งหนี้ค่าน้ำในรอบ${hasGps ? ' · หน้างาน = รายการจดที่มีพิกัด GPS จากเครื่องโมบาย · สำนักงาน = คีย์จากเคาน์เตอร์ (ไม่มีพิกัด) และ ทอท. (ออกบิลตามแบบฟอร์มสัญญา)' : ''} · ทะเบียน = ผู้ใช้น้ำสถานะใช้งาน ไม่นับที่ติดตั้งมาตรหลังวันเริ่มจด${nCutAfter ? ` รวม ${int(nCutAfter)} รายที่งดจ่ายน้ำหลังจดในรอบ` : ''}`, [['ของทะเบียนที่ต้องจด', pp(pctRead), 'v-mute'], hasGps ? ['จดหน้างาน (เครื่องโมบาย)', int(nGps) + ' ราย', 'v-mute'] : null, hasGps && (nKey + nOut) ? ['บันทึกที่สำนักงาน', `${int(nKey + nOut)} ราย`, 'v-mute'] : null, nNew ? ['ติดตั้งใหม่ (ยังไม่ครบรอบ ไม่นับ)', int(nNew) + ' ราย', 'v-mute'] : null], 'accent')}
        ${kpi('ค้างจด', int(nPend), 'ราย', `ทะเบียนใช้งานที่ยังไม่มีรายการจดในรอบ${nNew ? ' · ' + newTxt : ''}`, [[closed ? 'ดีเลย์' : 'เหลือ', closed ? `เลยกำหนด ${delay} วัน (ณ ${dLabel(ref)})` : `${daysLeft} วัน`, nPend ? 'v-bad' : 'v-good']], nPend ? 'bad' : '')}
        ${kpi('ออกใบแจ้งหนี้ค่าน้ำ', int(sm.inv), 'ใบ', 'ใบแจ้งหนี้ค่าน้ำที่ออกในเดือนของรอบ (ไม่ยกเลิก) · ควรเท่ากับจำนวนที่จดแล้ว', [['จากรายการจดในระบบ', int(sm.inv_from_read) + ' ใบ', 'v-mute'], sm.inv_no_read ? ['ทอท. (แบบฟอร์มสัญญา)', int(sm.inv_no_read) + ' ใบ', 'v-mute'] : null, ['จดแล้วแต่ยังไม่มีบิล', int(sm.read_no_inv) + ' ราย', sm.read_no_inv ? 'v-bad' : 'v-good']])}
        ${kpi('หน่วยน้ำผิดปกติ', int(sm.wrong), 'ราย', 'อ่านแล้วแต่หน่วยเกิน 200% หรือต่ำกว่า 20% ของค่าเฉลี่ย 3 เดือนก่อน (ตาม WMS)', [['สูงกว่า 200%', int(sm.wrong_hi) + ' ราย', 'v-warn'], ['ต่ำกว่า 20%', int(sm.wrong_lo) + ' ราย', 'v-warn']], '', { vcls: 'v-warn' })}
      </div>
      <div class="row">
        ${card('c-mpend', 'ทะเบียนที่ยังไม่ได้จด', `ต้องจดให้เสร็จภายในวันสิ้นเดือน · ดีเลย์ = วันอ้างอิง − วันสิ้นเดือน · เรียงจากดีเลย์มากไปน้อย${nNew ? ` · ไม่นับติดตั้งใหม่ ${int(nNew)} ราย` : ''}`, '', '<div id="t-mpend"></div>',
          { csv: 1, w: 1.4, min: 620, tools: nPend ? `<span class="pill ${closed ? 'down' : 'warn'}">⚠ ${int(nPend)} ราย${closed ? ' เลยกำหนด' : ''}</span>` : '',
            foot: `<span class="pill warn">เหลือ ≤ ${METER_WARN_DAYS} วัน</span> ใกล้ครบกำหนด · <span class="pill down">+N วัน</span> เลยกำหนดแล้ว — ยังออกบิลไม่ได้ รายได้เดือนนี้ไม่ครบ` })}
        ${card('c-mflow', 'จากจดมาตร ถึงรับรู้รายได้', `กระทบยอดใบแจ้งหนี้ค่าน้ำที่ออกในรอบ ${mLabel(rnd)}`, '', `<ol class="ilist mflow">
            <li><span class="no">1</span><div><div class="t1">ทะเบียนที่ต้องจด</div><div class="d">ผู้ใช้น้ำสถานะใช้งาน ${int(sm.reg)}${nNew ? ` − ติดตั้งใหม่ ${int(nNew)}` : ''}${nCutAfter ? ` + งดจ่ายน้ำหลังจดในรอบ ${int(nCutAfter)}` : ''} · งดจ่ายน้ำ ${int(sm.cut)} ราย ไม่นับ</div></div><span class="mv">${int(base)}</span></li>
            <li><span class="no">2</span><div><div class="t1">จดมาตรแล้ว</div><div class="d">${dLabel(sm.first_read)} – ${dLabel(sm.last_read)} ${hasGps ? ` · หน้างาน ${int(nGps)} + สำนักงาน ${int(nKey + nOut)}${nOut ? ` (คีย์ในระบบ ${int(nKey)} · ทอท. ${int(nOut)})` : ''}` : ''}${nPend ? ` · ค้างจด ${int(nPend)}` : ''}</div></div><span class="mv">${int(readN)}</span></li>
            <li><span class="no">3</span><div><div class="t1">ออกใบแจ้งหนี้ค่าน้ำ</div><div class="d">จากรายการจดในระบบ ${int(sm.inv_from_read)} · ทอท. (แบบฟอร์มสัญญา) ${int(sm.inv_no_read)}${sm.inv === readN ? ' · เท่ากับจำนวนที่จดแล้ว ✓' : ` · ต่างจากจำนวนที่จด ${int(sm.inv - readN)}`}</div></div><span class="mv">${int(sm.inv)}</span></li>
          </ol>
          ${sm.read_no_inv ? `<div class="note-box bad"><span class="ic">!</span><div>อ่านแล้วแต่ยังไม่มีใบแจ้งหนี้ <b>${int(sm.read_no_inv)} ราย</b> — ตรวจใน WMS ก่อนปิดเดือน</div></div>`
            : `<div class="note-box good"><span class="ic">✓</span><div>อ่านแล้วแต่ยังไม่มีใบแจ้งหนี้ = 0 ราย — ทุกมาตรที่จดแล้วออกบิลครบ${water ? ` · รายได้ค่าน้ำ ${mLabel(rnd)} ${mb(water)} ล้านบาท (ไม่รวม VAT)` : ''}</div></div>`}`, { w: 1, min: 440 })}
      </div>
      <div class="row">
        ${card('c-mday', 'ความคืบหน้ารายวัน', `% จดสะสมของทะเบียนใช้งาน เทียบเส้นแผน (เริ่ม ${METER_START} → ครบ 100% วันสิ้นเดือน)`, '', '<div class="chart" id="ch-mday" style="height:260px"></div>', { table: 1, w: 1, min: 520, foot: 'แท่งสีส้ม = ต่ำกว่าแผน · นับตามวันที่จดในรายการจดหน่วยน้ำ' })}
        ${card('c-mstaff', 'พนักงานอ่านมาตร', 'จำนวนทะเบียนที่แต่ละคนจดได้ในรอบ และสัดส่วนของที่จดได้ทั้งหมด · ชื่อย่อเพื่อความเป็นส่วนตัว', '', '<div id="t-mstaff"></div>', { csv: 1, w: 1, min: 520 })}
      </div>
      <div class="row">
        ${card('c-mwrong', 'หน่วยน้ำผิดปกติ', `${int(sm.wrong)} ราย ในรอบนี้ · แสดง 20 รายที่ต่างจากค่าเฉลี่ยมากที่สุด (ลบ.ม.) · รายการทั้งหมดดูได้ใน WMS แผงควบคุมงานอ่านมาตร`, '', '<div id="t-mwrong"></div>', { csv: 1 })}
      </div>
      <div class="row">
        ${card('c-mstuck', 'มิเตอร์ไม่หมุน — จดได้เลขเดิมซ้ำ ≥ 3 รอบติดกัน', `ทะเบียนใช้งาน · นับย้อนจากรอบ ${mLabel(rnd)} · มิเตอร์เสีย หรือไม่มีผู้ใช้น้ำ ต้องให้หน้างานยืนยัน · ตัวเลขน้ำ/รายได้เป็นประมาณการ ถ้ามิเตอร์เสียจริง`, '',
          '<div id="t-mstuck"></div><div id="t-mstuck-all" hidden></div>', { csv: 1, csvLabel: 'CSV (ครบทุกราย)' })}
      </div>
      <div class="row">
        ${card('c-marea', 'ความคืบหน้าตามพื้นที่การอ่านมาตร', 'ทั้งหมด = ทะเบียนที่ต้องจด (นิยามเดียวกับการ์ดด้านบน) · จดได้ รวมบันทึกที่สำนักงาน · ถูกตัดมาตร = งดจ่ายน้ำที่ไม่ได้จดในรอบ · พื้นที่ที่ยังค้างขึ้นก่อน · ชื่อยาวชี้เมาส์เพื่อดูเต็ม', '', '<div id="t-marea"></div>', { csv: 1 })}
      </div>
      <section class="card rules"><h3>กติกาและนิยาม</h3><ul>
        <li>เริ่มจดมาตรวันที่ <b>${METER_START}</b> ของเดือน และต้องจด<b>ครบภายในวันสิ้นเดือน</b> เพื่อออกใบแจ้งหนี้และรับรู้รายได้ในเดือนนั้น</li>
        <li><b>ดีเลย์ (วัน)</b> = วันอ้างอิง − วันสิ้นเดือนของรอบ (บวก = เลยกำหนด) · เหลือ ≤ ${METER_WARN_DAYS} วันแต่ยังค้าง = เหลือง “ใกล้ครบกำหนด” (เกณฑ์ ${METER_WARN_DAYS} วันรอยืนยัน)</li>
        <li><b>ทะเบียน</b> = ผู้ใช้น้ำสถานะใช้งาน (สถานะปัจจุบัน ระบบไม่เก็บประวัติสถานะรายวัน) · <b>อ่านแล้ว</b> = มีรายการจดหน่วยน้ำในรอบ (ไม่ยกเลิก) นับ 1 ครั้งต่อทะเบียน · <b>ค้างอ่าน</b> = ทะเบียน − อ่านแล้ว</li>
        <li><b>จดหน้างาน</b> = รายการจดที่มีพิกัด GPS จากเครื่องโมบาย (บันทึกเลขแล้วออกใบแจ้งหนี้ทันที)</li>
        <li><b>บันทึกที่สำนักงาน</b> = รายการจดที่คีย์จากเคาน์เตอร์ (ไม่มีพิกัด) และทะเบียนที่ไม่มีรายการจดแต่มีใบแจ้งหนี้ค่าน้ำในเดือนของรอบตามแบบฟอร์มสัญญา (ทอท.) — นับว่าจดแล้ว · จดหน้างาน + บันทึกที่สำนักงาน = ใบแจ้งหนี้ค่าน้ำในรอบ</li>
        <li><b>หน่วยน้ำผิดปกติ</b> = ค่าที่ WMS ตั้งไว้ในรายการจด: เกิน 200% หรือต่ำกว่า 20% ของค่าเฉลี่ย 3 เดือนก่อน</li>
        <li>ตัวเลขอาจต่างจากแผงควบคุมใน WMS ได้เล็กน้อย เพราะดึงจากฐานข้อมูลสำรอง ณ ${dLabel(S.asof)} และใช้สถานะทะเบียน ณ วันที่ดึง</li>
      </ul></section>`;
    // ตารางค้างจด
    $('t-mpend').innerHTML = pend.length ? table([
      { h: 'ทะเบียน', nw: 1, k: 'reg' },
      { h: 'ชื่อ / ประเภท · สาเหตุที่เป็นไปได้', cls: 'name', f: (r) => `${esc(r.name || '–')} <span class="muted small">· ${esc(TY_NAME[r.ty] || r.ty)}</span>` + (r.why.cls ? `<span class="${r.why.cls}">${r.why.cls === 'warn-line' ? '⚠ ' : 'ⓘ '}${esc(r.why.t)}</span>` : `<br><span class="muted small">${esc(r.why.t)}</span>`), v: (r) => `${r.name || ''} (${r.ty}) — ${r.why.t}` },
      { h: 'หมู่ · ตำบล', cls: 'area', f: locCell, v: locV },
      { h: 'พนักงานที่รับผิดชอบ', f: (r) => (r.staff ? esc(r.staff) : '<span class="muted small">ไม่มีผู้จดรอบก่อน</span>'), v: (r) => r.staff || '' },
      { h: 'ดีเลย์', nw: 1, f: (r) => (r.why.k === 'new' ? '<span class="pill na">ติดตั้งใหม่</span>' : r.why.k === 'billed' ? '<span class="pill up">ออกบิลแล้ว</span>' : sevPill(delay)) + `<br><span class="muted small">ครบกำหนด ${dLabel(eomD)}</span>`, v: (r) => (r.why.k === 'new' ? 'ติดตั้งใหม่' : r.why.k === 'billed' ? 'ออกบิลแล้ว' : delay) },
    ], pend) : '<div class="state">จดครบทุกทะเบียนแล้ว</div>';
    if (pend.length) $('t-mpend').insertAdjacentHTML('afterbegin', `<div class="info-line" style="margin:0 0 10px;font-size:13px;padding:6px 10px">ⓘ <b>สาเหตุที่เป็นไปได้:</b> ${esc(whySum)}</div>`);
    // รายวัน (สะสม)
    const byDay = {}; (D.daily || []).forEach(([d, n]) => { byDay[+d.slice(8, 10)] = n; });
    const dlist = []; let cum = 0; for (let d = METER_START; d <= eom; d++) { cum += byDay[d] || 0; dlist.push({ d, v: base ? cum / base : 0, n: byDay[d] || 0 }); }
    const early = sum(Object.keys(byDay).filter((d) => +d < METER_START), (d) => byDay[d]);
    if (early) dlist.forEach((x) => { x.v += early / base; });
    const shown = dlist.filter((x) => closed || x.d <= refDay);
    const ds = [{ name: 'จดสะสม', type: 'bar', barMaxWidth: 26, itemStyle: { borderRadius: [3, 3, 0, 0], color: (p) => (shown[p.dataIndex] && shown[p.dataIndex].v + 1e-9 < plan(shown[p.dataIndex].d) ? C.orange : C.navy) }, data: shown.map((x) => Math.round(x.v * 1000) / 1000) },
      { name: 'แผน', type: 'line', noPulse: true, symbol: 'none', lineStyle: { type: 'dashed', width: 2, color: C.text2 }, itemStyle: { color: C.text2 }, data: shown.map((x) => Math.round(plan(x.d) * 1000) / 1000) }];
    chart($('ch-mday'), { xAxis: catAxis(shown.map((x) => String(x.d))), yAxis: { ...valAxis((v) => nf0.format(v * 100) + '%'), max: 1 }, series: ds, tooltip: { ...chartTT(), valueFormatter: (v) => pp(v) } });
    chartTable('c-mday', shown.map((x) => `${x.d} ${TH_M[mo - 1]} (${int(x.n)} ราย)`), ds.map((x) => ({ name: x.name, data: x.data })), 'p');
    // ตามพื้นที่
    // ปรับให้ตรงกับการ์ดหลัก: ไม่นับติดตั้งใหม่ในทั้งหมด · บันทึกที่สำนักงาน (ทอท.) นับว่าจดได้ → ค้างรวม = ค้างจดในการ์ดหลัก
    areas.forEach((r) => { r.all -= newL.filter((x) => x.area === r.area).length; const nb = back.filter((x) => x.area === r.area).length; r.read += nb; r.inv += nb; });
    areas.sort((a, b) => (b.all - b.read) - (a.all - a.read)); areas.splice(0, areas.length, ...areas.filter((r) => r.all > 0));
    $('t-marea').innerHTML = table([
      { h: 'พื้นที่', cls: 'area', f: (r) => aCell(r.area), v: (r) => aName(r.area) }, { h: 'ทั้งหมด', n: 1, f: (r) => int(r.all) }, { h: 'จดได้', n: 1, f: (r) => int(r.read) },
      { h: 'ค้าง', n: 1, f: (r) => (r.all - r.read > 0 ? `<b class="v-bad">${int(r.all - r.read)}</b>` : '<span class="muted">0</span>'), v: (r) => r.all - r.read }, { h: 'ถูกตัดมาตร', n: 1, f: (r) => int(r.cut) }, { h: 'ออกใบแจ้งหนี้', n: 1, f: (r) => int(r.inv) },
      { h: 'ความคืบหน้า', cls: 'bar-cell', f: (r) => barCell(pp(r.all ? r.read / r.all : 0), r.all ? r.read / r.all : 0, 1, r.all - r.read > 0 ? C.orange : C.navy), v: (r) => pp(r.all ? r.read / r.all : 0) },
    ], areas, ['รวม', int(sum(areas, (r) => r.all)), int(sum(areas, (r) => r.read)), int(sum(areas, (r) => r.all - r.read)), int(sum(areas, (r) => r.cut)), int(sum(areas, (r) => r.inv)), '']);
    // พนักงาน
    // ระบบมอบหมายเส้นทางยังใช้ไม่เต็มที่ → แสดงจำนวนที่จดได้และสัดส่วนต่อยอดจดทั้งหมด (ปรับ 11/11/69)
    const sTot = sum(staff, (r) => r.read), sMax = Math.max(1, ...staff.map((r) => r.read));
    const stf = staff.slice().sort((a, b) => b.read - a.read);
    $('t-mstaff').innerHTML = table([
      { h: 'พนักงาน', nw: 1, k: 'staff' }, { h: 'พื้นที่', n: 1, f: (r) => int(r.areas) },
      { h: 'จดได้ (ทะเบียน)', n: 1, f: (r) => `<b>${int(r.read)}</b>`, v: (r) => r.read },
      { h: 'สัดส่วนที่จดได้', cls: 'bar-cell', f: (r) => barCell(`<b>${pp(sTot ? r.read / sTot : 0)}</b>`, r.read, sMax), v: (r) => (sTot ? round2(r.read / sTot * 100) : '') },
    ].concat(hasGps ? [{ h: 'ช่องทาง', nw: 1, f: (r) => (r.gps === r.read ? '<span class="muted">หน้างาน</span>' : !r.gps ? '<span class="pill na">สำนักงาน</span>' : `<span class="muted">หน้างาน ${int(r.gps)} · </span><span class="pill na">สำนักงาน ${int(r.read - r.gps)}</span>`), v: (r) => (r.gps === r.read ? 'หน้างาน' : !r.gps ? 'สำนักงาน' : `หน้างาน ${r.gps} / สำนักงาน ${r.read - r.gps}`) }] : []),
    stf, ['รวม', '', int(sTot), '100%'].concat(hasGps ? [`หน้างาน ${int(nGps)} · สำนักงาน ${int(nKey)}`] : [])) + (nOut ? `<div class="muted small" style="margin-top:6px">+ ทอท. ออกบิลตามแบบฟอร์มสัญญา (ไม่มีรายการจด) ${int(nOut)} ราย = จดแล้วทั้งหมด ${int(sTot + nOut)} ราย${sm.inv === sTot + nOut ? ' = ใบแจ้งหนี้ค่าน้ำในรอบ ✓' : ''}${hasGps ? ' · หน้างาน = มีพิกัด GPS จากเครื่องโมบาย · สำนักงาน = คีย์จากเคาน์เตอร์ (ไม่มีพิกัด)' : ''}</div>` : '');
    // หน่วยผิดปกติ
    $('t-mwrong').innerHTML = table([
      { h: 'ทะเบียน', nw: 1, k: 'reg' }, { h: 'ชื่อ', cls: 'name', f: (r) => esc(r.name || '–') }, { h: 'ประเภท', nw: 1, f: (r) => esc(TY_NAME[r.ty] || r.ty) }, { h: 'วันที่จด', nw: 1, f: (r) => dLabel(r.date), v: (r) => r.date },
      { h: 'เลขเดิม → ใหม่', nw: 1, n: 1, f: (r) => `${esc(r.prev)} → ${esc(r.cur)}`, v: (r) => `${r.prev}->${r.cur}` }, { h: 'หน่วย', n: 1, f: (r) => `<b>${int(+r.units)}</b>`, v: (r) => r.units }, { h: 'เฉลี่ย 3 เดือน', n: 1, f: (r) => int(r.avg3) },
      { h: '% ของเฉลี่ย', n: 1, f: (r) => (r.pct == null ? '–' : `<span class="pill ${r.pct > 200 ? 'down' : 'warn'}">${r.pct > 200 ? '▲' : '▼'} ${nf0.format(r.pct)}%</span>`), v: (r) => r.pct },
    ], wrong);
    // มิเตอร์ไม่หมุน (ใช้ 0 ลบ.ม. ติดกัน ≥ 3 รอบ) — ประมาณการน้ำ/รายได้ที่อาจไม่ได้วัด จากค่าเฉลี่ยก่อนหยุดหมุน × บาท/ลบ.ม. เฉลี่ยของประเภท
    const MS = S.d.meter_stuck;
    if (MS && MS.rows) {
      const ga = revAgg(), gy = Number(S.d.revenue_groups.window[1].slice(0, 4));
      const tyP = {}; const pOf = (ty) => { if (!(ty in tyP)) { const a = ga(ty, gy); tyP[ty] = a.units ? a.wnet / a.units : null; } return tyP[ty]; };
      const st = rowsOf(MS).filter((r) => okBr(r.br)).map((r) => ({ ...r, avg: r.avg_before ? +r.avg_before : 0, p: pOf(r.ty) }));
      // ใช้น้ำครั้งเดียวคือรอบแรกของข้อมูล (ส.ค. 68) = หน่วยรอบแรกอาจเป็นยอดสะสมตอนย้ายระบบ → ไม่ใช้ประมาณการ
      st.forEach((r) => { r.weak = r.avg > 0 && r.n_rounds - r.streak === 1 && r.last_use === MS.first_round; const a = r.weak ? 0 : r.avg; r.q = a * r.streak; r.b = r.p ? r.q * r.p : 0; r.bm = r.p ? a * r.p : 0; });
      const used = st.filter((r) => r.avg > 0).sort((a, b) => b.b - a.b), never = st.filter((r) => !r.avg);
      const nWeak = used.filter((r) => r.weak).length;
      const nNewI = never.filter((r) => r.inst && r.inst >= MS.first_round).length;
      const bk = [['3–5 รอบ', (r) => r.streak < 6], ['6–11 รอบ', (r) => r.streak >= 6 && r.streak < 12], ['12 รอบขึ้นไป', (r) => r.streak >= 12]].map(([l, f]) => [l, used.filter(f).length]);
      const mx = Math.max(1, ...bk.map((x) => x[1]));
      const cols = [
        { h: 'ทะเบียน', nw: 1, k: 'reg' },
        { h: 'ชื่อ / ประเภท', cls: 'name', f: (r) => `${esc(r.name || '–')} <span class="muted small">· ${esc(TY_NAME[r.ty] || r.ty)}</span>`, v: (r) => `${r.name || ''} (${r.ty})` },
        { h: 'หมู่ · ตำบล', cls: 'area', f: locCell, v: locV },
        { h: 'ใช้ 0 ติดกัน', nw: 1, f: (r) => `<span class="pill ${r.streak >= 6 ? 'down' : 'warn'}">${r.streak} รอบ</span><br><span class="muted small">ตั้งแต่ ${mLabel(r.since.slice(0, 7))}</span>`, v: (r) => r.streak },
        { h: 'ใช้ครั้งล่าสุด', nw: 1, f: (r) => (r.last_use ? mLabel(r.last_use.slice(0, 7)) : '<span class="muted small">ไม่พบตั้งแต่ ' + mLabel(MS.first_round.slice(0, 7)) + '</span>'), v: (r) => r.last_use || '' },
        { h: 'เฉลี่ยก่อนหยุด<br>ลบ.ม./เดือน', n: 1, f: (r) => (r.avg ? nf1.format(r.avg) + (r.weak ? '<br><span class="muted small" title="มีข้อมูลก่อนหยุดแค่รอบแรก (ส.ค. 68) ซึ่งอาจเป็นยอดสะสมตอนย้ายระบบ จึงไม่นำมาประมาณการ">ข้อมูลไม่พอ</span>' : '') : '–'), v: (r) => r.avg || '' },
        { h: 'เลขมาตรล่าสุด', n: 1, nw: 1, f: (r) => esc(r.cu ?? '–'), v: (r) => r.cu ?? '' },
        { h: 'น้ำที่อาจไม่ได้วัด<br>ลบ.ม. (สะสม)', n: 1, f: (r) => (r.q ? int(r.q) : '–'), v: (r) => Math.round(r.q) },
        { h: 'รายได้ที่อาจขาด<br>บาท (สะสม)', n: 1, f: (r) => (r.b ? `<b>${int(r.b)}</b>` : '–'), v: (r) => Math.round(r.b) },
      ];
      const tot = (f) => sum(used, f);
      const kp = (l, v, u, s2, cls = '') => `<div class="ms-k ${cls}"><div class="l">${l}</div><div class="v">${v}<small> ${u}</small></div><div class="s">${s2}</div></div>`;
      $('t-mstuck').innerHTML = `<div class="ms-kpis">
          ${kp('เคยใช้น้ำ แล้วเลขไม่ขยับ', int(used.length), 'ราย', `จาก ${int(MS.n_read)} รายที่จดรอบนี้ · ${bk.map(([l, n]) => `${l} ${n}`).join(' · ')}`, 'bad')}
          ${kp('น้ำที่อาจไม่ได้วัด', int(tot((r) => (r.weak ? 0 : r.avg))), 'ลบ.ม./เดือน', `สะสม ≈ ${int(tot((r) => r.q))} ลบ.ม. ตั้งแต่เริ่มใช้ 0${nWeak ? ` · ไม่รวม ${nWeak} รายที่ข้อมูลไม่พอ` : ''}`)}
          ${kp('รายได้ที่อาจขาด (ประมาณ)', mb(tot((r) => r.bm)), 'ล้านบาท/เดือน', `สะสม ≈ ${mb(tot((r) => r.b))} ล้านบาท · คิดที่บาท/ลบ.ม. เฉลี่ยของประเภท${nWeak ? ` · ไม่รวม ${nWeak} รายที่ข้อมูลไม่พอ` : ''}`)}
          ${kp('ไม่พบการใช้น้ำเลย', int(never.length), 'ราย', `0 ทุกรอบตั้งแต่ ${mLabel(MS.first_round.slice(0, 7))} หรือตั้งแต่ติดตั้ง${nNewI ? ` (ติดตั้งใหม่ ${nNewI})` : ''} · บ้านว่าง/ยังไม่เข้าอยู่?`)}
        </div>
        <div class="ms-bars">${bk.map(([l, n]) => `<div class="ms-b"><span>${l}</span><i style="width:${(n / mx) * 100}%"></i><b>${int(n)} ราย</b></div>`).join('')}</div>
        <div class="info-line" style="margin:8px 0 10px">ⓘ แสดง 20 รายที่ประมาณรายได้ที่อาจขาดสะสมสูงสุด · CSV มีครบทุกราย รวมรายที่ไม่พบการใช้น้ำเลย (เรียงลำดับใหม่ได้ใน Excel)</div>
        ${table(cols, used.slice(0, 20)).replace('data-csvable="1"', '')}`;
      $('t-mstuck-all').innerHTML = table(cols, used.concat(never.sort((a, b) => b.streak - a.streak)));
    } else $('t-mstuck').innerHTML = '<div class="state">ยังไม่มีข้อมูลมิเตอร์ไม่หมุน (ชุดข้อมูล meter_stuck)</div>';
  }
  // ---------- pages ----------
  // ซ่อนหน้า ภาพรวมผู้บริหาร (pOverview) และ คุณภาพข้อมูล (pQuality) ตามที่ผู้ใช้ขอ — โค้ดยังอยู่ เปิดกลับได้โดยเพิ่มใน PAGES และเมนู
  const PAGES = { snapshot: pSnapshot, revenue: pRevenue, sales: pSales, usage: pUsage, customers: pCustomers, collections: pCollections, meter: pMeter };
  // หัวหน้าแต่ละหน้า: ชื่อ + ตัวกรองที่มีผลกับหน้านั้นเท่านั้น
  const PAGE_META = {
    snapshot: { t: 'Executive Snapshot', f: ['to', 'br', 'ty'], toL: 'เดือนรายงาน' },
    revenue: { t: 'รายได้ตามกลุ่มลูกค้า', f: ['from', 'to', 'br', 'ty', 'moo'] },
    usage: { t: 'การใช้น้ำเทียบปีก่อน', f: ['from', 'to', 'br', 'ty'] },
    sales: { t: 'ยอดขายและการใช้น้ำ', f: ['from', 'to', 'br', 'ty', 'moo'] },
    customers: { t: 'ลูกค้า', f: ['from', 'to', 'br', 'ty'] },
    collections: { t: 'การจัดเก็บและลูกหนี้', f: ['from', 'to', 'br', 'ty', 'asof'] },
    meter: { t: 'การจดมาตรและออกใบแจ้งหนี้', f: [] },
  };
  // บรรทัดเล็กใต้ชื่อหน้า: SNAPSHOT · <ขอบเขตของหน้า> · ข้อมูล ณ … · ที่มาของข้อมูล
  const setScope = (t) => { const e = $('page-scope'); if (e) e.textContent = t ? ' ' + t + ' ·' : ''; };
  const setTitle = (t) => { $('page-title').textContent = t; document.title = t + ' · HEA Sales Executive Dashboard'; };
  function render(opts = {}) {
    readTheme();
    disposeCharts();
    const meta = PAGE_META[S.page] || PAGE_META.snapshot;
    document.querySelectorAll('#filters [data-f]').forEach((l) => { l.hidden = !meta.f.includes(l.dataset.f); });
    $('f-to-l').textContent = meta.toL || 'ถึงเดือน';
    document.querySelector('.pf-links').hidden = !meta.f.length;
    $('head-tools').innerHTML = '';
    setTitle(meta.t);
    renderFresh();
    document.querySelectorAll('#nav a').forEach((a) => { if (a.dataset.page === S.page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const el = $('page');
    try { PAGES[S.page](el); } catch (e) { console.error(e); el.innerHTML = `<div class="card state err">แสดงผลไม่สำเร็จ: ${esc(e.message)}</div>`; }
    wireCardTools(el);
    // ลูกเล่น: การ์ดค่อย ๆ เลื่อนขึ้นเมื่อเปลี่ยนหน้า และตัวเลข KPI นับขึ้น
    el.classList.remove('enter');
    if (opts.enter && !REDUCED) { el.querySelectorAll('.card, .sec-title').forEach((c, i) => c.style.setProperty('--i', Math.min(i, 14))); void el.offsetWidth; el.classList.add('enter'); }
    if (!opts.still) countUp(el);
  }
  let kpiRun = 0;
  function countUp(root) {
    const run = ++kpiRun;
    if (REDUCED) return;
    root.querySelectorAll('.kpi .value').forEach((v) => {
      const node = v.firstChild;
      if (!node || node.nodeType !== 3) return;
      const txt = node.nodeValue.trim(), m = txt.match(/^(-?)([\d,]+)(\.(\d+))?(%?)$/);
      if (!m) return;
      const target = Number(m[2].replace(/,/g, '') + (m[3] || '')) * (m[1] ? -1 : 1), dec = m[4] ? m[4].length : 0, pctSign = m[5];
      const fmt = new Intl.NumberFormat('th-TH', { minimumFractionDigits: dec, maximumFractionDigits: dec });
      const t0 = performance.now(), dur = 1800;   // ตัวเลขวิ่ง 1.8 วินาที แบบ ease-out เหมือน WMS dashboard เดิม
      node.nodeValue = fmt.format(0) + pctSign;
      const step = (t) => {
        if (run !== kpiRun) { node.nodeValue = txt; return; }   // วาดใหม่ระหว่างวิ่ง: จบที่ค่าจริงทันที
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        node.nodeValue = k < 1 ? fmt.format(target * e) + pctSign : txt;   // จบที่ค่าจริงเสมอ
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
  function initTheme() {
    const btns = document.querySelectorAll('.seg button');
    const sync = () => { const p = window.HEATheme ? HEATheme.get() : 'auto'; btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.t === p))); };
    btns.forEach((b) => b.addEventListener('click', () => { if (window.HEATheme) HEATheme.set(b.dataset.t); }));
    document.addEventListener('hea-theme', () => { sync(); if (S.d.meta) render({ still: true }); });
    sync();
  }

  const APPLY_SALES = 'ช่วงเดือน · สาขา (ตำบล) · ประเภทลูกค้า';

  function pOverview(el) {
    const { from, to } = S.f, pc = periodCompare();
    const cur = salesAgg(from, to);
    const yoy = pc.yoyOk ? salesAgg(addM(from, -12), addM(to, -12)) : null;
    const mom = pc.momOk ? salesAgg(pc.momFrom, pc.momTo) : null;
    const coll = collAgg(from, to), collY = pc.yoyOk ? collAgg(addM(from, -12), addM(to, -12)) : null;
    const ar = arAgg();
    const naPartial = pc.partial ? 'ช่วงที่เลือกมีเดือนที่ยังไม่ครบ ข้อมูลรายเดือนไม่สามารถเทียบวันเดียวกันได้' : null;
    const pwaWarn = pc.pwaGap.length ? 'ไม่มีรายได้ กปภ.: ' + pwaTxt(pc.pwaGap) + ' — เทียบกับช่วงที่ยังมี กปภ.' : null;
    const ytdFrom = to.slice(0, 4) + '-01';
    const ytd = salesAgg(ytdFrom, to), ytdP = addM(ytdFrom, -12) >= S.months[0] ? salesAgg(addM(ytdFrom, -12), addM(to, -12)) : null;
    const per = `${mLabel(from)}${from !== to ? ' – ' + mLabel(to) : ''}`;
    const custActive = latestActive(to);
    const ratio = cur.billWaterInclVat ? coll.water / cur.billWaterInclVat : null;
    const cohort = cohortAgg(from, to);

    el.innerHTML = `
      <h2 class="sec-title">ผู้บริหารควรรู้ (ข้อมูลถึง ${mLabel(S.lastFull)})</h2>
      ${ceoBlock()}
      <h2 class="sec-title">สรุปช่วง ${per}</h2>
      <div class="grid g4">
        ${kpi('ยอดขายสุทธิ (ไม่รวม VAT)', mb(cur.net), 'ล้านบาท', `ค่าน้ำ ${mb(cur.water)} · บริการ ${mb(cur.service)} · งานขาย ${mb(cur.fee)} · ลดหนี้ ${mb(cur.cn)}`,
          cmpPill(cur.net, mom && mom.net, `เทียบ ${pc.n} เดือนก่อนหน้า`, { na: naPartial || (!mom && 'ไม่มีข้อมูลก่อนหน้า'), warn: pwaWarn }) + cmpPill(cur.net, yoy && yoy.net, 'YoY', { na: naPartial || (!yoy && 'ไม่มีข้อมูลปีก่อนในฐานข้อมูลช่วงนี้'), warn: pwaWarn }), 'accent')}
        ${kpi('ปริมาณน้ำที่ออกใบแจ้งหนี้', int(cur.units), 'ลบ.ม.', `คิดเงิน ${int(cur.units - cur.free)} · ฟรี ${int(cur.free)} ลบ.ม.${cur.legacyNoUnits ? ' · ไม่รวมหน่วยลูกค้ารายใหญ่ระบบเดิม' : ''}`,
          cmpPill(cur.units, yoy && yoy.units, 'YoY', { na: naPartial || (!yoy && 'ไม่มีข้อมูลปีก่อน') || (cur.legacyNoUnits || (yoy && yoy.legacyNoUnits) ? 'ใบแจ้งหนี้ลูกค้ารายใหญ่ระบบเดิมไม่มีหน่วยน้ำ เทียบปริมาณไม่ได้' : null) }), 'accent')}
        ${kpi('ยอดรับชำระตามใบเสร็จ (รวม VAT)', mb(coll.total), 'ล้านบาท', `ค่าน้ำ ${mb(coll.water)} · งานขาย ${mb(coll.fee)} · เงินประกัน ${mb(coll.bond)} · ภาษีหัก ณ ที่จ่าย ${baht(coll.wht)} บาท`,
          cmpPill(coll.total, collY && collY.total, 'YoY', { na: naPartial || (!collY && 'ไม่มีข้อมูลปีก่อน') }), 'accent')}
        ${kpi('ลูกหนี้ค่าน้ำคงค้าง', mb(ar.total), 'ล้านบาท', `เกินกำหนด ${mb(ar.overdue)} ล้านบาท (${pct(ar.total ? ar.overdue / ar.total : null)}) ณ ${dLabel(S.asof)}`, '', 'accent')}
      </div>
      <div class="grid g4" style="margin-top:16px">
        ${kpi('สัดส่วนรับชำระต่อยอดแจ้งหนี้ (ค่าน้ำ)', pct(ratio), '', 'รับชำระค่าน้ำในช่วง ÷ ใบแจ้งหนี้ค่าน้ำในช่วง (รวม VAT) — ต่างรุ่นกัน ไม่ใช่อัตราเก็บเงิน')}
        ${kpi('อัตราเก็บเงินรายรุ่น (ใบแจ้งหนี้ระบบใหม่)', pct(cohort.billed ? cohort.paid / cohort.billed : null), '', cohort.billed ? `ใบแจ้งหนี้ออก ${cohort.mFrom ? mLabel(cohort.mFrom) + '–' + mLabel(cohort.mTo) : ''} ชำระแล้วถึง ${dLabel(S.asof)} · ตรงเวลา ${pct(cohort.ontime / cohort.billed)}` : 'มีข้อมูลตั้งแต่ มี.ค. 69 (ระบบใหม่)')}
        ${kpi('ยอดขายสะสมทั้งปี (YTD)', mb(ytd.net), 'ล้านบาท', `${mLabel(ytdFrom)} – ${mLabel(to)}${to === S.lastFull ? ` · ประมาณการทั้งปี ${mb(forecastYear().fc)} ล้านบาท` : ''}`, cmpPill(ytd.net, ytdP && ytdP.net, 'YTD เทียบปีก่อน', { na: naPartial || (!ytdP && 'ไม่มีข้อมูลปีก่อนครบ'), warn: monthsBetween(ytdFrom, to).some((m) => S.pwaMissing.includes(m)) ? 'มีเดือนที่ไม่มีรายได้ กปภ. (หน้าแล้ง/สัญญาสิ้นสุด)' : null }))}
        ${kpi('เป้ายอดขาย', 'ยังไม่กำหนดเป้า', '', 'ไม่มีข้อมูลเป้าในระบบ — จึงไม่แสดง % เทียบเป้า', '', 'target')}
      </div>
      <div class="grid g3" style="margin-top:16px">
        ${card('c-trend', 'ยอดขายสุทธิรายเดือนแยกสาขา (ล้านบาท)', 'แท่ง = เดือนในช่วงที่เลือก · เส้น = เดือนเดียวกันปีก่อน (ทุกสาขาที่เลือกรวมกัน)', APPLY_SALES, '<div class="chart tall" id="ch-trend"></div>', { cls: 'span2', table: 1 })}
        ${card('c-issues', 'ประเด็นที่ควรติดตาม', 'คัดจากข้อมูลจริงตามเกณฑ์ที่ระบุในแต่ละข้อ', 'สาขา (บางข้อ)', `<ul class="issues">${issues().map((x) => `<li><span class="ic ${x.lvl}" aria-hidden="true">${x.lvl === 'bad' ? '!' : x.lvl === 'warn' ? '⚠' : 'i'}</span><div><b>${x.t}</b><br><span class="small">${x.d}</span></div></li>`).join('')}</ul>`)}
      </div>
      <div class="grid g2" style="margin-top:16px">
        ${card('c-arov', 'อายุลูกหนี้ค่าน้ำ ณ ' + dLabel(S.asof), 'ใบแจ้งหนี้สถานะค้างชำระ แยกตามจำนวนวันเกินกำหนด (ล้านบาท)', 'สาขา (ตำบล) · ประเภทลูกค้า · วันอ้างอิงลูกหนี้', '<div class="chart" id="ch-arov"></div>', { table: 1 })}
        ${card('c-custov', 'ลูกค้าที่ออกใบแจ้งหนี้ค่าน้ำรายเดือน (ราย)', 'นับรายผู้ใช้น้ำที่มีใบแจ้งหนี้ค่าน้ำในเดือน · ' + (custActive ? `${mLabel(to)}: ${int(custActive)} ราย` : ''), APPLY_SALES, '<div class="chart" id="ch-custov"></div>', { table: 1 })}
      </div>
      <div class="grid" style="margin-top:16px">
        ${card('c-gap', 'ข้อมูลที่ยังขาดสำหรับการตัดสินใจ', 'ถ้ามีข้อมูลเหล่านี้ dashboard จะตอบคำถามเรื่องกำไรและกำลังผลิตได้', '', table([{ h: 'ข้อมูล', k: 0 }, { h: 'ทำไมสำคัญ', k: 1 }, { h: 'แหล่งที่ต้องขอ', k: 2 }], GAPS))}
      </div>`;

    // trend chart
    const months = monthsBetween(from, to);
    const brs = chartBranches((b) => S.sales.some((r) => r.br === b && inR(r.m, from, to)));
    const series = brs.map((b) => ({ name: b, type: 'bar', stack: 's', barMaxWidth: 34, itemStyle: barStyle(brColor(b)), data: months.map((m) => round2(sum(S.sales.filter((r) => r.m === m && brG(r.br) === b && okBr(r.br) && okTy(r.ty)), (r) => r.net))) }));
    const prevLine = { name: 'ปีก่อน (เดือนเดียวกัน)', type: 'line', noPulse: true, symbolSize: 7, lineStyle: { width: 2, type: 'dashed', color: C.text2 }, itemStyle: { color: C.text2 },
      data: months.map((m) => { const pm = addM(m, -12); return pm >= S.months[0] ? round2(sum(S.sales.filter((r) => r.m === pm && okBr(r.br) && okTy(r.ty)), (r) => r.net)) : null; }) };
    const all = series.concat([prevLine]);
    chart($('ch-trend'), { xAxis: catAxis(months.map((m) => mLabel(m) + (S.pwaMissing.includes(m) ? ' ⚠' : ''))), yAxis: valAxis(), series: all, tooltip: { ...chartTT(), formatter: ttMoney() } });
    chartTable('c-trend', months.map(mLabel), all.map((s) => ({ name: s.name, data: s.data })));
    arChart('ch-arov', 'c-arov', ar);
    custChart('ch-custov', 'c-custov', from, to);
  }
  const round2 = (v) => Math.round(v * 100) / 100;
  function chartTT() { return { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: C.surface, textStyle: { fontFamily: 'Prompt', color: C.body, fontSize: 13 }, borderColor: C.line, confine: true }; }

  function latestActive(m) { return sum(S.cust.filter((r) => r.m === m && okBr(r.br) && okTy(r.ty)), (r) => r.active); }
  function cohortAgg(a, b) {
    const rows = S.cohort.filter((r) => inR(r.m, a, b) && okBr(r.br));
    const ms = rows.map((r) => r.m).sort();
    return { billed: sum(rows, (r) => r.billed), paid: sum(rows, (r) => r.paid), ontime: sum(rows, (r) => r.ontime), open: sum(rows, (r) => r.open), mFrom: ms[0], mTo: ms[ms.length - 1], rows };
  }
  function arChart(elId, cardId, ar) {
    const brs = chartBranches((b) => ar.rows.some((r) => r.br === b));
    const series = AGING.map((g) => ({ name: g.name, type: 'bar', stack: 'a', barMaxWidth: 46, itemStyle: barStyle(g.color), data: brs.map((b) => round2(sum(ar.rows.filter((r) => brG(r.br) === b && r.bk === g.k), (r) => r.amt))) }));
    chart($(elId), { legend: chartLegend(), grid: { left: 8, right: 16, top: 64, bottom: 8, containLabel: true }, xAxis: valAxis(), yAxis: catAxis(brs), series, tooltip: { ...chartTT(), formatter: ttMoney() } });
    chartTable(cardId, brs, series.map((s) => ({ name: s.name, data: s.data })));
  }
  const chartLegend = () => ({ top: 0, left: 0, textStyle: { ...baseText, color: C.body, fontSize: 12.5 }, itemWidth: 12, itemHeight: 12, icon: 'roundRect' });
  function custChart(elId, cardId, from, to) {
    const months = monthsBetween(from, to);
    const brs = chartBranches((b) => S.cust.some((r) => r.br === b && inR(r.m, from, to)));
    const series = brs.map((b) => ({ name: b, type: 'line', symbolSize: 8, lineStyle: { width: 2 }, itemStyle: { color: brColor(b) },
      endLabel: { show: true, formatter: (p) => nf0.format(p.value), color: brColor(b), fontFamily: 'Prompt', fontWeight: 600, fontSize: 12 },
      data: months.map((m) => sum(S.cust.filter((r) => r.m === m && brG(r.br) === b && okBr(r.br) && okTy(r.ty)), (r) => r.active) || null) }));
    chart($(elId), { grid: { left: 8, right: 52, top: 36, bottom: 8, containLabel: true }, xAxis: catAxis(months.map(mLabel)), yAxis: { ...valAxis((v) => nf0.format(v)), scale: true }, series, tooltip: { ...chartTT(), axisPointer: { type: 'line' }, formatter: ttMoney('u') } });
    chartTable(cardId, months.map(mLabel), series.map((s) => ({ name: s.name, data: s.data })), 'u');
  }

  function issues() {
    const out = [];
    const ar = arAgg();
    const debt = S.debt.filter((r) => okBr(r.br) && okTy(r.ty));
    if (debt[0]) {
      const d = debt[0];
      out.push({ lvl: 'bad', t: `ลูกหนี้เกินกำหนดสูงสุด: ${esc(d.name)} ${mb(d.overdue)} ล้านบาท`, d: `${pct(ar.overdue ? d.overdue / ar.overdue : null)} ของยอดเกินกำหนดทั้งหมด · ${d.n} ใบ · เก่าสุดครบกำหนด ${dLabel(d.oldest)}` });
    }
    const recent = monthsBetween(addM(S.lastFull, -5), S.lastFull).filter((m) => S.pwaMissing.includes(m));
    if (recent.length && okTy('T2.2') && okBr('ไม้ขาว')) {
      out.push({ lvl: 'warn', t: `กปภ. (T2.2) ไม่มีรายได้ ${recent.length} เดือน: ${recent.map(mLabel).join(', ')}`, d: 'พ.ค. 69 ไม่มีการส่งน้ำให้ กปภ. (ช่วงแล้ง) และสัญญาขายส่งสิ้นสุดหลัง ก.ค. 69 — รายได้หายราว 1.5–2 ล้านบาทต่อเดือน ต้องหาลูกค้าแทน (ดูหน้า “รายได้ตามกลุ่มลูกค้า”)' });
    }
    const lf = S.lastFull, ly = addM(lf, -12);
    if (ly >= S.months[0]) {
      const a = salesAgg(lf, lf), b = salesAgg(ly, ly);
      if (b.net) {
        const ch = (a.net - b.net) / b.net;
        out.push({ lvl: ch < -0.1 ? 'bad' : 'info', t: `ยอดขาย ${mLabel(lf)} ${ch >= 0 ? 'เพิ่ม' : 'ลดลง'} ${nf1.format(Math.abs(ch * 100))}% เทียบ ${mLabel(ly)}`, d: `${mb(a.net)} เทียบ ${mb(b.net)} ล้านบาท (ไม่รวม VAT)${S.pwaMissing.includes(lf) ? ' · เดือนนี้ไม่มีรายได้ กปภ. (' + pwaWhy(lf) + ')' : ''}` });
      }
    }
    if (ar.b[4]) out.push({ lvl: 'warn', t: `หนี้ค่าน้ำเกิน 90 วัน ${mb(ar.b[4])} ล้านบาท`, d: `ในนี้เป็นหนี้จากระบบเดิม (ออกก่อน มี.ค. 69) ${mb(sum(ar.rows.filter((r) => r.bk === 4 && r.legacy), (r) => r.amt))} ล้านบาท บางรายผู้ใช้น้ำถูกงดจ่ายน้ำแล้ว ควรพิจารณาติดตามหรือตั้งสำรอง` });
    const dn = S.decl.filter((r) => okBr(r.br) && okTy(r.ty));
    if (dn.length) out.push({ lvl: 'info', t: `ลูกค้าที่ยอดลดลง ≥ 30% มี ${S.f.br || S.f.ty ? dn.length + ' ราย (ตามตัวกรอง)' : S.d.declines.n_match + ' ราย'}`, d: 'เกณฑ์: ยอด 3 เดือนเต็มล่าสุดเทียบช่วงเดียวกันปีก่อน ฐานปีก่อน ≥ 15,000 บาท' + (dn.some((r) => KNOWN[r.cw] && KNOWN[r.cw]()) ? ` · ในนี้ ${dn.filter((r) => KNOWN[r.cw] && KNOWN[r.cw]()).length} รายเกิดจากการออกบิล/ย้ายทะเบียน (มีหมายเหตุในตาราง)` : '') + ' — ดูรายชื่อที่หน้า “ลูกค้าและการเติบโต”' });
    return out.slice(0, 5);
  }

  function pSales(el) {
    const { from, to } = S.f;
    const months = monthsBetween(from, to);
    const cur = salesAgg(from, to);
    setScope(`${mLabel(from)}${from !== to ? ' – ' + mLabel(to) : ''} · ไม่รวม VAT`);
    // สะพานตัวเลข: ก่อนส่วนลด − ส่วนลด − ใบลดหนี้ = สุทธิ (ใบลดหนี้เก็บเป็นค่าลบ จึงแสดงค่าสัมบูรณ์)
    const tile = (label, v, sub, cls = '', vcls = '') => `<div class="card kpi ${cls}"><div class="k-top"><span class="label">${label}</span></div><div class="value ${vcls}">${mb(v)}<span class="unit">ล้านบาท</span></div><div class="ksub">${sub}</div></div>`;
    el.innerHTML = `
      <section class="bridge" aria-label="จากยอดขายก่อนส่วนลดถึงยอดขายสุทธิ">
        ${tile('ยอดขายก่อนส่วนลด', cur.gross, 'ค่าน้ำ + ค่าบริการ + งานขาย (ไม่รวม VAT)')}
        <div class="op" aria-hidden="true">−</div>
        ${tile('ส่วนลด', cur.disc, 'ส่วนลดในใบแจ้งหนี้ค่าน้ำ (รวมน้ำฟรี) ถอด VAT ตามสัดส่วน')}
        <div class="op" aria-hidden="true">−</div>
        ${tile('ใบลดหนี้', Math.abs(cur.cn), 'ลงตามวันที่ออก (รายงาน WMS ลงตามวันที่นำมาใช้)', '', 'v-bad')}
        <div class="op" aria-hidden="true">=</div>
        ${tile('ยอดขายสุทธิ (ไม่รวม VAT)', cur.net, `${int(cur.docs)} เอกสาร`, 'target')}
      </section>
      <div class="row">
        ${card('c-comp', 'ยอดขายสุทธิรายเดือน ตามประเภทรายได้', 'ล้านบาท · ใบลดหนี้และส่วนลดแสดงเป็นค่าติดลบใต้เส้น 0', APPLY_SALES, '<div class="chart" id="ch-comp"></div>', { table: 1, min: 520 })}
        ${card('c-units', 'ปริมาณน้ำที่ออกใบแจ้งหนี้', 'พัน ลบ.ม. · คิดเงิน + น้ำฟรี · ลูกค้ารายใหญ่ระบบเดิม (ก่อน มี.ค. 69) ไม่มีข้อมูลหน่วย', APPLY_SALES, '<div class="chart" id="ch-units"></div>', { table: 1, min: 520 })}
      </div>
      <div class="row">
        ${card('c-type', 'ยอดขายสุทธิตามประเภทลูกค้า', 'ล้านบาท · ประเภทตามทะเบียนผู้ใช้น้ำปัจจุบัน', 'ช่วงเดือน · สาขา (ตำบล) · ประเภทลูกค้า', '<div id="t-type"></div>', { csv: 1, min: 560 })}
        ${card('c-moo2', 'ยอดค่าน้ำตามหมู่', 'ล้านบาท · เฉพาะใบแจ้งหนี้ค่าน้ำ (ไม่รวมงานขาย ใบลดหนี้ และลูกค้ารายใหญ่ระบบเดิม) · แต่ละตำบลแสดงเฉพาะหมู่ของตัวเอง', 'ช่วงเดือน · สาขา (ตำบล) · ประเภทลูกค้า · หมู่', '<div id="t-moo2"></div>', { csv: 1, min: 560, foot: 'หมู่ตามทะเบียนผู้ใช้น้ำ (ที่ตั้งมาตร) ถ้าทะเบียนไม่ระบุหรือตำบลไม่ตรงจึงใช้ที่อยู่ในใบแจ้งหนี้ แล้วจึงชื่อพื้นที่จดมาตร · “ไม่ระบุหมู่” = ทะเบียนและใบแจ้งหนี้ไม่มีเลขหมู่ในตำบลไม้ขาว/สาคู · ยังไม่ใช้ DMA เพราะการผูก DMA ในทะเบียนยังไม่ครบ' })}
      </div>
      <div class="row">
        ${card('c-top', 'ลูกค้า 15 รายแรกตามยอดขาย 12 เดือนเต็มล่าสุด', `${dLabel(S.d.top_customers.window[0])} – ${dLabel(S.d.top_customers.window[1])} · ล้านบาท · <b>10 รายแรก = ${pct(S.d.top_customers.top10_net / S.d.top_customers.total_net)}</b> ของยอดขายค่าน้ำทุกสาขา (ไม่รวมงานขาย) · คลิกแถวเพื่อดูเอกสารต้นทาง`, 'สาขา (ตำบล) · ประเภทลูกค้า (ช่วงเดือนไม่มีผล)', '<div id="t-top"></div>', { csv: 1 })}
      </div>`;
    const comp = [
      ['ค่าน้ำ', C.navy, (m) => salesAgg(m, m).water],
      ['ค่าบริการรายเดือน', C.sky, (m) => salesAgg(m, m).service],
      ['งานขาย/บริการอื่น', C.oliveChart, (m) => salesAgg(m, m).fee],
      ['ส่วนลด', C.disc, (m) => -salesAgg(m, m).disc],
      ['ใบลดหนี้', C.neutral, (m) => salesAgg(m, m).cn],
    ].map(([name, color, f]) => ({ name, type: 'bar', stack: 'c', barMaxWidth: 34, itemStyle: barStyle(color), data: months.map((m) => round2(f(m))) }));
    chart($('ch-comp'), { legend: { ...chartLegend(), type: 'scroll' }, xAxis: catAxis(months.map(mLabel)), yAxis: valAxis(), series: comp, tooltip: { ...chartTT(), formatter: ttMoney() } });
    chartTable('c-comp', months.map(mLabel), comp.map((s) => ({ name: s.name, data: s.data })));
    const us = [
      { name: 'คิดเงิน', type: 'bar', stack: 'u', barMaxWidth: 34, itemStyle: barStyle(C.navy), data: months.map((m) => { const a = salesAgg(m, m); return a.units - a.free; }) },
      { name: 'น้ำฟรี', type: 'bar', stack: 'u', barMaxWidth: 34, itemStyle: barStyle(C.sky), data: months.map((m) => salesAgg(m, m).free) },
    ];
    chart($('ch-units'), { xAxis: catAxis(months.map((m) => mLabel(m) + (salesAgg(m, m).legacyNoUnits ? '*' : ''))), yAxis: valAxis((v) => nf0.format(v / 1000) + 'k'), series: us, tooltip: { ...chartTT(), formatter: ttMoney('u') } });
    chartTable('c-units', months.map(mLabel), us.map((s) => ({ name: s.name, data: s.data })), 'u');

    // by type
    const types = S.types.filter(okTy);
    const trows = types.map((t) => { const rows = S.sales.filter((r) => inR(r.m, from, to) && okBr(r.br) && r.ty === t); return { t, net: sum(rows, (r) => r.net), units: sum(rows.filter((r) => r.src === 'W'), (r) => r.units), docs: sum(rows, (r) => r.docs) }; }).filter((r) => r.docs).sort((a, b) => b.net - a.net);
    const tot = sum(trows, (r) => r.net);
    const tMax = Math.max(0, ...trows.map((r) => (tot ? r.net / tot : 0)));
    $('t-type').innerHTML = table([
      { h: 'ประเภท', nw: 1, f: (r) => esc(TY_NAME[r.t] || r.t) },
      { h: 'ยอดขายสุทธิ', n: 1, f: (r) => `<b>${mb(r.net)}</b>`, v: (r) => round2(r.net) },
      { h: 'สัดส่วน', cls: 'bar-cell', f: (r) => barCell(pct(tot ? r.net / tot : null), tot ? r.net / tot : 0, tMax), v: (r) => pct(tot ? r.net / tot : null) },
      { h: 'ลบ.ม.', n: 1, f: (r) => int(r.units) },
      { h: 'เอกสาร', n: 1, f: (r) => int(r.docs) },
    ], trows, ['รวม', { h: mb(tot), v: round2(tot) }, tot ? '100.0%' : '', int(sum(trows, (r) => r.units)), int(sum(trows, (r) => r.docs))]);

    // ยอดค่าน้ำตามหมู่ แยกตำบล (แทน DMA)
    const mrows = S.mooM.filter((r) => inR(r.m, from, to) && MOO_BR.includes(r.br) && okBr(r.br) && okTy(r.ty) && okMoo(r.br, r.moo));
    const nMon = monthsBetween(from, to).length;
    const mAll = Math.max(1, ...Object.values(mrows.reduce((a, r) => { const k = r.br + '|' + r.moo; a[k] = (a[k] || 0) + r.net; return a; }, {})));
    $('t-moo2').innerHTML = '<div class="tam2">' + MOO_BR.filter(okBr).map((br) => {
      const g = {}; mrows.filter((r) => r.br === br).forEach((r) => { const x = g[r.moo] || (g[r.moo] = { moo: r.moo, net: 0, units: 0, docs: 0, cust: 0, con: {} }); x.net += r.net; x.units += r.units; x.docs += r.docs; x.cust += r.cust;
        if (['T2.2', 'T3.1'].includes(r.ty)) x.con[r.ty] = (x.con[r.ty] || 0) + r.net; });
      const rs = Object.values(g).sort((a, b) => mooNum(a.moo) - mooNum(b.moo));
      if (!rs.length) return '';
      const tn = sum(rs, (r) => r.net), tu = sum(rs, (r) => r.units);
      return `<div class="tam"><div class="tam-h"><h4>ตำบล${esc(br)}</h4><span>รวม <b>${mb(tn)}</b> ล้านบาท · ${int(tu)} ลบ.ม.</span></div>` + table([
        { h: 'หมู่', f: (r) => { const cn = Object.entries(r.con).filter(([, v]) => v > 0), cs = sum(cn, ([, v]) => v);
            return esc(r.moo) + (r.moo === 'ไม่ระบุหมู่' ? ' <span class="pill warn">รอตรวจสอบ</span>' : '') + (r.net && cs / r.net >= 0.3 ? `<span class="warn-line">⚠ ${pct(cs / r.net)} เป็นลูกค้าสัญญา (${cn.map(([t]) => esc((TY_NAME[t] || t).replace(/^T[\d.]+ /, ''))).join(', ')})</span>` : ''); }, v: (r) => r.moo },
        { h: 'ค่าน้ำสุทธิ', cls: 'bar-cell', f: (r) => barCell(`<b>${mb(r.net)}</b>`, r.net, mAll, brColor(br)), v: (r) => round2(r.net) },
        { h: 'ลบ.ม.', n: 1, f: (r) => int(r.units) }, { h: 'บาท/ลบ.ม.', n: 1, f: (r) => (r.units ? nf2.format(r.net / r.units) : '–') },
        { h: 'ผู้ใช้น้ำ/เดือน', n: 1, f: (r) => int(r.cust / nMon), v: (r) => Math.round(r.cust / nMon) }, { h: 'ใบแจ้งหนี้', n: 1, f: (r) => int(r.docs) },
      ], rs, ['รวม', { h: mb(tn), v: round2(tn) }, int(tu), tu ? nf2.format(tn / tu) : '–', int(sum(rs, (r) => r.cust) / nMon), int(sum(rs, (r) => r.docs))]) + '</div>';
    }).join('') + '</div>';
    if (!mrows.length) $('t-moo2').innerHTML = '<div class="state">ไม่มีข้อมูลตามตัวกรองที่เลือก (ข้อมูลหมู่มีเฉพาะตำบลไม้ขาวและสาคู)</div>';

    const top = S.top.filter((r) => okBr(r.br) && okTy(r.ty));
    $('t-top').innerHTML = table([
      { h: '#', n: 1, f: (r) => `<span class="rank">${r.rk}</span>`, v: (r) => r.rk }, { h: 'ทะเบียน', nw: 1, cls: 'muted', k: 'reg' }, { h: 'ชื่อ', f: nameCell, cls: 'name' }, { h: 'สาขา', nw: 1, cls: 'muted', k: 'br' }, { h: 'ประเภท', nw: 1, f: (r) => esc(TY_NAME[r.ty] || r.ty) },
      { h: '12 เดือนล่าสุด', n: 1, f: (r) => `<b>${mb(r.net)}</b>`, v: (r) => round2(r.net) }, { h: '12 เดือนก่อนหน้า', n: 1, cls: 'muted', f: (r) => mb(r.prev), v: (r) => round2(r.prev) },
      { h: 'เปลี่ยนแปลง', n: 1, f: (r) => r.prev ? cmpPill(r.net, r.prev, '') : '–' },
      { h: 'ลบ.ม.', n: 1, f: (r) => int(r.units) }, { h: 'ค้างชำระ (บาท)', n: 1, f: (r) => (r.ar ? `<span class="${r.ar >= 1e6 ? 'v-bad' : ''}" style="font-weight:${r.ar >= 1e6 ? 600 : 400}">${baht(r.ar)}</span>` : '–'), v: (r) => round2(r.ar || 0) },
    ], top, null, { click: 1 });
    $('t-top').querySelectorAll('tr.click').forEach((tr) => {
      const open = () => { const r = top[tr.dataset.row]; drillCustomer(r); };
      tr.addEventListener('click', open); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
    });
  }
  const SRC_NAME = { W: 'ใบแจ้งหนี้ค่าน้ำ', L: 'ใบแจ้งหนี้ระบบเดิม (งานขาย)', C: 'ใบลดหนี้', F: 'ใบแจ้งหนี้งานขาย' };
  const ST_NAME = { paymented: 'ชำระแล้ว', pending: 'ค้างชำระ', fully_used: 'ใช้หักแล้ว', issued: 'ออกแล้ว' };
  function drillCustomer(r) {
    const docs = S.drill.filter((x) => x.cw === r.cw);
    drill(`${r.reg} · ${r.name}`, [
      { h: 'วันที่', nw: 1, f: (x) => dLabel(x.date) }, { h: 'เลขที่เอกสาร', nw: 1, k: 'doc' }, { h: 'ประเภทเอกสาร', f: (x) => SRC_NAME[x.src] || x.src },
      { h: 'สถานะ', nw: 1, f: (x) => ST_NAME[x.status] || esc(x.status) }, { h: 'ลบ.ม.', n: 1, f: (x) => int(x.units) }, { h: 'ยอดไม่รวม VAT (บาท)', n: 1, f: (x) => baht(x.net) },
    ], docs, `เอกสาร 12 เดือนเต็มล่าสุด (${docs.length} ฉบับ) รวม ${baht(sum(docs, (x) => x.net))} บาท`);
  }

  function pCustomers(el) {
    const { from, to } = S.f;
    const months = monthsBetween(from, to);
    const act = latestActive(to), actY = addM(to, -12) >= S.months[0] ? latestActive(addM(to, -12)) : null;
    // ลูกค้าใหม่ = ใบแจ้งหนี้ค่าน้ำใบแรกในช่วง · กปภ./ทอท./หอถัง อบต. (T2.2/T3.1/T2.3) ใบแรกในระบบใหม่เป็นการย้ายเข้าระบบ ไม่ใช่ลูกค้าใหม่ → แยกออก
    const NEWX = ['T2.2', 'T2.3', 'T3.1'];
    const nr = S.cust.filter((r) => inR(r.m, from, to) && okBr(r.br) && okTy(r.ty));
    const newAll = sum(nr, (r) => r.new), newMv = sum(nr.filter((r) => NEWX.includes(r.ty)), (r) => r.new), newc = newAll - newMv;
    const newTy = {}; nr.filter((r) => !NEWX.includes(r.ty)).forEach((r) => { newTy[r.ty] = (newTy[r.ty] || 0) + r.new; });
    const newTop = Object.entries(newTy).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
    const newBr = (b) => sum(nr.filter((r) => r.br === b && !NEWX.includes(r.ty)), (r) => r.new);
    // ยอดขายของลูกค้าใหม่: ใบแจ้งหนี้ค่าน้ำของรายที่ใบแรกอยู่ในช่วง นับเฉพาะยอดที่เกิดในช่วงเดียวกัน (ไม่รวม VAT) · fee = งานขาย (ค่าติดตั้ง ฯลฯ)
    const nrv = S.newRev.filter((r) => inR(r.fm, from, to) && inR(r.m, from, to) && okBr(r.br) && okTy(r.ty) && !NEWX.includes(r.ty));
    const nrNet = sum(nrv, (r) => r.net), nrFee = sum(nrv, (r) => r.fee), nrUnits = sum(nrv, (r) => r.units);
    const nrLast = sum(nrv.filter((r) => r.m === to), (r) => r.net), nrLastN = sum(nrv.filter((r) => r.m === to), (r) => r.n);
    const nrTy = {}; nrv.forEach((r) => { const x = nrTy[r.ty] || (nrTy[r.ty] = { net: 0, fee: 0 }); x.net += r.net; x.fee += r.fee; });
    const watAll = sum(S.sales.filter((r) => (r.src === 'W' || r.src === 'L') && inR(r.m, from, to) && okBr(r.br) && okTy(r.ty)), (r) => r.net);
    const st = S.custStatus.filter((r) => okBr(r.br) && okTy(r.ty));
    const stBy = (s) => sum(st.filter((r) => r.status === s), (r) => r.n);
    const tc = S.d.top_customers;
    setScope(`${mLabel(from)}${from !== to ? ' – ' + mLabel(to) : ''}`);
    el.innerHTML = `
      <div class="kpis">
        ${kpi('ลูกค้าที่ออกใบแจ้งหนี้ค่าน้ำ', int(act), 'ราย', `จำนวนผู้ใช้น้ำที่มีใบแจ้งหนี้ค่าน้ำในเดือน ${mLabel(to)} (ไม่รวมลูกค้ารายใหญ่ที่ออกบิลในระบบงานขายก่อน มี.ค. 69)`, [S.f.to === S.partialMonth ? ['YoY', 'เดือนไม่ครบ', 'v-mute'] : !actY ? ['YoY', 'ไม่มีข้อมูลปีก่อน', 'v-mute'] : cmpRow('YoY', act, actY), ['เดือน', mLabel(to), 'v-mute']], 'accent')}
        ${kpi('ลูกค้าใหม่', int(newc), 'ราย', `ผู้ใช้น้ำที่ใบแจ้งหนี้ค่าน้ำใบแรกออกในช่วง ${mLabel(from)} – ${mLabel(to)} · ไม้ขาว ${int(newBr('ไม้ขาว'))} · สาคู ${int(newBr('สาคู'))}${newMv ? ` · ไม่นับ ${int(newMv)} ทะเบียนลูกค้าสัญญา (กปภ./หอถัง อบต./ทอท.) ที่แค่ย้ายเข้าระบบใหม่` : ''}`,
          newTop.slice(0, 3).map(([t, n]) => [esc(TY_NAME[t] || t), `${int(n)} ราย (${pct(newc ? n / newc : 0)})`, 'v-mute']))}
        ${kpi('ยอดขายจากลูกค้าใหม่', mb(nrNet + nrFee), 'ล้านบาท', `ไม่รวม VAT · ลูกค้าใหม่ ${int(newc)} ราย (ใบแจ้งหนี้ค่าน้ำใบแรกใน ${mLabel(from)} – ${mLabel(to)}) นับยอดที่เกิดในช่วงเดียวกัน · ค่าน้ำ ${baht(nrNet)} บาท (${int(nrUnits)} ลบ.ม.) + งานขาย เช่นค่าติดตั้ง ${baht(nrFee)} บาท · ไม่รวมทะเบียนลูกค้าสัญญาที่ย้ายเข้าระบบใหม่`,
          [['ค่าน้ำ', `${mb(nrNet)} ล้าน (${pct(watAll ? nrNet / watAll : 0)} ของค่าน้ำรวม)`, 'v-mute'], ['งานขาย/ค่าติดตั้ง', mb(nrFee) + ' ล้าน', 'v-mute'], [`ค่าน้ำ ${mLabel(to)}`, `${int(nrLast)} บาท (${int(nrLastN)} ราย)`, 'v-mute']])}
        ${kpi('ทะเบียนผู้ใช้น้ำปัจจุบัน', int(sum(st, (r) => r.n)), 'ราย', `ใช้งาน ${int(stBy('active'))} · งดจ่ายน้ำ ${int(stBy('disconnected'))} · ยกเลิก ${int(stBy('closed'))} · รอติดตั้ง ${int(stBy('pending_install'))}`, [['ใช้งาน', int(stBy('active')) + ' ราย', 'v-mute'], ['ยกเลิก', int(stBy('closed')) + ' ราย', 'v-mute']])}
        ${kpi('การกระจุกตัวของรายได้', pct(tc.top10_net / tc.total_net), '', `ลูกค้า 10 รายแรก จาก ${int(tc.n_cust)} รายที่มียอด (ยอดค่าน้ำ 12 เดือนล่าสุด ทุกสาขา ไม่รวมงานขาย ไม่ขึ้นกับตัวกรอง)`, [['ของรายได้', '10 รายแรก', 'v-mute'], ['20 รายแรก', pct(tc.top20_net / tc.total_net), 'v-mute']])}
      </div>
      <div class="row">
        ${card('c-act', 'ลูกค้าที่ออกใบแจ้งหนี้ค่าน้ำรายเดือน', 'ราย · ไม่รวมลูกค้ารายใหญ่ที่ออกบิลในระบบงานขายก่อน มี.ค. 69', APPLY_SALES, '<div class="chart" id="ch-act"></div>', { table: 1, min: 520 })}
        ${card('c-new', 'ลูกค้าใหม่รายเดือน แยกประเภท', `ราย · แท่งสี = ลูกค้าใหม่ (ใบแจ้งหนี้ใบแรก) แยกประเภท · แท่งเทา = ทะเบียนใหม่${newTop.length ? ` · มาจาก ${newTop.slice(0, 3).map(([t, n]) => `${TY_NAME[t] || t} ${pct(newc ? n / newc : 0)}`).join(' · ')}` : ''}`, 'ช่วงเดือน · สาขา (ตำบล) · ประเภท (ทะเบียนใหม่: ช่วงเดือนเท่านั้น)', '<div class="chart" id="ch-new"></div>', { table: 1, min: 520 })}
      </div>
      <div class="row">
        ${card('c-st', 'สถานะทะเบียนผู้ใช้น้ำตามประเภท', 'ราย · สถานะ ณ วันที่ดึงข้อมูล · ลูกค้าใหม่ = ใบแจ้งหนี้ค่าน้ำใบแรกในช่วงเดือนที่เลือก', 'สาขา (ตำบล) · ประเภทลูกค้า', '<div id="t-st"></div>', { csv: 1, w: 1.3, min: 620, foot: '<span id="st-foot"></span>' })}
        ${card('c-pipe', 'คำร้องขอติดตั้งมิเตอร์ที่รอเข้าระบบ', 'คำร้องที่ยังไม่เสร็จ · อายุนับถึงวันอ้างอิง', 'สาขา (ตำบล)', '<div id="pipe-sum"></div>', { w: 1, min: 420 })}
      </div>
      <div class="row">
        ${card('c-pipet', 'คำร้องติดตั้งมิเตอร์ แยกสถานะ สาขา และประเภทที่ขอ', 'เรียงตามจำนวนรายที่เกิน 60 วัน · ฝ่ายกลยุทธ์ใช้ติดตามคิวติดตั้ง', 'สาขา (ตำบล)', '<div id="t-pipe"></div>', { csv: 1 })}
      </div>
      <div class="row">
        ${card('c-decl', 'รายการเฝ้าระวัง: ลูกค้าที่ยอดลดลง', `เกณฑ์: ยอดขายสุทธิ ${dLabel(S.d.declines.window[0])}–${dLabel(S.d.declines.window[1])} ลดลง ≥ 30% เทียบ ${dLabel(S.d.declines.window[2])}–${dLabel(S.d.declines.window[3])} และฐานปีก่อน ≥ 15,000 บาท · พบ ${S.d.declines.n_match} ราย แสดง 20 รายที่ยอดลดมากสุด`, 'สาขา (ตำบล) · ประเภทลูกค้า (ช่วงเดือนไม่มีผล)', '<div id="t-decl"></div>', { csv: 1 })}
      </div>`;
    custChart('ch-act', 'c-act', from, to);
    const P = pipeAgg();
    if (P) { const KN = { '1_residence': 'บ้านพักอาศัย', '2_rent_room': 'ห้องเช่า', '2_shop_household': 'ร้านค้า/บ้าน', '2_empty_land': 'ที่ดินเปล่า', '2_government': 'หน่วยงานราชการ', '2_other': 'อื่น ๆ', '3_public_company': 'บริษัทมหาชน', '3_large_business': 'ธุรกิจขนาดใหญ่', '?': 'ไม่ระบุ' };
      const STN = { pending: 'รอดำเนินการ', processing: 'กำลังดำเนินการ', approved: 'อนุมัติแล้ว รอติดตั้ง' };
      const g = {}; P.open.forEach((r) => { const k = r.status + '|' + r.br + '|' + r.k; const x = g[k] || (g[k] = { ...r, n: 0, over60: 0, age: 0 }); x.age += r.avg_age * r.n; x.n += r.n; x.over60 += r.over60; });
      const rows = Object.values(g).sort((a, b) => b.over60 - a.over60 || b.n - a.n);
      const ageMax = Math.max(90, ...rows.map((r) => r.age / r.n)) * 1.05;
      $('t-pipe').innerHTML = table([
        { h: 'สถานะ', nw: 1, f: (r) => esc(STN[r.status] || r.status) }, { h: 'สาขา', nw: 1, k: 'br' }, { h: 'ประเภทที่ขอ', f: (r) => esc(KN[r.k] || r.k) },
        { h: 'ราย', n: 1, f: (r) => int(r.n) },
        { h: 'อายุเฉลี่ย (วัน)', cls: 'bar-cell', f: (r) => { const a = r.age / r.n; return `<span class="agebar"><span class="track"><i class="${a > 60 ? 'bad' : ''}" style="width:${(a / ageMax * 100).toFixed(1)}%"></i><s style="left:${(60 / ageMax * 100).toFixed(1)}%"></s></span><b>${int(a)}</b></span>`; }, v: (r) => Math.round(r.age / r.n) },
        { h: 'เกิน 60 วัน', n: 1, f: (r) => (r.over60 ? `<span class="pill warn">⚠ ${int(r.over60)}</span>` : '<span class="muted">0</span>'), v: (r) => r.over60 },
      ], rows, ['รวม', '', '', int(P.nOpen), 'เส้นประ = 60 วัน', int(P.over60)]);
      // สรุป: ตัวเลขใหญ่ 3 ตัว + แถบตามสถานะ (ส่วนเกิน 60 วันเป็นสีแดง)
      const bySt = ['processing', 'pending', 'approved'].map((k) => { const x = P.open.filter((r) => r.status === k); return { k, n: sum(x, (r) => r.n), o: sum(x, (r) => r.over60) }; });
      const mx = Math.max(1, ...bySt.map((x) => x.n));
      const brN = (b) => sum(P.open.filter((r) => r.br === b), (r) => r.n);
      const res = P.open.filter((r) => r.k === '1_residence' && r.br === 'ไม้ขาว');
      $('pipe-sum').innerHTML = `<div class="big3"><div class="b"><div class="l">ค้างทั้งหมด</div><div class="n">${int(P.nOpen)} <small>ราย</small></div></div><div class="b"><div class="l">เกิน 60 วัน</div><div class="n v-bad">${int(P.over60)} <small>ราย</small></div></div><div class="b"><div class="l">ติดตั้งเสร็จเฉลี่ย</div><div class="n">${nf1.format(P.perMonth)} <small>ราย/เดือน</small></div></div></div>
        <div class="pbars">${bySt.map((x) => `<span>${esc(STN[x.k])}</span><span class="pb" role="img" aria-label="${esc(STN[x.k])} ${x.n} ราย เกิน 60 วัน ${x.o} ราย"><i class="ok" style="width:${((x.n - x.o) / mx * 100).toFixed(1)}%"></i><i class="od" style="width:${(x.o / mx * 100).toFixed(1)}%"></i></span><span class="pn"><b>${int(x.n)}</b> <span class="v-bad">(${int(x.o)})</span></span>`).join('')}</div>
        <div class="legend-row"><span><i style="background:var(--ch-br1)"></i>ไม่เกิน 60 วัน</span><span><i style="background:var(--status-bad)"></i>เกิน 60 วัน (ในวงเล็บ)</span></div>
        <div class="note-box info">${['ไม้ขาว', 'สาคู'].filter((b) => brN(b)).map((b) => `${b} ${int(brN(b))} ราย`).join(' · ')}${res.length ? ` (บ้านพักอาศัยไม้ขาว ${int(sum(res, (r) => r.n))} ราย อายุเฉลี่ย ${int(sum(res, (r) => r.avg_age * r.n) / Math.max(1, sum(res, (r) => r.n)))} วัน)` : ''} · ใช้เวลาติดตั้งเฉลี่ย ${int(P.avgDays)} วัน (6 เดือนล่าสุด) · <a href="#snapshot">ดูข้อเสนอแนะ</a></div>`; }
    else { $('pipe-sum').innerHTML = '<div class="state">ไม่มีข้อมูลคำร้อง</div>'; $('t-pipe').innerHTML = '<div class="state">ไม่มีข้อมูลคำร้อง</div>'; }
    // ลูกค้าใหม่ซ้อนตามประเภท (แท่งซ้าย) เทียบทะเบียนใหม่ (แท่งขวา)
    const T21N = /^#[0-9a-f]{6}$/i.test(C.oliveChart) && /^#[0-9a-f]{6}$/i.test(C.surface || '') ? mixHex(C.oliveChart, C.surface, 0.55) : '#C9D9B6';
    const NGR = [[TY_NAME.T1, C.sky, (t) => t === 'T1'], [TY_NAME.T2, C.oliveChart, (t) => t === 'T2'], [TY_NAME['T2.1'], T21N, (t) => t === 'T2.1'], [TY_NAME.T3, C.navy, (t) => t === 'T3'], ['อื่น ๆ', '#B07CC6', (t) => !['T1', 'T2', 'T2.1', 'T3'].includes(t) && !NEWX.includes(t)]];
    const ns = NGR.map(([name, col, f]) => ({ name, type: 'bar', stack: 'new', barMaxWidth: 26, itemStyle: barStyle(col), data: months.map((m) => sum(S.cust.filter((r) => r.m === m && okBr(r.br) && okTy(r.ty) && f(r.ty)), (r) => r.new)) }))
      .filter((x) => x.data.some((v) => v))
      .concat([{ name: 'ทะเบียนใหม่ (ทุกสาขา/ประเภท)', type: 'bar', stack: 'reg', barMaxWidth: 26, itemStyle: barStyle(C.neutral), data: months.map((m) => (S.custCreated.find((x) => x.m === m) || {}).n || 0) }]);
    chart($('ch-new'), { xAxis: catAxis(months.map(mLabel)), yAxis: valAxis((v) => nf0.format(v)), series: ns, tooltip: { ...chartTT(), formatter: ttMoney('u') } });
    chartTable('c-new', months.map(mLabel), ns.map((s) => ({ name: s.name, data: s.data })), 'u');
    const dl = S.decl.filter((r) => okBr(r.br) && okTy(r.ty));
    $('t-decl').innerHTML = table([
      { h: 'ทะเบียน', nw: 1, k: 'reg' }, { h: 'ชื่อ', f: nameCell, cls: 'name' }, { h: 'สาขา', nw: 1, k: 'br' }, { h: 'ประเภท', nw: 1, f: (r) => esc(TY_NAME[r.ty] || r.ty) }, { h: 'สถานะ', nw: 1, f: (r) => esc(STATUS_TH[r.status] || r.status) },
      { h: '3 เดือนล่าสุด (บาท)', n: 1, f: (r) => `<b>${baht(r.cur)}</b>` }, { h: 'ปีก่อน (บาท)', n: 1, cls: 'muted', f: (r) => baht(r.prev) },
      { h: 'เปลี่ยนแปลง', cls: 'bar-cell', f: (r) => { const c = r.prev ? (r.cur - r.prev) / r.prev : 0; return `<span class="hb"><span class="track"><i style="width:${Math.min(100, Math.abs(c) * 100).toFixed(1)}%"></i></span><b class="v-bad">${r.prev ? '−' + nf1.format(Math.abs(c * 100)) + '%' : '–'}</b></span>`; }, v: (r) => (r.prev ? nf1.format((r.cur - r.prev) / r.prev * 100) : '') },
      { h: 'ลบ.ม. ล่าสุด / ปีก่อน', n: 1, f: (r) => int(r.ucur) + ' / ' + int(r.uprev) },
    ], dl);
    const types = [...new Set(st.map((r) => r.ty))].sort();
    const strows = types.map((t) => { const x = st.filter((r) => r.ty === t); const g = (s) => sum(x.filter((r) => r.status === s), (r) => r.n); return { t, a: g('active'), d: g('disconnected'), c: g('closed'), p: g('pending_install'), all: sum(x, (r) => r.n) }; });
    // แถบสัดส่วนสถานะในแต่ละแถว · ยกเลิกเกิน 30% ของประเภท = ตัวเลขสีแดง
    const SC = [['a', 'var(--ch-br1)', 'ใช้งาน'], ['d', 'var(--status-warn)', 'งดจ่ายน้ำ'], ['c', 'var(--ch-neutral)', 'ยกเลิก'], ['p', 'var(--ch-sky)', 'รอติดตั้ง']];
    const sbar = (r) => `<span class="sbar" role="img" aria-label="${SC.map(([k, , l]) => `${l} ${r[k]}`).join(', ')}">${SC.map(([k, c]) => (r[k] ? `<span style="width:${(r[k] / r.all * 100).toFixed(2)}%;background:${c}"></span>` : '')).join('')}</span>`;
    const hiC = strows.filter((r) => r.all >= 20 && r.c / r.all > 0.3);
    $('t-st').innerHTML = `<div class="legend-row">${SC.map(([, c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div>` + table([
      { h: 'ประเภท', nw: 1, f: (r) => esc(TY_NAME[r.t] || r.t) }, { h: 'สัดส่วนสถานะ', cls: 'sbar-cell', f: sbar, v: () => '' }, { h: 'ใช้งาน', n: 1, f: (r) => int(r.a) },
      { h: `ลูกค้าใหม่<br><span class="muted small">${mLabel(from)}–${mLabel(to)}</span>`, n: 1, cls: 'newc', f: (r) => (NEWX.includes(r.t) ? `<span class="muted" title="ใบแรกในระบบใหม่ = ย้ายเข้าระบบ ไม่ใช่ลูกค้าใหม่">–</span>` : newTy[r.t] ? `<b>+${int(newTy[r.t])}</b>` : '<span class="muted">0</span>'), v: (r) => (NEWX.includes(r.t) ? '' : newTy[r.t] || 0) },
      { h: `ยอดขาย (บาท)<br><span class="muted small">ลูกค้าใหม่</span>`, n: 1, f: (r) => (NEWX.includes(r.t) ? '<span class="muted">–</span>' : nrTy[r.t] ? int(nrTy[r.t].net + nrTy[r.t].fee) : '<span class="muted">0</span>'), v: (r) => (NEWX.includes(r.t) || !nrTy[r.t] ? '' : (nrTy[r.t].net + nrTy[r.t].fee).toFixed(2)) },
      { h: 'งดจ่ายน้ำ', n: 1, f: (r) => int(r.d) },
      { h: 'ยกเลิก', n: 1, f: (r) => (r.all && r.c / r.all > 0.3 ? `<b class="v-bad">${int(r.c)}</b>` : int(r.c)) }, { h: 'รอติดตั้ง', n: 1, f: (r) => int(r.p) }, { h: 'รวม', n: 1, f: (r) => `<b>${int(r.all)}</b>` },
    ], strows, ['รวม', '', int(sum(strows, (r) => r.a)), `<b>+${int(newc)}</b>`, `<b>${int(nrNet + nrFee)}</b>`, int(sum(strows, (r) => r.d)), int(sum(strows, (r) => r.c)), int(sum(strows, (r) => r.p)), int(sum(strows, (r) => r.all))]);
    $('st-foot').innerHTML = hiC.map((r) => `${esc(TY_NAME[r.t] || r.t)} ยกเลิกแล้ว <b class="v-bad">${int(r.c)}</b> จาก ${int(r.all)} ราย (${pct(r.c / r.all)}) — สูงกว่าเกณฑ์ 30% ควรตรวจว่าเป็นการย้ายออกจริงหรือทะเบียนค้างในระบบ`).join('<br>');
  }
  // หมายเหตุลูกค้ารายใหญ่ที่ตัวเลขเปลี่ยนเพราะข้อมูล ไม่ใช่พฤติกรรมการใช้น้ำ (อ้างอิง customer_water_id)
  const KNOWN = {
    4: () => 'สัญญาขายส่งสิ้นสุดแล้ว (บิลสุดท้าย ' + mLabel(PWA_LAST) + ') · ' + mLabel(PWA_DRY[0]) + ' หน้าแล้งไม่มีน้ำส่ง — ยอดลดเพราะหยุดส่งน้ำ ไม่ใช่ข้อมูลขาด',
    1363: () => 'ระบบเดิมออกบิลหอถังของ อบต. รวมไว้ที่ทะเบียนนี้ ระบบใหม่ (มี.ค. 69) แยกเป็นทะเบียนประเภท T2.3 — ยอดที่ลดส่วนใหญ่ย้ายไปทะเบียนใหม่',
  };
  // คำเตือนของแถว (กปภ., ทะเบียนหอถังเดิม ฯลฯ) เป็นกล่องเหลืองใต้ชื่อ
  const nameCell = (r) => esc(r.name) + (KNOWN[r.cw] && KNOWN[r.cw]() ? `<span class="warn-line">⚠ ${esc(KNOWN[r.cw]())}</span>` : '');
  const STATUS_TH = { active: 'ใช้งาน', disconnected: 'งดจ่ายน้ำ', closed: 'ยกเลิก', pending_install: 'รอติดตั้ง' };

  function pCollections(el) {
    const { from, to } = S.f;
    const months = monthsBetween(from, to);
    const coll = collAgg(from, to), sa = salesAgg(from, to, { ignoreTy: true }), ar = arAgg(), co = cohortAgg(from, to);
    setScope(`${mLabel(from)}${from !== to ? ' – ' + mLabel(to) : ''} · ลูกหนี้ ณ ${dLabel(S.asof)}`);
    const ratioAll = sa.billWaterInclVat ? coll.water / sa.billWaterInclVat : null;
    el.innerHTML = `
      <div class="kpis">
        ${kpi('ยอดรับชำระตามใบเสร็จ', mb(coll.total), 'ล้านบาท', 'รวม VAT · ตามวันที่รับชำระ · ยังไม่ได้กระทบยอดกับบัญชีธนาคาร', [['ใบเสร็จ', int(coll.n) + ' ใบ', 'v-mute'], ['ค่าน้ำ', mb(coll.water) + ' ล้าน', 'v-mute']], 'accent')}
        ${kpi('ภาษีหัก ณ ที่จ่าย', baht(coll.wht), 'บาท', 'แยกจากยอดรับชำระ (ยอดในใบเสร็จไม่ได้หัก)', [['ช่วง', `${mLabel(from)} – ${mLabel(to)}`, 'v-mute']])}
        ${kpi('รับชำระต่อยอดแจ้งหนี้ (ค่าน้ำ)', pct(ratioAll), '', `รับชำระค่าน้ำ ÷ ใบแจ้งหนี้ค่าน้ำ ในช่วงเดียวกัน (รวม VAT, ทุกประเภทลูกค้า) · คนละรุ่นเอกสาร จึงเกิน 100% ได้`, [['รับชำระค่าน้ำ', mb(coll.water) + ' ล้าน', 'v-mute'], ['แจ้งหนี้ค่าน้ำ', mb(sa.billWaterInclVat) + ' ล้าน', 'v-mute']])}
        ${kpi('ลูกหนี้ค่าน้ำเกินกำหนด', mb(ar.overdue), 'ล้านบาท', `ใบแจ้งหนี้ที่เลยวันครบกำหนดแล้วยังไม่ชำระ ณ ${dLabel(S.asof)} (รวม VAT)`, [['จากคงค้าง', `${mb(ar.total)} (${nf0.format(ar.total ? ar.overdue / ar.total * 100 : 0)}%)`, 'v-mute'], ['ใบค้าง / ลูกค้า', `${int(ar.n)} / ${int(S.d.debtors.n_overdue_cust)}`, 'v-mute']], 'bad')}
      </div>
      <div class="row">
        ${card('c-coll', 'ยอดรับชำระรายเดือนตามประเภท', 'ล้านบาท รวม VAT · ตามวันที่รับชำระ (ไม่มีวันที่ใช้วันที่ใบเสร็จ) · ไม่ใช่ยอดขาย', 'ช่วงเดือน · สาขา', '<div class="chart" id="ch-coll"></div>', { table: 1, min: 520 })}
        ${card('c-ratio', 'สัดส่วนรับชำระต่อยอดแจ้งหนี้ค่าน้ำ รายเดือน', 'รับชำระในเดือน ÷ แจ้งหนี้ในเดือน (คนละรุ่นเอกสาร จึงเกิน 100% ได้) · ⚠ = เดือนที่ไม่มีรายได้ กปภ. (หน้าแล้ง/สัญญาสิ้นสุด)', 'ช่วงเดือน · สาขา', '<div class="chart" id="ch-ratio"></div>', { table: 1, min: 520 })}
      </div>
      <div class="row">
        ${card('c-ar', 'อายุลูกหนี้ ณ ' + dLabel(S.asof), 'บาท รวม VAT · ค่าน้ำตามวันครบกำหนด · ใบแจ้งหนี้งานขายไม่มีวันครบกำหนดในข้อมูล จึงแยกเป็น “ไม่มีวันครบกำหนด”', 'สาขา (ตำบล) · ประเภทลูกค้า · วันอ้างอิงลูกหนี้', '<div id="ar-br"></div><div id="t-ar"></div>', { csv: 1, table: 1, w: 1.2, min: 600 })}
        ${card('c-ch', 'ช่องทางรับชำระ', 'สัดส่วนการจ่าย = % ของจำนวนใบเสร็จ (ช่องทางที่ลูกค้านิยม) · สแกน QR = สแกนบนใบแจ้งหนี้ผ่านแอปธนาคาร · ใบเสร็จระบบเดิม (ก่อน มี.ค. 69) บันทึกช่องทางไม่ครบ ส่วนใหญ่แสดงเป็น “โอน” · ไม่มีการชำระ = ใบเสร็จยอด 0 (ใช้น้ำไม่เกินโควตาน้ำฟรี หรือหักด้วยใบลดหนี้ทั้งใบ) ใน WMS บันทึกเป็นเงินสด', 'ช่วงเดือน · สาขา', '<div id="t-ch"></div>', { csv: 1, w: 1, min: 460, foot: '<span id="ch-foot"></span>' })}
      </div>
      <div class="row">
        ${card('c-cohort', 'อัตราเก็บเงินรายรุ่นใบแจ้งหนี้ (ระบบใหม่ ตั้งแต่ มี.ค. 69)', `ชำระแล้ว ÷ ยอดแจ้งหนี้ของรุ่นเดียวกัน นับรับชำระถึง ${dLabel(S.asof)} · ตรงเวลา = ชำระภายในวันครบกำหนด`, 'ช่วงเดือน (เดือนออกใบแจ้งหนี้) · สาขา (ตำบล) · วันอ้างอิง', '<div id="t-cohort"></div>', { csv: 1, foot: '<span id="co-foot"></span>',
          tools: '<span class="legend-row" style="margin:0"><span><i style="background:var(--ch-br1)"></i>ชำระตรงเวลา</span><span><i style="background:var(--ch-sky)"></i>ชำระช้า</span><span><i style="background:var(--row-sub);outline:1px solid var(--line-strong)"></i>ยังค้าง</span></span>' })}
      </div>
      <div class="row">
        ${card('c-debt', 'ลูกค้า 10 รายแรกที่มียอดเกินกำหนด', `ณ ${dLabel(S.asof)} · บาท · ลูกค้าที่มียอดเกินกำหนดทั้งหมด <b>${int(S.d.debtors.n_overdue_cust)} ราย</b> · คลิกแถวเพื่อดูใบแจ้งหนี้ค้างชำระ`, 'สาขา (ตำบล) · ประเภทลูกค้า · วันอ้างอิงลูกหนี้', '<div id="t-debt"></div>', { csv: 1, foot: 'แถบแยกตามอายุ: 1–30 · 31–60 · 61–90 · > 90 วัน (สีเดียวกับการ์ดอายุลูกหนี้) · ครบกำหนดเก่าสุดก่อนปีปัจจุบันเป็นสีแดง' })}
      </div>`;
    const kinds = [['water', 'ค่าน้ำ', C.navy], ['fee', 'งานขาย/บริการ', C.oliveChart], ['bond', 'เงินประกัน', C.sky]];
    const cs = kinds.map(([k, name, color]) => ({ name, type: 'bar', stack: 'k', barMaxWidth: 34, itemStyle: barStyle(color), data: months.map((m) => round2(sum(S.coll.filter((r) => r.m === m && okBr(r.br) && r.k === k), (r) => r.amt))) }));
    chart($('ch-coll'), { xAxis: catAxis(months.map(mLabel)), yAxis: valAxis(), series: cs, tooltip: { ...chartTT(), formatter: ttMoney() } });
    chartTable('c-coll', months.map(mLabel), cs.map((s) => ({ name: s.name, data: s.data })));
    const rs = [{ name: 'สัดส่วนรับชำระต่อยอดแจ้งหนี้', type: 'line', symbolSize: 8, lineStyle: { width: 2, color: C.navy }, itemStyle: { color: C.navy },
      label: { show: true, position: 'top', formatter: (p) => nf0.format(p.value * 100) + '%', color: C.body, fontFamily: 'Prompt', fontSize: 11, fontWeight: 600 },
      data: months.map((m) => { const b = salesAgg(m, m, { ignoreTy: true }).billWaterInclVat; const c = sum(S.coll.filter((r) => r.m === m && okBr(r.br) && r.k === 'water'), (r) => r.amt); return b ? Math.round((c / b) * 1000) / 1000 : null; }),
      markLine: { silent: true, symbol: 'none', lineStyle: { color: C.text2, type: 'dashed' }, label: { formatter: '100%', color: C.text2, fontFamily: 'Prompt' }, data: [{ yAxis: 1 }] } }];
    const warnC = getComputedStyle(document.documentElement).getPropertyValue('--status-warn').trim() || '#8A5300';
    const rx = catAxis(months.map((m) => mLabel(m) + (S.pwaMissing.includes(m) ? ' ⚠' : '')));
    rx.axisLabel = { ...rx.axisLabel, interval: 0, formatter: (v) => (v.includes('⚠') ? `{w|${v}}` : v), rich: { w: { color: warnC, fontWeight: 600, fontFamily: 'Prompt' } } };
    chart($('ch-ratio'), { legend: { show: false }, grid: { left: 8, right: 48, top: 28, bottom: 8, containLabel: true }, xAxis: rx, yAxis: valAxis((v) => nf0.format(v * 100) + '%'), series: rs,
      tooltip: { ...chartTT(), axisPointer: { type: 'line' }, valueFormatter: (v) => pct(v) } });
    chartTable('c-ratio', months.map(mLabel), rs.map((s) => ({ name: s.name, data: s.data })), 'p');

    const cm = {}; co.rows.forEach((r) => { const x = cm[r.m] || (cm[r.m] = { m: r.m, n: 0, billed: 0, paid: 0, ontime: 0, open: 0 }); ['n', 'billed', 'paid', 'ontime', 'open'].forEach((k) => { x[k] += r[k]; }); });
    const crows = Object.values(cm).sort((a, b) => a.m.localeCompare(b.m));
    // รุ่นที่ยังไม่ครบกำหนด = ออกบิลเดือนก่อนหน้าวันอ้างอิงหรือหลังจากนั้น (ครบกำหนดในเดือนอ้างอิง)
    const notDue = (m) => m >= addM(S.asof.slice(0, 7), -1);
    const coBar = (r) => { const on = r.ontime / r.billed, pd = r.paid / r.billed; return `<span class="cobar"><span class="track"><i class="on" style="width:${(on * 100).toFixed(1)}%"></i><i class="late" style="width:${(Math.max(0, pd - on) * 100).toFixed(1)}%"></i></span><b class="${pd < 0.8 && !notDue(r.m) ? 'v-bad' : ''}">${pct(pd)}</b></span>`; };
    $('t-cohort').innerHTML = crows.length ? table([
      { h: 'รุ่น (เดือนออกบิล)', nw: 1, f: (r) => mLabel(r.m) + (notDue(r.m) ? ' <span class="muted small">(ยังไม่ครบกำหนด)</span>' : ''), v: (r) => mLabel(r.m) },
      { h: 'อัตราเก็บได้', cls: 'bar-cell', f: coBar, v: (r) => pct(r.paid / r.billed) }, { h: 'ตรงเวลา', n: 1, f: (r) => pct(r.ontime / r.billed) },
      { h: 'แจ้งหนี้ (บาท)', n: 1, f: (r) => baht(r.billed) }, { h: 'ชำระแล้ว', n: 1, f: (r) => baht(r.paid) },
      { h: 'ค้าง', n: 1, f: (r) => (r.open >= 1e6 ? `<b class="v-bad">${baht(r.open)}</b>` : baht(r.open)), v: (r) => round2(r.open) },
    ], crows, ['รวม', pct(co.billed ? co.paid / co.billed : null), pct(co.billed ? co.ontime / co.billed : null), baht(co.billed), baht(co.paid), baht(co.open)])
      : '<div class="state">ช่วงที่เลือกไม่มีใบแจ้งหนี้ระบบใหม่ (เริ่ม มี.ค. 69)</div>';
    const badCo = crows.filter((r) => !notDue(r.m) && r.billed && r.paid / r.billed < 0.8).sort((a, b) => a.paid / a.billed - b.paid / b.billed);
    if ($('co-foot')) $('co-foot').innerHTML = badCo.length ? badCo.slice(0, 2).map((r) => `รุ่น ${mLabel(r.m)} เก็บได้แค่ <b class="v-bad">${pct(r.paid / r.billed)}</b> ทั้งที่เลยกำหนดมาแล้ว — ค้าง ${mb(r.open)} ล้านบาท`).join(' · ') : 'ทุกรุ่นที่ครบกำหนดแล้วเก็บได้ตั้งแต่ 80% ขึ้นไป';

    // ใบเสร็จยอด 0 (น้ำฟรี/หักใบลดหนี้ทั้งใบ) แยกเป็นแถวของตัวเอง — WMS บังคับเลือกช่องทาง พนักงานจึงบันทึกเป็น "เงินสด" (พบ 11/11/69)
    const chm = {}; const chAdd = (ch, n, amt) => { if (!n && !amt) return; const x = chm[ch] || (chm[ch] = { ch, n: 0, amt: 0 }); x.n += n; x.amt += amt; };
    S.coll.filter((r) => inR(r.m, from, to) && okBr(r.br)).forEach((r) => { chAdd(r.ch, r.n - (r.zero_n || 0), r.amt); chAdd('zero', r.zero_n || 0, 0); });
    // เรียงตามจำนวนใบเสร็จ = ช่องทางที่ลูกค้านิยม (นับครั้งที่จ่าย) · ยอดเงินแยกอีกคอลัมน์ เพราะลูกค้ารายใหญ่จ่ายด้วยโอน/เช็คไม่กี่ใบแต่ยอดสูง
    const chrows = Object.values(chm).sort((a, b) => b.n - a.n || b.amt - a.amt);
    const chNMx = Math.max(0, ...chrows.map((r) => r.n)), chNt = sum(chrows, (r) => r.n);
    $('t-ch').innerHTML = table([
      { h: 'ช่องทาง', f: (r) => esc((CH_NAME[r.ch] || r.ch).replace(' (แอปธนาคาร)', '').replace(' (พนักงานบันทึก)', '')), v: (r) => CH_NAME[r.ch] || r.ch },
      { h: 'สัดส่วนการจ่าย', cls: 'bar-cell', f: (r) => barCell(`<b>${pct(chNt ? r.n / chNt : null)}</b>`, r.n, chNMx), v: (r) => (chNt ? round2(r.n / chNt * 100) : '') },
      { h: 'ใบเสร็จ', n: 1, f: (r) => int(r.n) },
      { h: 'ยอด (ล้าน)', n: 1, f: (r) => `<b>${mb(r.amt)}</b>`, v: (r) => round2(r.amt) },
      { h: '% ยอด', n: 1, cls: 'muted', f: (r) => pct(coll.total ? r.amt / coll.total : null) },
      { h: 'บาท/ใบ', n: 1, cls: 'muted', f: (r) => int(r.amt / Math.max(1, r.n)) },
    ], chrows, ['รวม', '100%', int(coll.n), { h: mb(coll.total), v: round2(coll.total) }, '100%', int(coll.total / Math.max(1, coll.n))]);
    const chN = chrows[0], chA = chrows.slice().sort((a, b) => b.amt - a.amt)[0];
    if ($('ch-foot') && chN) $('ch-foot').innerHTML = `ลูกค้านิยมจ่ายผ่าน <b>${esc(CH_NAME[chN.ch] || chN.ch)}</b> มากที่สุด ${pct(chNt ? chN.n / chNt : null)} ของการจ่าย (${int(chN.n)} ใบ เฉลี่ย ${int(chN.amt / Math.max(1, chN.n))} บาท/ใบ)${chA && chA !== chN ? ` · ยอดเงินมาจาก${esc(CH_NAME[chA.ch] || chA.ch)}มากที่สุด ${pct(coll.total ? chA.amt / coll.total : null)} (ลูกค้ารายใหญ่)` : ''}${chm.zero ? ` · ใบเสร็จยอด 0 บาท ${int(chm.zero.n)} ใบ (ส่วนใหญ่ใช้น้ำไม่เกินโควตาน้ำฟรี) แยกเป็นแถว “ไม่มีการชำระ” ไม่นับเป็นเงินสด` : ''}`;

    const arRows = AGING.map((g) => ({ g, amt: ar.b[g.k], n: sum(ar.rows.filter((r) => r.bk === g.k), (r) => r.n), leg: sum(ar.rows.filter((r) => r.bk === g.k && r.legacy), (r) => r.amt) }));
    $('t-ar').innerHTML = table([
      { h: 'ช่วงอายุ', nw: 1, f: (r) => `<span class="sw" style="background:${r.g.color}"></span> ${r.g.name}` }, { h: 'ใบ', n: 1, f: (r) => int(r.n) }, { h: 'ยอด (บาท รวม VAT)', n: 1, f: (r) => baht(r.amt) },
      { h: 'สัดส่วน', n: 1, f: (r) => pct(ar.total ? r.amt / ar.total : null) }, { h: 'ในนี้จากระบบเดิม', n: 1, f: (r) => (r.leg ? `<span class="v-warn" style="font-weight:600">${baht(r.leg)}</span>` : baht(r.leg)), v: (r) => round2(r.leg) },
    ], arRows, ['รวม', int(ar.n), baht(ar.total), '100.0%', baht(ar.legacy)]);
    // แถบอายุลูกหนี้แยกสาขา (สเกลเดียวกัน)
    const arBrs = chartBranches((b) => ar.rows.some((r) => r.br === b));
    const brT = arBrs.map((b) => ({ b, parts: AGING.map((g) => ({ g, v: sum(ar.rows.filter((r) => brG(r.br) === b && r.bk === g.k), (r) => r.amt) })) })).map((x) => ({ ...x, t: sum(x.parts, (p) => p.v) }));
    const brMx = Math.max(1, ...brT.map((x) => x.t));
    chartTable('c-ar', brT.map((x) => x.b), AGING.map((g) => ({ name: g.name, data: brT.map((x) => round2(x.parts.find((p) => p.g === g).v)) })));
    $('ar-br').innerHTML = `<div class="legend-row">${AGING.map((g) => `<span><i style="background:${g.color}"></i>${g.name}</span>`).join('')}</div>
      <div class="arbars">${brT.map((x) => `<span class="ab-n">${esc(x.b)}</span><span class="ab-b" role="img" aria-label="${esc(x.b)}: ${x.parts.filter((p) => p.v).map((p) => p.g.name + ' ' + mb(p.v) + ' ล้านบาท').join(', ')}">${x.parts.filter((p) => p.v > 0).map((p) => `<i style="width:${(p.v / brMx * 100).toFixed(2)}%;background:${p.g.color}" title="${esc(p.g.name)} ${mb(p.v)} ล้านบาท"></i>`).join('')}</span><b>${mb(x.t)} <small>ล้านบาท</small></b>`).join('')}</div>`;

    const dt = S.debt.filter((r) => okBr(r.br) && okTy(r.ty)).slice(0, 10);
    $('t-debt').innerHTML = table([
      { h: 'ทะเบียน', nw: 1, k: 'reg' }, { h: 'ชื่อ', f: nameCell, cls: 'name' }, { h: 'สาขา', nw: 1, k: 'br' }, { h: 'ประเภท', f: (r) => esc(TY_NAME[r.ty] || r.ty) }, { h: 'สถานะ', nw: 1, f: (r) => esc(STATUS_TH[r.status] || r.status) },
      { h: 'เกินกำหนด', n: 1, f: (r) => `<b>${baht(r.overdue)}</b>`, v: (r) => round2(r.overdue) },
      { h: 'แยกตามอายุ', cls: 'sbar-cell', f: (r) => { const t = (r.b1 || 0) + (r.b2 || 0) + (r.b3 || 0) + (r.b4 || 0); return `<span class="sbar" role="img" aria-label="1–30 วัน ${baht(r.b1)} · 31–60 วัน ${baht(r.b2)} · 61–90 วัน ${baht(r.b3)} · เกิน 90 วัน ${baht(r.b4)}" title="1–30: ${baht(r.b1)} · 31–60: ${baht(r.b2)} · 61–90: ${baht(r.b3)} · >90: ${baht(r.b4)}">${[['b1', 1], ['b2', 2], ['b3', 3], ['b4', 4]].map(([k, g]) => (r[k] > 0 && t ? `<span style="width:${(r[k] / t * 100).toFixed(2)}%;background:${AGING.find((a) => a.k === g).color}"></span>` : '')).join('')}</span>`; }, v: (r) => `1-30:${round2(r.b1)} 31-60:${round2(r.b2)} 61-90:${round2(r.b3)}` },
      { h: '> 90 วัน', n: 1, f: (r) => (r.b4 ? `<b class="v-bad">${baht(r.b4)}</b>` : '–'), v: (r) => round2(r.b4 || 0) },
      { h: 'คงค้างทั้งหมด', n: 1, f: (r) => baht(r.ar) }, { h: 'ครบกำหนดเก่าสุด', nw: 1, f: (r) => (r.oldest && r.oldest.slice(0, 4) < S.asof.slice(0, 4) ? `<b class="v-bad">${dLabel(r.oldest)}</b>` : dLabel(r.oldest)), v: (r) => r.oldest },
    ], dt, null, { click: 1 });
    $('t-debt').querySelectorAll('tr.click').forEach((tr) => {
      const open = () => { const r = dt[tr.dataset.row]; const docs = S.debtDocs.filter((x) => x.cw === r.cw);
        drill(`${r.reg} · ${r.name}`, [{ h: 'เลขที่ใบแจ้งหนี้', nw: 1, k: 'doc' }, { h: 'วันที่ออก', nw: 1, f: (x) => dLabel(x.issue) }, { h: 'ครบกำหนด', nw: 1, f: (x) => dLabel(x.due) }, { h: 'เกินกำหนด (วัน)', n: 1, f: (x) => (x.days > 0 ? int(x.days) : 'ยังไม่ครบ') }, { h: 'ลบ.ม.', n: 1, f: (x) => int(x.units) }, { h: 'ยอด (บาท รวม VAT)', n: 1, f: (x) => baht(x.amt) }],
          docs, `ใบแจ้งหนี้ค่าน้ำค้างชำระ ${docs.length} ใบ รวม ${baht(sum(docs, (x) => x.amt))} บาท ณ ${dLabel(S.asof)}`); };
      tr.addEventListener('click', open); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
    });
  }

  // ================= Executive Snapshot (2 หน้า A4 แนวนอน) =================
  const SG = [
    { k: 'T1', name: 'T1', tys: ['T1'], cat: 'g' },
    { k: 'T2', name: 'T2 (รวม T2.1 ตำรวจ)', tys: ['T2', 'T2.1'], cat: 'g' },
    { k: 'T3', name: 'T3', tys: ['T3'], cat: 'g' },
    { k: 'HT', name: 'อบต.ไม้ขาว (หอถังสูง)', tys: ['T2.3'], cat: 'g' },
    { k: 'AOT', name: 'ทอท. (สนามบิน)', tys: ['T3.1'], cat: 'c' },
    { k: 'PWA', name: 'กปภ. (ขายส่ง)', tys: ['T2.2'], cat: 'c' },
  ];
  function snapMonth(m, tys) {
    const rs = S.sales.filter((r) => r.m === m && okBr(r.br) && (!tys || tys.includes(r.ty)) && (tys || okTy(r.ty)));
    const pr = rs.filter((r) => r.src === 'W' || (r.src === 'L' && r.units));
    const nf = rs.filter((r) => r.src !== 'F');
    const cust = tys ? sum(S.cust.filter((c) => c.m === m && okBr(c.br) && tys.includes(c.ty)), (c) => c.active) : 0;
    return { net: sum(tys ? nf : rs, (r) => r.net), fee: sum(rs.filter((r) => r.src === 'F'), (r) => r.net), units: sum(pr, (r) => r.units), pnet: sum(pr, (r) => r.net), cust };
  }
  const sumM = (ms, tys) => ms.map((m) => snapMonth(m, tys)).reduce((a, x) => ({ net: a.net + x.net, fee: a.fee + x.fee, units: a.units + x.units, pnet: a.pnet + x.pnet, cust: a.cust + x.cust }), { net: 0, fee: 0, units: 0, pnet: 0, cust: 0 });
  function spark(vals, w = 120, h = 26) {
    const v = vals.map((x) => (x == null ? 0 : x)), mx = Math.max(...v, 1), mn = Math.min(...v, 0);
    const pts = v.map((x, i) => `${(i / Math.max(1, v.length - 1) * (w - 4) + 2).toFixed(1)},${(h - 3 - (x - mn) / (mx - mn || 1) * (h - 6)).toFixed(1)}`).join(' ');
    const last = pts.split(' ').pop().split(',');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="${last[0]}" cy="${last[1]}" r="2.6" fill="currentColor"/></svg>`;
  }
  function verdict(cur, prev) {
    if (!prev) return cur ? '<span class="pill up">ใหม่</span>' : '<span class="pill na">–</span>';
    const c = (cur - prev) / Math.abs(prev);
    if (cur === 0) return '<span class="pill down">▼ หยุด</span>';
    return c > 0.03 ? '<span class="pill up">▲ ดีขึ้น</span>' : c < -0.03 ? '<span class="pill down">▼ แย่ลง</span>' : '<span class="pill na">● ทรงตัว</span>';
  }
  const sgn = (v) => (v == null ? '–' : (v >= 0 ? '+' : '') + nf1.format(v * 100) + '%');
  const cmpCell = (a, b) => (b ? `<span class="${a >= b ? 'pos' : 'neg'}">${a >= b ? '▲' : '▼'} ${sgn((a - b) / Math.abs(b))}</span>` : '<span class="muted">–</span>');
  // ตาราง Snapshot: ผลต่างเป็นล้านบาท (M) หน้า % เปลี่ยนแปลง
  const dMil = (d) => (Math.abs(d) < 5000 ? (d >= 0 ? '+' : '−') + '<0.01' : (d >= 0 ? '+' : '−') + nf2.format(Math.abs(d) / 1e6));
  const cmpCellV = (a, b) => (b ? `<span class="dmil ${a >= b ? 'pos' : 'neg'}">${dMil(a - b)}M</span>${cmpCell(a, b)}` : a ? `<span class="dmil pos">${dMil(a)}M</span><span class="muted">–</span>` : '<span class="muted">–</span>');

  function pSnapshot(el) {
    // เดือนรายงาน = ตัวกรอง 'เดือนรายงาน' (ค่าเริ่มต้น = เดือนเต็มล่าสุด; เดือนที่ยังไม่ครบใช้เดือนเต็มล่าสุดแทน)
    const M = S.f.to && S.f.to !== S.partialMonth && S.months.includes(addM(S.f.to, -12)) ? S.f.to : S.lastFull, Mp = addM(M, -1), My = addM(M, -12), Y = M.slice(0, 4), Yp = String(+Y - 1);
    const ytdMs = monthsBetween(Y + '-01', M), ytdPs = monthsBetween(Yp + '-01', My);
    const all = (ms) => sumM(ms, null);
    const exP = (ms) => { const a = all(ms), p = sumM(ms, ['T2.2']); return { net: a.net - p.net, units: a.units - p.units, pnet: a.pnet - p.pnet }; };
    const cur = all([M]), prv = all([Mp]), ly = all([My]), ytd = all(ytdMs), ytdP = all(ytdPs);
    const xc = exP([M]), xp = exP([Mp]), xy = exP([My]), xytd = exP(ytdMs), xytdP = exP(ytdPs);
    const pu = (a) => (a.units ? a.pnet / a.units : null);
    const fc = forecastYear();
    const mtd = S.partialMonth ? all([S.partialMonth]) : null;
    const trendMs = monthsBetween(Yp + '-01', M);
    const t3 = (tys) => ({ l3: sumM(monthsBetween(addM(M, -2), M), tys).net, l3y: sumM(monthsBetween(addM(My, -2), My), tys).net });
    const mkRow = (g) => {
      const c = snapMonth(M, g.tys), p = snapMonth(Mp, g.tys), y = snapMonth(My, g.tys), a = sumM(ytdMs, g.tys), b = sumM(ytdPs, g.tys), tr = t3(g.tys);
      return { g, c, p, y, a, b, tr, sp: trendMs.map((m) => snapMonth(m, g.tys).net) };
    };
    const rows = SG.map(mkRow);
    const tysOf = (cat) => SG.filter((g) => !cat || g.cat === cat).flatMap((g) => g.tys);
    const subG = mkRow({ k: 'SUBG', name: 'รวมลูกค้าทั่วไป', tys: tysOf('g'), cat: 'g', cls: 'sub' });
    const subC = mkRow({ k: 'SUBC', name: 'รวมลูกค้าสัญญา', tys: tysOf('c'), cat: 'c', cls: 'sub' });
    const subW = mkRow({ k: 'SUBW', name: 'รวมขายน้ำ (ทั่วไป+สัญญา)', tys: tysOf(null), cat: 'w', cls: 'water' });
    const feeC = all([M]).fee, feeP = all([Mp]).fee, feeY = all([My]).fee, feeA = ytd.fee, feeB = ytdP.fee;
    const lastPwa = S.sales.filter((r) => r.ty === 'T2.2' && r.net > 0 && (r.src === 'W' || r.src === 'L')).map((r) => r.m).sort().pop();
    // ฤดูกาล: ดัชนีรายเดือนจากปีก่อน (ไม่รวม กปภ.) = เดือน ÷ ค่าเฉลี่ยทั้งปี
    const seasonY = S.months.includes(Yp + '-12') ? Yp : null;
    const sIdx = seasonY ? (() => { const v = monthsBetween(seasonY + '-01', seasonY + '-12').map((m) => exP([m]).net); const avg = sum(v, (x) => x) / 12; return v.map((x) => x / avg); })() : [];
    const hi = sIdx.length ? sIdx.map((x, i) => [x, i]).filter(([x]) => x >= 1.05).map(([, i]) => TH_M[i]) : [];
    const lo = sIdx.length ? sIdx.map((x, i) => [x, i]).filter(([x]) => x <= 0.95).map(([, i]) => TH_M[i]) : [];
    const t3r = rows.find((r) => r.g.k === 'T3');
    const better = rows.filter((r) => r.tr.l3y && r.tr.l3 > r.tr.l3y * 1.03).map((r) => r.g.name.split(' ')[0]);
    const worse = rows.filter((r) => r.tr.l3y && r.tr.l3 < r.tr.l3y * 0.97).map((r) => r.g.name.split(' ')[0]);
    const A = actionPlan().slice(0, 4);
    const kp = (label, v, unit, cmp, sub, cls = '') => `<div class="sk ${cls}"><div class="sk-l">${label}</div><div class="sk-v">${v}<small>${unit}</small></div>${cmp ? `<div class="sk-c">${cmp}</div>` : ''}${sub ? `<div class="sk-s">${sub}</div>` : ''}</div>`;
    const mm = (v) => nf2.format(v / 1e6);
    const snapRow = (r) => `            <tr class="${r.g.cls || ''}"><td>${esc(r.g.name)}${r.g.k === 'HT' && morganMissing() ? ` <small class="note-w" title="${esc(MORGAN_TXT)}">⚠ ไม่รวม ม.มอร์แกน</small>` : ''}${r.g.k === 'PWA' && lastPwa && lastPwa < M ? `<br><small class="neg">บิลสุดท้าย ${mLabel(lastPwa)}</small>` : ''}</td><td class="n"><b>${mm(r.c.net)}</b></td><td class="n">${cmpCellV(r.c.net, r.p.net)}</td><td class="n">${cmpCellV(r.c.net, r.y.net)}</td>
            <td class="n">${r.c.units ? nf2.format(r.c.pnet / r.c.units) : '–'} <small class="muted">(${r.y.units ? nf2.format(r.y.pnet / r.y.units) : '–'})</small></td>
            <td class="n">${mm(r.a.net)}</td><td class="n">${cmpCellV(r.a.net, r.b.net)}</td><td class="n">${pct(ytd.net ? r.a.net / ytd.net : null)}</td>
            <td class="n">${r.g.cat === 'g' && r.c.cust ? int(r.c.net / r.c.cust) + ` <small class="muted">(${r.y.cust ? int(r.y.net / r.y.cust) : '–'})</small>` : '–'}</td>
            <td class="sp-cell">${spark(r.sp)}</td><td>${verdict(r.tr.l3, r.tr.l3y)}</td></tr>`;
    const ar7 = arAgg();
    const prioL = (p) => (p === 1 ? 'ควรพิจารณาก่อน' : p === 2 ? 'น่าพิจารณา' : 'ระยะยาว');
    const scope = `${S.f.br ? 'ตำบล' + esc(S.f.br) : 'ไม้ขาว + สาคู'}${S.f.ty ? ' · ประเภท ' + esc(tyLabel(S.f.ty)) : ''} · ไม่รวม VAT`;
    setTitle(`Executive Snapshot · รายได้ประจำเดือน ${mLong(M)}`);
    $('head-tools').innerHTML = '<button type="button" class="btn" id="snap-print" title="พิมพ์หรือบันทึกเป็น PDF 2 หน้า A4 แนวนอน">พิมพ์ / บันทึก PDF (2 หน้า)</button>';
    const ph = (t, st, r) => `<header class="snap-h print-only"><div><div class="snap-t">${t}</div><div class="snap-st">${st}</div></div><div class="snap-asof">${r}</div></header>`;
    const cmpS = (a, b) => cmpRow('', a, b)[1];
    const cmpC = (a, b) => cmpRow('', a, b)[2];
    el.innerHTML = `
      <div class="snap">
      <section class="snap-page">
        ${ph(`Executive Snapshot · รายได้ประจำเดือน ${mLong(M)}`, 'บริษัท ไฮโดรเอ็นเตอร์ไพร์ส แอนด์ อะควอดีซายน์ จำกัด · ' + scope, `ข้อมูล ณ ${dLabel(S.asof)}<br>${S.cfg.mode === 'live' ? 'LIVE' : 'SNAPSHOT'} · ดึง ${S.fetched ? dLabel(S.fetched.slice(0, 10)) : '–'}`)}
        <div class="kpis k7">
          ${kpi(`รายได้ ${mLabel(M)}`, mm(cur.net), 'ล้านบาท', 'รายได้ทุกกลุ่มลูกค้า ไม่รวม VAT', [cmpRow('MoM', cur.net, prv.net), cmpRow('YoY', cur.net, ly.net)], 'target')}
          ${kpi(`ลูกค้าทั่วไป ${mLabel(M)}`, mm(subG.c.net), 'ล้านบาท', `T1–T3 และ อบต.ไม้ขาว (หอถังสูง) · ${pct(cur.net ? subG.c.net / cur.net : null)} ของรายได้`, [cmpRow('MoM', subG.c.net, subG.p.net), cmpRow('YoY', subG.c.net, subG.y.net)])}
          ${kpi(`ปริมาณน้ำ ${mLabel(M)}`, int(cur.units), 'ลบ.ม.', 'ปริมาณน้ำที่ออกใบแจ้งหนี้ในเดือน', [cmpRow('MoM', cur.units, prv.units), cmpRow('YoY', cur.units, ly.units)])}
          ${kpi('ราคาเฉลี่ยต่อหน่วย', nf2.format(pu(cur) || 0), 'บาท/ลบ.ม.', 'รายได้ค่าน้ำ+บริการ ÷ ลบ.ม. ที่ออกบิล · เปลี่ยนตามสัดส่วนลูกค้า (mix)', [cmpRow('MoM', pu(cur), pu(prv)), cmpRow('YoY', pu(cur), pu(ly))])}
          ${kpi(`YTD ม.ค.–${TH_M[+M.slice(5) - 1]}`, mm(ytd.net), 'ล้านบาท', 'รายได้สะสมตั้งแต่ต้นปี เทียบช่วงเดียวกันปีก่อน', [cmpRow('YoY', ytd.net, ytdP.net), cmpRow('ไม่รวม กปภ.', xytd.net, xytdP.net)])}
          ${kpi(`ประมาณการทั้งปี ${+Y + 543}`, mm(fc.fc), 'ล้านบาท', `${fc.method} · MTD ${S.partialMonth ? mLabel(S.partialMonth) + ' ' + mm(mtd.net) + ' ล้าน (ถึง ' + dLabel(S.asof) + ' · บิลออกปลายเดือน)' : '–'}`, fc.prev ? [cmpRow('เทียบปีก่อน', fc.fc, fc.prev)] : [])}
          ${kpi('ลูกหนี้ค่าน้ำคงค้าง', mm(ar7.total), 'ล้านบาท', `ใบแจ้งหนี้ที่ยังค้างชำระ ณ ${dLabel(S.asof)} · ${int(ar7.n)} ใบ (รวม VAT)`, [['เกินกำหนด', `${mm(ar7.overdue)} (${nf0.format(ar7.total ? ar7.overdue / ar7.total * 100 : 0)}%)`, 'v-bad'], ['เกิน 90 วัน', mm(ar7.b[4]), 'v-bad']], '', { link: ['#collections', 'ดูหน้าการจัดเก็บและลูกหนี้ →'] })}
        </div>
        <div class="row">
        ${card('c-snapt', 'รายได้ตามกลุ่มลูกค้า', 'ล้านบาท ไม่รวม VAT · ตัวเลขในวงเล็บ = ปีก่อน · ตัวเลขเล็กหน้า % = ผลต่าง (M = ล้านบาท)', 'สาขา (ตำบล) · ประเภทลูกค้า · เดือนรายงาน', `<div class="tbl-wrap" style="max-height:none;border:0">
        <table class="snap-t-tbl vlines" data-csvable="1">
          <thead><tr class="gh"><th></th><th class="gs" colspan="4">เดือน ${mLabel(M)}</th><th class="gs" colspan="3">สะสม ม.ค.–${mLabel(M)}</th><th class="gs" colspan="3">ต่อราย และแนวโน้ม</th></tr><tr><th>กลุ่มลูกค้า</th><th class="n">ล้านบาท</th><th class="n">MoM</th><th class="n">YoY</th><th class="n">บาท/ลบ.ม.<br><small>(ปีก่อน)</small></th><th class="n">ล้านบาท</th><th class="n">YoY</th><th class="n">สัดส่วน</th><th class="n">บาท/ราย/เดือน<br><small>(ปีก่อน)</small></th><th>ม.ค. ${(+Yp + 543) % 100} – ${mLabel(M)}</th><th>3 เดือนล่าสุด<br><small>เทียบปีก่อน</small></th></tr></thead>
          <tbody>
          <tr class="grp"><td colspan="11">ลูกค้าทั่วไป</td></tr>
          ${rows.filter((r) => r.g.cat === 'g').map(snapRow).join('')}${snapRow(subG)}
          <tr class="grp"><td colspan="11">ลูกค้าสัญญารายใหญ่</td></tr>
          ${rows.filter((r) => r.g.cat === 'c').map(snapRow).join('')}${snapRow(subC)}${snapRow(subW)}
            <tr><td>งานขาย/บริการอื่น</td><td class="n"><b>${mm(feeC)}</b></td><td class="n">${cmpCellV(feeC, feeP)}</td><td class="n">${cmpCellV(feeC, feeY)}</td><td class="n">–</td><td class="n">${mm(feeA)}</td><td class="n">${cmpCellV(feeA, feeB)}</td><td class="n">${pct(ytd.net ? feeA / ytd.net : null)}</td><td class="n">–</td><td></td><td></td></tr>
            <tr class="total-all"><td>รวมรายได้ทั้งหมด</td><td class="n">${mm(cur.net)}</td><td class="n">${cmpCellV(cur.net, prv.net)}</td><td class="n">${cmpCellV(cur.net, ly.net)}</td><td class="n">${nf2.format(pu(cur) || 0)} <small class="muted">(${ly.units ? nf2.format(pu(ly)) : '–'})</small></td><td class="n">${mm(ytd.net)}</td><td class="n">${cmpCellV(ytd.net, ytdP.net)}</td><td class="n">100%</td><td></td><td class="sp-cell">${spark(trendMs.map((m) => all([m]).net))}</td><td>${verdict(sumM(monthsBetween(addM(M, -2), M), null).net, sumM(monthsBetween(addM(My, -2), My), null).net)}</td></tr>
          </tbody></table></div>`, { csv: 1, w: 1, min: 900, foot: '<span class="snap-note">MoM = เทียบเดือนก่อน (มีผลฤดูกาล) · YoY = เทียบเดือนเดียวกันปีก่อน (ใช้ประเมินแนวโน้ม) · บาท/ลบ.ม. = รายได้ค่าน้ำ+บริการ ÷ ลบ.ม. ที่ออกบิล · บาท/ราย = รายได้กลุ่ม ÷ ผู้ใช้น้ำที่มีบิลในเดือน · “3 เดือนล่าสุด” ดีขึ้น/แย่ลง เมื่อต่างจากปีก่อนเกิน ±3%</span>' })}
        </div>
      </section>
      <section class="snap-page">
        ${ph('แนวโน้ม ฤดูกาล และข้อเสนอแนะ', `${scope} · ข้อมูล ณ ${dLabel(S.asof)}`, 'หน้า 2/2')}
        <div class="row" style="margin-top:0">
          ${card('c-snapc', 'รายได้รายเดือนแยกกลุ่ม', `ม.ค. ${+Yp + 543} – ${mLong(M)} · ล้านบาท ไม่รวม VAT · แถบสีอ่อน = ฤดูฝน/นอกฤดูท่องเที่ยว`, 'สาขา (ตำบล)', '<div class="chart snap-chart" id="ch-snap"></div>', { table: 1, w: 2, min: 620 })}
          ${card('c-season', 'ฤดูกาลและภัยแล้ง', `ดัชนีฤดูกาลปี ${seasonY ? +seasonY + 543 : '–'} = รายได้เดือน ÷ ค่าเฉลี่ยทั้งปี (ไม่รวม กปภ.)`, 'สาขา (ตำบล)',
            `${sIdx.length ? `<div class="season6">${sIdx.map((x, i) => `<div class="si" style="--v:${Math.min(1.4, Math.max(0.6, x))}${x >= 1.05 ? ';color:var(--on-accent)' : ''}"><b>${TH_M[i]}</b><span>${nf2.format(x)}</span></div>`).join('')}</div>
            <p class="small" style="margin:10px 0"><b>สูง</b> ${hi.join(' ') || '–'} · <b>ต่ำ</b> ${lo.join(' ') || '–'} — ฤดูท่องเที่ยว/แล้ง ลูกค้า T3 ใช้น้ำมากที่สุด จึงควรดู YoY แทน MoM</p>` : '<p class="small muted">ยังไม่มีข้อมูลครบปีสำหรับคำนวณดัชนี</p>'}
            <div class="note-box"><span class="ic" aria-hidden="true">⚠</span><div><b>ภัยแล้ง พ.ค. ${(+Y + 543) % 100}</b> ไม่มีการส่งน้ำให้ กปภ. และ T3 ลดลงตามฤดูกาล${t3r ? ` (${mm(snapMonth(Y + '-05', ['T3']).net)} ล้าน เทียบ ${mLabel(Y + '-04')} ${mm(snapMonth(Y + '-04', ['T3']).net)} ล้าน)` : ''} — ปีหน้าควรวางแผนกำลังผลิตก่อนรับลูกค้าแทน กปภ.</div></div>`, { w: 1, min: 360 })}
        </div>
        <div class="row">
          ${card('c-todo', 'ข้อเสนอแนะ', 'เรียงตามผลกระทบ · ตัวเลขประมาณจากข้อมูลจริง · หน่วยงานที่เกี่ยวข้องเป็นข้อเสนอ ให้ผู้บริหารพิจารณา', 'สาขา (ตำบล) · ประเภทลูกค้า',
            `<ol class="acts">${A.map((a, i) => `<li><span class="no">${i + 1}</span><div><div class="t1">${a.t}</div><div class="im">${a.imp}</div></div><div class="rt"><span class="prio p${a.p}">${prioL(a.p)}</span><span>${a.own}</span></div></li>`).join('')}</ol>`, { w: 1.4, min: 520 })}
          ${card('c-trend', 'แนวโน้ม 3 เดือนล่าสุด', 'เทียบช่วงเดียวกันปีก่อน', 'สาขา (ตำบล) · ประเภทลูกค้า',
            `<div class="trend2"><div class="g"><div class="h">▲ ดีขึ้น</div><div class="x">${better.join(' · ') || '–'}</div></div><div class="b"><div class="h">▼ แย่ลง</div><div class="x">${worse.join(' · ') || '–'}</div></div></div>
            <p class="small muted" style="margin:10px 0 4px">ไม่รวม กปภ. รายได้ YTD <b class="${xytd.net >= xytdP.net ? 'pos' : 'neg'}">${sgn(xytdP.net ? xytd.net / xytdP.net - 1 : null)}</b> — ธุรกิจหลักยังโต แต่รายได้รวมลดลงเพราะ กปภ. หยุดซื้อ${lastPwa ? `หลัง ${mLabel(lastPwa)}` : ''}</p>
            <p class="small muted" style="margin:0 0 8px">ประมาณการทั้งปี ${mm(fc.fc)} ล้านบาท = ${fc.method}</p>
            <a class="small" href="#revenue">ดูรายละเอียดในหน้า รายได้ตามกลุ่มลูกค้า →</a>`, { w: 1, min: 380 })}
        </div>
      </section></div>`;
    // เก็บตัวเลขชุดเดียวกันไว้ให้สร้างไฟล์นำเสนอแยก (scripts/build-present.js)
    S.snapData = { M, Mp, My, asof: S.asof, fetched: S.fetched, br: S.f.br || null, ty: S.f.ty || null,
      cur, prv, ly, ytd, ytdP, xc, xp, xy, xytd, xytdP, fc, mtd, partial: S.partialMonth, lastPwa,
      rows: rows.map((r) => ({ k: r.g.k, name: r.g.name, cat: r.g.cat, c: r.c, p: r.p, y: r.y, a: r.a, b: r.b, tr: r.tr, sp: r.sp })),
      fee: { c: feeC, p: feeP, y: feeY, a: feeA, b: feeB }, trendMs, season: { year: seasonY, idx: sIdx, hi, lo }, better, worse,
      drought: { m: Y + '-05', t3: snapMonth(Y + '-05', ['T3']).net, t3prev: snapMonth(Y + '-04', ['T3']).net },
      trend: [['T1', ['T1']], ['T2', ['T2', 'T2.1']], ['T3', ['T3']], ['ทอท.', ['T3.1']], ['กปภ.', ['T2.2']], ['อบต.ไม้ขาว', ['T2.3']]].map(([n, t]) => ({ name: n, data: trendMs.map((m) => round2(snapMonth(m, t).net)) })),
      actions: actionPlan().map((a) => ({ p: a.p, t: a.t, what: a.what.replace(/<[^>]+>/g, ''), imp: a.imp, own: a.own, kpi: a.kpi })),
      ar: (() => { const x = arAgg(); return { total: x.total, overdue: x.overdue, b4: x.b[4] }; })() };
    window.HEASnap = S.snapData;
    $('snap-print').onclick = () => window.print();
    const cats = trendMs.map(mLabel);
    // แยกลูกค้าสัญญา · อบต.ไม้ขาว (หอถังสูง) = เฉดเข้มของสี T2 (อยู่กลุ่มลูกค้าทั่วไป) · ตัวเลขในแท่ง = ล้านบาท 1 ตำแหน่ง (แสดงเมื่อ ≥ 0.6 ล้าน) · บนแท่ง = รวม
    const hx = (c) => /^#[0-9a-f]{6}$/i.test(c);
    const htC = hx(C.oliveChart) ? mixHex(C.oliveChart, '#000000', 0.38) : '#45612F';
    const SEGS = [['T1', ['T1'], C.sky], ['T2 (รวม T2.1)', ['T2', 'T2.1'], C.oliveChart], ['อบต.ไม้ขาว (หอถังสูง)', ['T2.3'], htC], ['T3', ['T3'], C.navy], ['ทอท.', ['T3.1'], '#E8833A'], ['กปภ.', ['T2.2'], C.neutral]];
    const lum = (c) => { if (!hx(c)) return 0; const v = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); return 0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2]; };
    const ser = SEGS.map(([name, tys, color]) => ({ name, type: 'bar', stack: 's', barMaxWidth: 30, itemStyle: barStyle(color),
      label: { show: true, position: 'inside', fontSize: 9.5, fontFamily: 'Prompt', color: lum(color) > 150 ? '#1C1C1E' : '#FFFFFF', formatter: (p) => (p.value >= 6e5 ? nf1.format(p.value / 1e6) : '') },
      data: trendMs.map((m) => round2(snapMonth(m, tys).net)) }));
    const totS = trendMs.map((_, i) => round2(sum(ser, (x) => x.data[i] || 0)));
    ser.push({ name: 'รวม', type: 'line', noPulse: true, noLegend: true, data: totS, symbol: 'circle', symbolSize: 1, showSymbol: true, itemStyle: { color: 'rgba(0,0,0,0)' }, lineStyle: { opacity: 0 }, silent: true, tooltip: { show: false }, legendHoverLink: false, z: 10,
      label: { show: true, position: 'top', fontSize: 10, fontWeight: 600, fontFamily: 'Prompt', color: C.body, formatter: (p) => nf1.format(p.value / 1e6) } });
    const low = trendMs.filter((m) => +m.slice(5) >= 5 && +m.slice(5) <= 10);
    const areas = [];
    for (let i = 0; i < low.length; i++) { const s0 = low[i]; let e = s0; while (i + 1 < low.length && low[i + 1] === addM(e, 1)) e = low[++i]; areas.push([{ xAxis: mLabel(s0), itemStyle: { color: 'rgba(123,204,223,0.12)' }, label: { show: true, formatter: 'ฤดูฝน/นอกฤดูท่องเที่ยว', color: C.text2, fontFamily: 'Prompt', fontSize: 11, position: 'insideTop' } }, { xAxis: mLabel(e) }]); }
    ser[0].markArea = { silent: true, data: areas };
    const dm = Y + '-05';
    if (trendMs.includes(dm)) ser[ser.length - 1].markPoint = { symbol: 'pin', symbolSize: 30, symbolOffset: [0, -30], itemStyle: { color: C.text2 }, label: { formatter: 'แล้ง', color: '#fff', fontFamily: 'Prompt', fontSize: 10 }, data: [{ coord: [mLabel(dm), totS[trendMs.indexOf(dm)]] }] };
    chart($('ch-snap'), { grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true }, xAxis: catAxis(cats), yAxis: valAxis(), series: ser, tooltip: { ...chartTT(), formatter: ttMoney() } });
  }
  // ================= ชั้นการตัดสินใจสำหรับผู้บริหาร =================
  // ประมาณการทั้งปี: ยอดจริงถึงเดือนเต็มล่าสุด + ค่าเฉลี่ย 3 เดือนล่าสุด x เดือนที่เหลือ (ฐานหลัง กปภ. หยุดซื้อ)
  function forecastYear() {
    const lf = S.lastFull, y = lf.slice(0, 4), left = 12 - Number(lf.slice(5, 7));
    const ytd = salesAgg(y + '-01', lf).net;
    const run = salesAgg(addM(lf, -2), lf).net / 3;
    const py = String(Number(y) - 1);
    const prev = S.months.includes(py + '-01') ? salesAgg(py + '-01', py + '-12').net : null;
    // ฤดูกาล: เดือนที่เหลือ = เดือนเดียวกันปีก่อน (ไม่รวม กปภ.) x อัตราโต YoY ไม่รวม กปภ. ของ YTD (กปภ. = 0 หลังสัญญาสิ้นสุด)
    const exPWA = (a, b) => sum(S.sales.filter((r) => inR(r.m, a, b) && okBr(r.br) && okTy(r.ty) && r.ty !== 'T2.2'), (r) => r.net);
    const remFrom = addM(lf, 1).replace(y, py), remTo = py + '-12';
    if (left > 0 && S.months.includes(remTo)) {
      const g = exPWA(y + '-01', lf) / Math.max(1, exPWA(py + '-01', addM(lf, -12)));
      const rest = exPWA(remFrom, remTo) * g;
      return { y, left, ytd, run, fc: ytd + rest, prev, rest, method: `ยอดจริง + ${TH_M[+remFrom.slice(5) - 1]}–ธ.ค. ปีก่อนไม่รวม กปภ. × ${nf2.format(g)}` };
    }
    return { y, left, ytd, run, fc: ytd + run * left, prev, method: 'ยอดจริง + เฉลี่ย 3 เดือนล่าสุด' };
  }
  function pipeAgg() {
    const P = S.d.pipeline; if (!P) return null;
    const rows = rowsOf(P).map((r) => ({ ...r, br: r.br === 'นาเตย' ? 'ไม้ขาว' : r.br })).filter((r) => okBr(r.br));
    const open = rows.filter((r) => ['pending', 'processing', 'approved'].includes(r.status));
    const done = (P.done || []).map(([m, n, d]) => ({ m, n, d }));
    const recent = done.filter((x) => x.m >= addM(S.lastFull, -5) && x.m <= S.lastFull);
    return { rows, open, nOpen: sum(open, (r) => r.n), over60: sum(open, (r) => r.over60), done, perMonth: recent.length ? sum(recent, (x) => x.n) / recent.length : 0,
      avgDays: recent.length ? sum(recent, (x) => x.d * x.n) / Math.max(1, sum(recent, (x) => x.n)) : null };
  }
  function actionPlan() {
    const A = [];
    const ar = arAgg(), debt = S.debt.filter((r) => okBr(r.br) && okTy(r.ty));
    // 1) กปภ.
    const pwaMonths = S.sales.filter((r) => r.ty === 'T2.2' && (r.src === 'W' || r.src === 'L') && r.net > 0);
    const pwaByM = {}; pwaMonths.forEach((r) => { pwaByM[r.m] = (pwaByM[r.m] || 0) + r.net; });
    const pm = Object.keys(pwaByM).sort().slice(-12), pwaAvg = pm.length ? sum(pm, (m) => pwaByM[m]) / pm.length : 0;
    const lastPwa = Object.keys(pwaByM).sort().pop();
    if (okBr('ไม้ขาว') && okTy('T2.2') && lastPwa && lastPwa < S.lastFull)
      A.push({ p: 1, t: 'โอกาสทดแทนรายได้ขายส่ง กปภ. ที่หยุดไป', what: `แนวทางที่เป็นไปได้: เจรจาสัญญาขายส่งรอบใหม่ หรือนำน้ำส่วนที่เคยส่ง กปภ. ไปขายลูกค้า T3/โครงการใหม่ตามแนวท่อ (บิลสุดท้าย ${mLabel(lastPwa)})`,
        imp: `−${mb(pwaAvg * 12)} ล้านบาท/ปี ถ้าไม่ทดแทน`, own: 'ผู้บริหาร + ฝ่ายกลยุทธ์', kpi: 'ลบ.ม./วัน ไม่รวม กปภ. · รายได้ไม่รวม กปภ.', pg: 'revenue' });
    // (ตัดข้อเสนอเรื่องติดตามหนี้ออกตามที่ CSO ขอ 11/11/69 — ยังไม่มีผู้รับผิดชอบด้านนี้)
    // 3) ลูกค้าใช้น้ำลดลง
    if (S.cm.length) { const UW = usageWin(addM(S.lastFull, -3), S.lastFull), ur = UW.rows.filter((r) => okBr(r.br) && okTy(r.ty));
      const down = ur.filter((r) => r.k === 'down' || r.k === 'stop'), lost = sum(down, (r) => r.q0 - r.q1), gain = sum(ur.filter((r) => r.k === 'up' || r.k === 'new'), (r) => r.q1 - r.q0);
      const g = revAgg(), gY = Number(S.d.revenue_groups.window[1].slice(0, 4)); const pTy = {}; const prOf = (ty) => { if (!(ty in pTy)) { const a = g(ty, gY); pTy[ty] = a.units ? a.wnet / a.units : 0; } return pTy[ty]; };
      const lostB = sum(down, (r) => (r.q0 - r.q1) * prOf(r.ty)), price = lost ? lostB / lost : 0;
      A.push({ p: 2, t: 'ลูกค้าที่ใช้น้ำลดลงน่าติดตาม', what: `${int(down.length)} รายใช้น้ำลด/หยุดใช้ (${mLabel(UW.m1[0])}–${mLabel(UW.m1[UW.m1.length - 1])} เทียบปีก่อน) รวม ${int(lost)} ลบ.ม. (มีรายที่ใช้เพิ่มชดเชย +${int(gain)} ลบ.ม.) — แนวทาง: เยี่ยม 20 อันดับแรก ตรวจมาตร/รั่ว/แหล่งน้ำทดแทน`,
        imp: `ราว ${mb(lostB * 3)} ล้านบาท/ปี (เฉลี่ย ${nf2.format(price)} บาท/ลบ.ม.)`, own: 'ฝ่ายกลยุทธ์/บริการลูกค้า', kpi: 'จำนวนรายที่ลด ≥ 10% · ลบ.ม. ลูกค้าเดิม', pg: 'usage' }); }
    // 4) ติดตั้งมิเตอร์ใหม่
    const P = pipeAgg();
    if (P && P.nOpen) { const g = revAgg(), gY = Number(S.d.revenue_groups.window[1].slice(0, 4)); const gg = ['T1', 'T2', 'T2.1'].map((k) => g(k, gY)); const arpu = sum(gg, (a) => a.net) / Math.max(1, sum(gg, (a) => a.cm));
      A.push({ p: 2, t: 'โอกาสรายได้จากคำร้องติดตั้งที่ค้าง', what: `คำร้องค้าง ${int(P.nOpen)} ราย (เกิน 60 วัน ${int(P.over60)} ราย) ขณะติดตั้งได้เฉลี่ย ${nf1.format(P.perMonth)} ราย/เดือน ใช้เวลา ~${int(P.avgDays)} วัน — แนวทาง: ตั้งเป้าเคลียร์งานค้าง และเก็บค่าติดตั้ง`,
        imp: `+${mb(P.nOpen * arpu * 12)} ล้านบาท/ปี ค่าน้ำ (ที่ ${int(arpu)} บาท/ราย/เดือน) + ค่าติดตั้ง`, own: 'ฝ่ายปฏิบัติการ/ช่าง', kpi: 'คำร้องค้าง > 60 วัน · ติดตั้งต่อเดือน', pg: 'customers' }); }
    // 4.5) มิเตอร์ไม่หมุน (น้ำสูญเสียเชิงพาณิชย์)
    { const MS = S.d.meter_stuck;
      if (MS && MS.rows && S.d.revenue_groups) { const ga = revAgg(), gy = Number(S.d.revenue_groups.window[1].slice(0, 4));
        const rs = rowsOf(MS).filter((r) => okBr(r.br) && okTy(r.ty) && +r.avg_before > 0 && !(r.n_rounds - r.streak === 1 && r.last_use === MS.first_round));
        const bm = sum(rs, (r) => { const a = ga(r.ty, gy); return a.units ? (+r.avg_before * a.wnet) / a.units : 0; });
        if (rs.length) A.push({ p: 2, t: 'มิเตอร์ที่จดได้เลขเดิมซ้ำ ≥ 3 รอบ', what: `${int(rs.length)} รายเคยใช้น้ำแล้วเลขมาตรไม่ขยับ (${int(rs.filter((r) => r.streak >= 6).length)} รายนานเกิน 6 รอบ) — แนวทาง: ส่งรายชื่อให้หน้างานตรวจว่ามิเตอร์เสียหรือไม่มีผู้ใช้น้ำ และเปลี่ยนมิเตอร์ที่เสีย`,
          imp: `≈ ${mb(bm * 12)} ล้านบาท/ปี (ประมาณ ถ้ามิเตอร์เสียจริง)`, own: 'ฝ่ายปฏิบัติการ/ทีมจดมาตร', kpi: 'จำนวนมิเตอร์ใช้ 0 ≥ 3 รอบ · น้ำสูญเสีย', pg: 'meter' }); } }
    // 5) อัตราหอถัง
    { const g = revAgg(), gY = Number(S.d.revenue_groups.window[1].slice(0, 4)), h = g('T2.3', gY), mo = Number(S.d.revenue_groups.window[1].slice(5, 7));
      if (h.units && okBr('ไม้ขาว')) A.push({ p: 3, t: 'อัตราน้ำ อบต.ไม้ขาว (หอถังสูง) ต่ำสุดทุกกลุ่ม', what: `ใช้น้ำ ${int(h.units)} ลบ.ม. ที่ ${nf2.format(h.wnet / h.units)} บาท/ลบ.ม. — อาจใช้เป็นประเด็นเมื่อเจรจา/ทบทวนเงื่อนไขสัญญา`,
        imp: `ทุก +1 บาท/ลบ.ม. ≈ +${mb(h.units / mo * 12)} ล้านบาท/ปี`, own: 'ผู้บริหาร + กฎหมาย/สัญญา', kpi: 'บาท/ลบ.ม. หอถัง', pg: 'revenue' }); }
    // 6) ข้อมูล
    A.push({ p: 3, t: 'ช่องโหว่ข้อมูลใน WMS ที่ควรปิด', what: 'แนวทาง: นำเข้าบิลลูกค้ารายใหญ่จาก Pay2Head 389 ใบ, ยกเลิกบิล/ทะเบียนทดสอบ, ให้ใบเสร็จบันทึกวันที่รับชำระ และทะเบียนที่สถานะไม่ตรงกับบิล', imp: 'ตัวเลขผู้บริหารไม่ต้องพึ่งไฟล์เสริม', own: 'IT + ผู้พัฒนา WMS', kpi: 'รายการในหน้าคุณภาพข้อมูล', pg: 'quality' });
    return A.sort((a, b) => a.p - b.p);
  }
  function ceoBlock() {
    const fc = forecastYear(), P = pipeAgg(), ar = arAgg(), A = actionPlan();
    const lf = S.lastFull, ly = addM(lf, -12);
    const y1 = salesAgg(lf.slice(0, 4) + '-01', lf), y0 = ly >= S.months[0] ? salesAgg(ly.slice(0, 4) + '-01', ly) : null;
    const exP = (a, b) => sum(S.sales.filter((r) => inR(r.m, a, b) && okBr(r.br) && okTy(r.ty) && r.ty !== 'T2.2'), (r) => r.net);
    const e1 = exP(lf.slice(0, 4) + '-01', lf), e0 = y0 ? exP(ly.slice(0, 4) + '-01', ly) : null;
    const coll = collAgg(lf.slice(0, 4) + '-01', lf);
    const qa = [
      ['เติบโตหรือไม่', y0 ? `ยอดขาย ม.ค.–${mLabel(lf)} ${pctTxt(chg(y1.net, y0.net))} แต่ถ้าไม่นับ กปภ. ${pctTxt(chg(e1, e0))} — ธุรกิจหลักยังโต ปัญหาคือรายได้ขายส่งที่หายไป` : '–', y0 && y1.net < y0.net ? 'warn' : 'good'],
      ['เก็บเงินได้หรือไม่', `รับชำระค่าน้ำ ${pct(y1.billWaterInclVat ? coll.water / y1.billWaterInclVat : null)} ของยอดแจ้งหนี้ · ค้างเกินกำหนด ${mb(ar.overdue)} ล้านบาท (${pct(ar.total ? ar.overdue / ar.total : null)} ของลูกหนี้)`, ar.overdue / Math.max(1, ar.total) > 0.5 ? 'bad' : 'warn'],
      ['ทั้งปีจะจบที่เท่าไร', `ประมาณการปี ${Number(fc.y) + 543} ≈ ${mb(fc.fc)} ล้านบาท${fc.prev ? ` (ปีก่อน ${mb(fc.prev)} · ${pctTxt(chg(fc.fc, fc.prev))})` : ''} — ${fc.method}`, fc.prev && fc.fc < fc.prev ? 'warn' : 'good'],
      ['ลูกค้าใหม่เข้าระบบทันไหม', P ? `คำร้องติดตั้งค้าง ${int(P.nOpen)} ราย (เกิน 60 วัน ${int(P.over60)}) · ติดตั้งได้ ~${nf1.format(P.perMonth)} ราย/เดือน` : 'ไม่มีข้อมูลคำร้อง', P && P.over60 > 20 ? 'warn' : 'good'],
    ];
    const icon = { good: '✓', warn: '⚠', bad: '!' };
    return `
      <div class="grid g4 qa">${qa.map(([q, a, l]) => `<div class="card qa-card ${l}"><div class="qa-q"><span class="qa-ic" aria-hidden="true">${icon[l]}</span>${esc(q)}</div><div class="qa-a">${esc(a)}</div></div>`).join('')}</div>
      <div class="grid" style="margin-top:16px">
        ${card('c-act', 'ข้อเสนอแนะเพื่อพิจารณา', 'เรียงตามลำดับความสำคัญ · ผลกระทบเป็นประมาณการจากข้อมูลจริงในระบบ · ผู้รับผิดชอบเป็นข้อเสนอ ให้ผู้บริหารยืนยัน', 'สาขา (ตำบล) · ประเภทลูกค้า',
          `<div class="tbl-wrap"><table class="t act" data-csvable="1"><thead><tr><th>ลำดับ</th><th>เรื่อง</th><th>แนวทางที่เสนอ</th><th>ผลกระทบ (ประมาณ)</th><th>หน่วยงานที่เกี่ยวข้อง</th><th>ตัวชี้วัดติดตาม</th><th></th></tr></thead><tbody>
          ${A.map((a, i) => `<tr><td class="nw"><span class="prio p${a.p}">${a.p === 1 ? 'ควรพิจารณาก่อน' : a.p === 2 ? 'น่าพิจารณา' : 'ระยะยาว'}</span></td><td><b>${i + 1}. ${a.t}</b></td><td>${a.what}</td><td class="nw">${a.imp}</td><td>${a.own}</td><td class="small">${a.kpi}</td><td class="nw"><a href="#${a.pg}">ดูข้อมูล →</a></td></tr>`).join('')}
          </tbody></table></div>`, { csv: 1 })}
      </div>`;
  }
  const GAPS = [
    ['น้ำผลิตและน้ำสูญเสีย (NRW)', 'ไม่รู้ว่าน้ำที่ผลิตได้ขายได้กี่ % — เป็นตัวกำหนดกำไรและกำลังผลิตที่เหลือไว้ขายลูกค้าใหม่', 'ดึงปริมาณผลิต/จ่ายน้ำรายเดือนจาก SCADA'],
    ['ต้นทุนต่อหน่วย', 'เห็นราคาขายต่อกลุ่ม แต่ไม่เห็นกำไรต่อกลุ่ม — ตัดสินใจราคาหอถัง/กปภ. ได้ไม่ครบ', 'ต้นทุนผลิต+จ่ายน้ำรายเดือนจากบัญชี'],
    ['เป้ายอดขาย', 'เทียบผลงานกับเป้าไม่ได้', 'เป้ารายเดือน × ตำบล × กลุ่มลูกค้า'],
    ['สถานะสัญญา กปภ./ทอท./อบต.', 'ผลกระทบด้านรายได้ขึ้นกับวันหมดสัญญาและราคาใหม่', 'ตารางสัญญา: วันเริ่ม–สิ้นสุด ราคา ปริมาณขั้นต่ำ'],
    ['เงินเข้าบัญชีจริง', 'ยอดรับชำระยังเป็นตามใบเสร็จ', 'กระทบยอดกับ statement ธนาคาร'],
  ];
  // ================= รายได้ตามกลุ่มลูกค้า (รายงานสำหรับผู้บริหาร) =================
  const RG = [
    { k: 'T1', name: 'T1 อัตราก้าวหน้า', cat: 'g' }, { k: 'T2', name: 'T2 อัตราก้าวหน้า', cat: 'g' }, { k: 'T2.1', name: 'T2.1 ตำรวจภูธรภาค 8', cat: 'g' }, { k: 'T3', name: 'T3 อัตราก้าวหน้า', cat: 'g' }, { k: 'T2.3', name: 'อบต.ไม้ขาว (หอถังสูง)', cat: 'g' },
    { k: 'T3.1', name: 'ทอท. (ท่าอากาศยานภูเก็ต)', cat: 'c' }, { k: 'T2.2', name: 'กปภ. (ขายส่ง)', cat: 'c' },
  ];
  const rgOf = (ty) => (RG.find((g) => g.k === ty) ? ty : 'other');
  // ช่วงเดือนที่เลือก (cur) เทียบช่วงเดียวกันปีก่อน (prev) — แปลงแถวรายเดือนเป็น 2 ถัง: y = Y1 (ช่วงนี้) / Y0 (ปีก่อน)
  // ลูกค้าไม่ซ้ำในช่วงนับจาก cust_months (มีบิลอย่างน้อย 1 เดือนในช่วง)
  const revWinCache = {};
  function revWin(from, to) {
    const key = from + '|' + to; if (revWinCache[key]) return revWinCache[key];
    const m1 = monthsBetween(from, to), m0 = m1.map((m) => addM(m, -12)), s1 = new Set(m1), s0 = new Set(m0);
    const Y1 = Number(to.slice(0, 4)), Y0 = Y1 - 1;
    const rows = [];
    S.rev.forEach((r) => { const ym = r.y + '-' + r.mm; if (s1.has(ym)) rows.push({ ...r, ym, y: Y1 }); else if (s0.has(ym)) rows.push({ ...r, ym, y: Y0 }); });
    const ix1 = m1.map((m) => S.cmMonths.indexOf(m)).filter((i) => i >= 0), ix0 = m0.map((m) => S.cmMonths.indexOf(m)).filter((i) => i >= 0);
    const cg = {};
    S.cm.forEach((r) => [[Y1, ix1], [Y0, ix0]].forEach(([y, ix]) => { if (ix.some((i) => r.u[i] != null)) { const k = [y, r.br, r.ty, r.moo].join('|'); (cg[k] = cg[k] || { y, br: r.br, ty: r.ty, moo: r.moo, n: 0 }).n += 1; } }));
    // หัวคอลัมน์: ช่วง ม.ค.–X ปีเดียวกัน = ปี พ.ศ. · ช่วงอื่น = "ช่วงนี้" / "ปีก่อน" (ช่วงเต็มอยู่ในหัวการ์ด)
    const cal = m1[0].slice(5) === '01' && m1[0].slice(0, 4) === m1[m1.length - 1].slice(0, 4);
    const yl = (a, cur) => (cal ? String(+a.slice(0, 4) + 543) : cur ? 'ช่วงนี้' : 'ปีก่อน');
    const def = S.d.revenue_groups.window;
    const ok0 = m0[0] >= ((S.cmMonths[0]) || '0000');
    return (revWinCache[key] = { rows, cust: Object.values(cg), Y1, Y0, m1, m0, ok0,
      W: [m1[0] + '-01', m1[m1.length - 1] + '-31', m0[0] + '-01', m0[m0.length - 1] + '-31'],
      L1: yl(m1[0], true), L0: yl(m0[0], false), isDef: from === def[0].slice(0, 7) && to === def[1].slice(0, 7) });
  }
  const revDef = () => { const w = S.d.revenue_groups.window; return revWin(w[0].slice(0, 7), w[1].slice(0, 7)); };
  function revAgg(pred, RW) {
    RW = RW || revDef();
    const o = {};
    const get = (k, y) => { const key = k + '|' + y; return o[key] || (o[key] = { net: 0, fee: 0, wnet: 0, units: 0, free: 0, cm: 0, cust: 0 }); };
    RW.rows.filter((r) => okBr(r.br) && okTy(r.ty) && (!pred || pred(r))).forEach((r) => {
      const a = get(r.src === 'F' ? 'fee' : rgOf(r.ty), r.y);
      if (r.src === 'F') a.fee += r.net; else a.net += r.net;
      if (r.src === 'W' || (r.src === 'L' && r.units)) { a.wnet += r.net; a.units += r.units || 0; a.free += r.free || 0; }
      if (r.src === 'W' || r.src === 'L') a.cm += r.cm;
    });
    RW.cust.filter((r) => okBr(r.br) && okTy(r.ty) && (!pred || pred(r))).forEach((r) => { get(rgOf(r.ty), r.y).cust += r.n; });
    return (k, y) => o[k + '|' + y] || { net: 0, fee: 0, wnet: 0, units: 0, free: 0, cm: 0, cust: 0 };
  }
  const chg = (a, b) => (b ? (a - b) / Math.abs(b) : null);
  const pctTxt = (v) => (v == null ? '–' : (v >= 0 ? '+' : '') + nf1.format(v * 100) + '%');
  const pillChg = (a, b) => (b ? cmpPill(a, b, '') : '<span class="pill na">ใหม่</span>');

  function pRevenue(el) {
    const RW = revWin(S.f.from, S.f.to), W = RW.W, Y1 = RW.Y1, Y0 = RW.Y0, L1 = RW.L1, L0 = RW.L0;
    const L1s = /^\d{4}$/.test(L1) ? String(+L1 % 100) : L1, L0s = /^\d{4}$/.test(L0) ? String(+L0 % 100) : L0;
    const per = `${mLabel(W[0].slice(0, 7))} – ${mLabel(W[1].slice(0, 7))}`, perPrev = `${mLabel(W[2].slice(0, 7))} – ${mLabel(W[3].slice(0, 7))}`;
    const A = revAgg(null, RW), keys = RG.map((g) => g.k).concat(['other']);
    const tot = (y) => sum(keys, (k) => A(k, y).net) + A('fee', y).fee;
    const t1 = tot(Y1), t0 = tot(Y0);
    const pwa1 = A('T2.2', Y1).net, pwa0 = A('T2.2', Y0).net;
    const gen = (y, f) => sum(RG.filter((g) => g.cat === 'g'), (g) => f(A(g.k, y)));
    const con = (y, f) => sum(RG.filter((g) => g.cat === 'c'), (g) => f(A(g.k, y)));
    const wAll1 = gen(Y1, (a) => a.wnet) + con(Y1, (a) => a.wnet), uAll1 = gen(Y1, (a) => a.units) + con(Y1, (a) => a.units);
    const cmGen1 = gen(Y1, (a) => a.cm), months = RW.m1.length;
    const pwaGap = S.pwaMissing.filter((m) => m >= W[0].slice(0, 7) && m <= W[1].slice(0, 7));
    const row = (g) => { const a = A(g.k, Y1), b = A(g.k, Y0); return { g, a, b }; };
    const rows = RG.map(row).concat([{ g: { k: 'other', name: 'อื่น ๆ / ไม่ระบุ', cat: 'o' }, a: A('other', Y1), b: A('other', Y0) }]).filter((r) => r.a.net || r.b.net);
    const pu = (a) => (a.units ? a.wnet / a.units : null), arpu = (a) => (a.cm ? a.net / a.cm : null);
    const fmtPU = (v) => (v == null ? '–' : nf2.format(v));
    const subtotal = (cat, y) => { const rs = rows.filter((r) => r.g.cat === cat); const s = (f) => sum(rs, (r) => f(y === Y1 ? r.a : r.b)); return { net: s((a) => a.net), wnet: s((a) => a.wnet), units: s((a) => a.units), cm: s((a) => a.cm), cust: s((a) => a.cust) }; };
    const tRow = (label, a, b, cls) => ({ label, a, b, cls });
    const trs = [];
    trs.push({ head: 'ลูกค้าทั่วไป' });
    // หอถัง อบต.: ระบบเดิมบิลรวมทะเบียนเดียว ระบบใหม่ (มี.ค. 69) แยกทะเบียนรายหอ — ไม่เทียบจำนวนราย/รายได้ต่อรายกับปีก่อน
    rows.filter((r) => r.g.cat === 'g').forEach((r) => trs.push(r.g.k === 'T2.3' ? { ...tRow(r.g.name, r.a, r.b), nc: 1, np: 1 } : tRow(r.g.name, r.a, r.b)));
    trs.push(tRow('รวมลูกค้าทั่วไป', subtotal('g', Y1), subtotal('g', Y0), 'sub'));
    trs.push({ head: 'ลูกค้าสัญญารายใหญ่' });
    rows.filter((r) => r.g.cat === 'c').forEach((r) => trs.push({ ...tRow(r.g.name, r.a, r.b), nc: 1 }));
    trs.push({ ...tRow('รวมลูกค้าสัญญารายใหญ่', subtotal('c', Y1), subtotal('c', Y0), 'sub'), nc: 1 });
    const both = (y) => { const g = subtotal('g', y), c = subtotal('c', y); const o = {}; Object.keys(g).forEach((k) => { o[k] = g[k] + c[k]; }); return o; };
    trs.push(tRow('รวมรายได้ขายน้ำ (ทั่วไป + สัญญา)', both(Y1), both(Y0), 'water'));
    rows.filter((r) => r.g.cat === 'o').forEach((r) => trs.push(tRow(r.g.name, r.a, r.b)));
    trs.push(tRow('งานขาย/บริการอื่น (ค่าติดตั้ง ฯลฯ)', { net: A('fee', Y1).fee }, { net: A('fee', Y0).fee }));
    trs.push(tRow('รวมรายได้ทั้งสิ้น', { net: t1 }, { net: t0 }, 'total'));
    // เงินเป็นล้านบาท 2 ตำแหน่ง (CSV ยังเป็นบาทเต็มผ่าน data-v)
    const mbv = (v) => `data-v="${v == null ? '' : Math.round(v * 100) / 100}"`;
    // สัดส่วนปริมาณน้ำ/ลูกค้า เทียบรวมขายน้ำ (ทั่วไป + สัญญา) = 100% · YoY ลบ.ม./ราย เทียบช่วงเดียวกันปีก่อน
    const W1 = both(Y1), chgN = (a, b) => (a && b ? pillChg(a, b) : '–');
    const tbl = `<div class="tbl-wrap" style="max-height:none"><table class="t grp-t rev-t vlines" data-csvable="1"><thead>
      <tr class="gh"><th rowspan="2">กลุ่มลูกค้า</th><th class="c-g gs" colspan="4">รายได้ (ล้านบาท)</th><th class="c-g gs" colspan="5">ปริมาณน้ำและราคาต่อหน่วย</th><th class="c-g gs" colspan="5">ลูกค้า</th></tr>
      <tr><th class="n gs">${L0}</th><th class="n">${L1}</th><th class="n">YoY</th><th class="n">สัดส่วน</th>
      <th class="n gs">ลบ.ม. ${L1}</th><th class="n">YoY</th><th class="n">สัดส่วน</th><th class="n">บาท/ลบ.ม. ${L0s}</th><th class="n">บาท/ลบ.ม. ${L1s}</th><th class="n gs">ราย ${L1}</th><th class="n">YoY</th><th class="n">สัดส่วน</th><th class="n">บาท/ราย/เดือน ${L0s}</th><th class="n">บาท/ราย/เดือน ${L1s}</th></tr></thead><tbody>
      ${trs.map((r) => r.head ? `<tr class="grp"><td colspan="15">${r.head}</td></tr>` : `<tr class="${r.cls || ''}"><td>${esc(r.label)}${r.label.startsWith('อบต.ไม้ขาว') && morganMissing() ? ` <span class="pill warn" title="${esc(MORGAN_TXT)}">⚠ ไม่รวม ม.มอร์แกน</span>` : ''}${r.label.startsWith('กปภ') && pwaGap.length ? ` <span class="pill warn" title="${esc(pwaTxt(pwaGap))}">⚠ ไม่มีรายได้ ${pwaGap.length} เดือน</span>` : ''}</td>
        <td class="n gs muted" ${mbv(r.b.net)}>${mb(r.b.net)}</td><td class="n" ${mbv(r.a.net)}><b>${mb(r.a.net)}</b></td><td class="n">${r.b.net ? pillChg(r.a.net, r.b.net) : '–'}</td><td class="n">${pct(t1 ? r.a.net / t1 : null)}</td>
        <td class="n gs">${r.a.units ? int(r.a.units) : '–'}</td><td class="n">${chgN(r.a.units, r.b.units)}</td><td class="n">${r.a.units && W1.units ? pct(r.a.units / W1.units) : '–'}</td><td class="n">${fmtPU(r.b.units ? r.b.wnet / r.b.units : null)}</td><td class="n">${fmtPU(r.a.units ? r.a.wnet / r.a.units : null)}</td>
        <td class="n gs">${r.a.cust ? int(r.a.cust) : '–'}</td><td class="n">${r.nc ? '<span class="muted" title="นับตามทะเบียนมาตร ปีก่อนบางรายออกบิลรวมใบเดียว — ไม่เทียบจำนวนราย">–</span>' : chgN(r.a.cust, r.b.cust)}</td><td class="n">${r.a.cust && W1.cust ? pct(r.a.cust / W1.cust) : '–'}</td><td class="n">${r.np ? '<span class="muted" title="ปีก่อนออกบิลรวมทะเบียนเดียว — ไม่เทียบรายได้ต่อราย">–</span>' : r.b.cm ? int(r.b.net / r.b.cm) : '–'}</td><td class="n">${r.a.cm ? int(r.a.net / r.a.cm) : '–'}</td></tr>`).join('')}
      </tbody></table></div>`;

    // ตำบล x กลุ่ม
    const brs = ['ไม้ขาว', 'สาคู'].filter(okBr);
    const brTbl = '<div class="tam2">' + brs.map((br) => { const B = revAgg((r) => r.br === br, RW); const rs = RG.map((g) => ({ g, a: B(g.k, Y1), b: B(g.k, Y0) })).filter((r) => r.a.net || r.b.net);
      const ta = sum(rs, (r) => r.a.net), tb = sum(rs, (r) => r.b.net);
      return `<div class="tam"><div class="tam-h"><h4>ตำบล${br}</h4><span>รวม <b>${mb(ta)}</b> ล้านบาท ${tb ? pillChg(ta, tb) : ''}</span></div>` + table([
        { h: 'กลุ่ม', f: (r) => esc(r.g.name.replace(' อัตราก้าวหน้า', '')) }, { h: L0, n: 1, cls: 'muted', f: (r) => mb(r.b.net), v: (r) => round2(r.b.net) }, { h: L1, n: 1, f: (r) => `<b>${mb(r.a.net)}</b>`, v: (r) => round2(r.a.net) },
        { h: 'YoY', n: 1, f: (r) => (r.b.net ? pillChg(r.a.net, r.b.net) : '–') }, { h: 'บาท/ลบ.ม.', n: 1, f: (r) => fmtPU(pu(r.a)) }, { h: 'ลูกค้า', n: 1, f: (r) => int(r.a.cust) }, { h: 'บาท/ราย/เดือน', n: 1, f: (r) => (r.a.cm ? int(arpu(r.a)) : '–') },
      ], rs, ['รวม', { h: mb(tb), v: round2(tb) }, { h: mb(ta), v: round2(ta) }, tb ? pctTxt(chg(ta, tb)) : '', '', '', '']) + '</div>'; }).join('') + '</div>';

    // หมู่ (ลูกค้าทั่วไป)
    const moos = {};
    RW.rows.filter((r) => okBr(r.br) && okTy(r.ty) && (r.src === 'W' || r.src === 'C') && !['T2.2', 'T3.1'].includes(r.ty) && ['ไม้ขาว', 'สาคู'].includes(r.br)).forEach((r) => {
      const k = r.br + '|' + r.moo, x = moos[k] || (moos[k] = { br: r.br, moo: r.moo, n1: 0, n0: 0, u1: 0, cm1: 0, cm0: 0, c1: 0 });
      if (r.y === Y1) { x.n1 += r.net; x.u1 += r.units || 0; x.cm1 += r.cm; } else { x.n0 += r.net; x.cm0 += r.cm; }
    });
    RW.cust.filter((r) => r.y === Y1 && okBr(r.br) && okTy(r.ty) && !['T2.2', 'T3.1'].includes(r.ty)).forEach((r) => { const x = moos[r.br + '|' + r.moo]; if (x) x.c1 += r.n; });
    const moo = Object.values(moos).filter((x) => (x.n1 || x.n0) && okMoo(x.br, x.moo)).sort((a, b) => a.br.localeCompare(b.br) || (a.moo === 'ไม่ระบุหมู่') - (b.moo === 'ไม่ระบุหมู่') || a.moo.localeCompare(b.moo, 'th', { numeric: true }));
    const mooSel = S.f.moo || '';

    // insight (คำนวณจากข้อมูล)
    const g1 = subtotal('g', Y1), g0 = subtotal('g', Y0);
    const T3 = A('T3', Y1), T3b = A('T3', Y0), T2 = A('T2', Y1), T2b = A('T2', Y0), HT = A('T2.3', Y1), AOT = A('T3.1', Y1), PW = A('T2.2', Y1);
    const ex1 = t1 - pwa1, ex0 = t0 - pwa0;
    const moov = moo.filter((x) => x.n0 > 300000 && x.moo !== 'ไม่ระบุหมู่').map((x) => ({ ...x, c: chg(x.n1, x.n0) })).sort((a, b) => a.c - b.c);
    const ins = [];
    if (t0) ins.push(['bad', `รายได้รวม ${per} ${pctTxt(chg(t1, t0))} (${mb(t1)} เทียบ ${mb(t0)} ล้านบาท)`, `ส่วนที่หายไปมาจาก กปภ. ${mb(pwa1 - pwa0)} ล้านบาท${pwaGap.length ? ` (${pwaTxt(pwaGap)})` : ''} · ถ้าไม่นับ กปภ. รายได้ ${pctTxt(chg(ex1, ex0))}`]);
    if (T3.net) ins.push(['info', `T3 เป็นแหล่งรายได้หลัก ${pct(T3.net / t1)} ของรายได้ และโต ${pctTxt(chg(T3.net, T3b.net))}`, `ปริมาณน้ำ T3 ${pctTxt(chg(T3.units, T3b.units))} ขณะราคาต่อหน่วยคงที่ ${fmtPU(pu(T3))} บาท/ลบ.ม. — การเติบโตมาจากปริมาณใช้น้ำของโรงแรม/คอนโด ลูกค้าเพียง ${int(T3.cust)} ราย รายได้เฉลี่ย ${int(arpu(T3))} บาท/ราย/เดือน`]);
    if (HT.units) ins.push(['warn', `อบต.ไม้ขาว (หอถังสูง) ใช้น้ำมากที่สุด ${int(HT.units)} ลบ.ม. แต่ราคาต่ำสุด ${fmtPU(pu(HT))} บาท/ลบ.ม.`, `เทียบ T1 ${fmtPU(pu(A('T1', Y1)))} · กปภ. ${fmtPU(pu(PW))} · ทอท. ${fmtPU(pu(AOT))} · T3 ${fmtPU(pu(T3))} บาท/ลบ.ม. — ทุก 1 บาท/ลบ.ม. ≈ ${mb(HT.units / months * 12)} ล้านบาท/ปี`]);
    if (T2.cust && T2b.cust) ins.push(['info', `T2 ลูกค้าเพิ่ม ${pctTxt(chg(T2.cust, T2b.cust))} แต่รายได้ต่อรายลดลง ${pctTxt(chg(arpu(T2), arpu(T2b)))}`, `รายได้ T2 รวม ${pctTxt(chg(T2.net, T2b.net))} — ลูกค้าใหม่ใช้น้ำน้อยกว่ารายเดิม ปริมาณน้ำรวม ${pctTxt(chg(T2.units, T2b.units))}`]);
    if (moov.length) { const lo = moov[0], hi = moov[moov.length - 1];
      ins.push(['info', `รายได้ตามหมู่: ${lo.br} ${lo.moo} ${pctTxt(lo.c)} · ${hi.br} ${hi.moo} ${pctTxt(hi.c)}`, `ความเปลี่ยนแปลงในระดับหมู่มาจากลูกค้า T3 ไม่กี่ราย (โรงแรม/คอนโด) — ดูรายชื่อที่หน้า “การใช้น้ำเทียบปีก่อน”`]); }
    const rec = [
      ['โอกาสหาลูกค้าแทนน้ำขายส่ง กปภ.', `กปภ. เคยซื้อเฉลี่ย ~${int(PW.units / Math.max(1, new Set(RW.rows.filter((r) => r.y === Y1 && r.ty === 'T2.2' && r.net > 0).map((r) => r.ym)).size))} ลบ.ม./เดือน ที่ ${fmtPU(pu(PW))} บาท/ลบ.ม. หากขายน้ำส่วนนี้ให้ลูกค้า T3 ได้ 10,000 ลบ.ม./เดือน ≈ +${mb(10000 * (pu(T3) || 0) * 12)} ล้านบาท/ปี — แนวทาง: จัดลำดับโครงการ/โรงแรมตามแนวท่อในแต่ละหมู่ที่ยังไม่เป็นลูกค้า หรือเจรจาสัญญา กปภ. รอบใหม่`],
      ['อัตราน้ำ อบต.ไม้ขาว (หอถังสูง) ต่ำสุดทุกกลุ่ม', `ราคาเฉลี่ย ${fmtPU(pu(HT))} บาท/ลบ.ม. ต่ำกว่าทุกกลุ่ม ทั้งที่ปริมาณสูงสุด — อาจใช้เป็นประเด็นเมื่อเจรจา/ทบทวนเงื่อนไขสัญญาสัมปทาน (ทุก +1 บาท ≈ +${mb(HT.units / months * 12)} ล้านบาท/ปี)`],
      ['ลูกค้า T3 แหล่งรายได้หลัก', `T3 ${int(T3.cust)} รายสร้างรายได้ ${pct(T3.net / t1)} — แนวทาง: มีผู้ดูแลลูกค้ารายใหญ่ ติดตามรายที่ใช้น้ำลดลง (มีรายชื่อในหน้าการใช้น้ำ) ตรวจมาตร/สอบถามแหล่งน้ำทดแทน และเสนอการเชื่อมต่อให้โครงการใหม่`],
      ['ทอท.: รอบต่ออายุสัญญา', `รายได้ ${mb(AOT.net)} ล้านบาท ที่ ${fmtPU(pu(AOT))} บาท/ลบ.ม. — แนวทาง: ใช้รอบต่อสัญญาทบทวนราคา/ปริมาณขั้นต่ำ`],
      ['ลูกค้า T2 และ T2.1', `T2 รายได้ต่อรายลดลง — แนวทาง: ตรวจการจัดประเภท (รายที่ใช้น้ำสูงควรเป็น T3) และสิทธิ์น้ำฟรี · T2.1 ตำรวจภูธรภาค 8 ราคา ${fmtPU(pu(A('T2.1', Y1)))} บาท/ลบ.ม. ต่ำกว่า T2 (${fmtPU(pu(T2))}) อาจทบทวนเงื่อนไขอัตรา`],
    ];
    // ป้ายผลกระทบ (สีเขียว ชิดขวา) ของข้อเสนอแนะแต่ละข้อ — คำนวณจากตัวเลขชุดเดียวกับข้อความ
    const recImp = [`+${mb(10000 * (pu(T3) || 0) * 12)} ล้าน/ปี`, `+${mb(HT.units / months * 12)} ล้าน/ปี ต่อ 1 บาท`, `${pct(t1 ? T3.net / t1 : null)} ของรายได้`, `${mb(AOT.net)} ล้าน/ปี`, 'ทบทวนอัตรา'];

    setScope(`${per} เทียบ ${perPrev} · ไม่รวม VAT`);
    const nameS = (n) => n.replace(' อัตราก้าวหน้า', '').replace(' (ท่าอากาศยานภูเก็ต)', '').replace(' (ขายส่ง)', '').replace(' ตำรวจภูธรภาค 8', ' ตำรวจ');
    el.innerHTML = `
      <div class="kpis">
        ${kpi(`รายได้ ${per}`, mb(t1), 'ล้านบาท', `รายได้ทุกกลุ่มลูกค้า ไม่รวม VAT · ปีก่อน ${mb(t0)} ล้านบาท${pwaGap.length ? ' · ไม่มีรายได้ กปภ. ' + pwaTxt(pwaGap) : ''}`, [cmpRow('YoY', t1, t0, { warn: pwaGap.length ? 'มีเดือนที่ไม่มีรายได้ กปภ. (หน้าแล้ง/สัญญาสิ้นสุด)' : null }), ['ปีก่อน', mb(t0) + ' ล้าน', 'v-mute']])}
        ${kpi('รายได้ไม่รวม กปภ.', mb(ex1), 'ล้านบาท', `ฐานธุรกิจต่อเนื่อง (ไม่นับน้ำขายส่ง กปภ. ที่สัญญาสิ้นสุด) · ปีก่อน ${mb(ex0)} ล้านบาท`, [cmpRow('YoY', ex1, ex0), ['ปีก่อน', mb(ex0) + ' ล้าน', 'v-mute']], 'accent')}
        ${kpi('ราคาเฉลี่ยต่อหน่วย', nf2.format(uAll1 ? wAll1 / uAll1 : 0), 'บาท/ลบ.ม.', 'รายได้ค่าน้ำ+บริการ ÷ ลบ.ม. ที่ออกใบแจ้งหนี้ ทุกกลุ่มที่มีหน่วยน้ำ', [['ปริมาณน้ำ', int(uAll1) + ' ลบ.ม.', 'v-mute']])}
        ${kpi('รายได้ต่อราย/เดือน (ลูกค้าทั่วไป)', int(cmGen1 ? g1.net / cmGen1 : 0), 'บาท', 'รายได้ลูกค้าทั่วไป ÷ จำนวนบิลรายเดือน', [cmpRow('YoY', cmGen1 ? g1.net / cmGen1 : 0, g0.cm ? g0.net / g0.cm : 0), ['ลูกค้าทั่วไป', int(g1.cust) + ' ราย', 'v-mute']])}
      </div>
      <div class="row">
        ${card('c-rev', `รายได้แยกกลุ่มลูกค้า ${per}`, 'ล้านบาท ไม่รวม VAT · หักส่วนลดและใบลดหนี้แล้ว · บาท/ลบ.ม. = รายได้ค่าน้ำ+บริการ ÷ ลบ.ม. ที่ออกใบแจ้งหนี้ · ต่อราย = รายได้ ÷ จำนวนบิลรายเดือน · หน่วยน้ำลูกค้าสัญญาก่อน มี.ค. 69 จากไฟล์ตรวจเทียบ Pay2Head', 'ช่วงเดือน · สาขา (ตำบล) · ประเภทลูกค้า', tbl, { csv: 1, csvLabel: 'CSV (บาทเต็ม)' })}
      </div>
      <div class="row">
        ${card('c-revbar', `รายได้แยกกลุ่ม ${L0} เทียบ ${L1}`, `ล้านบาท · ${per}`, 'ช่วงเดือน · สาขา (ตำบล) · ประเภทลูกค้า', '<div class="chart" id="ch-revbar" style="height:380px"></div>', { table: 1, min: 520 })}
        ${card('c-pu', 'รายได้ต่อหน่วยแยกกลุ่ม', `บาท/ลบ.ม. ปี ${L1} · เส้นประ = ค่าเฉลี่ยทุกกลุ่ม ${nf2.format(uAll1 ? wAll1 / uAll1 : 0)}`, 'ช่วงเดือน · สาขา (ตำบล) · ประเภทลูกค้า', '<div class="chart" id="ch-pu" style="height:380px"></div>', { table: 1, min: 520, foot: '<span id="pu-foot"></span>' })}
      </div>
      <div class="row">
        ${card('c-mix', 'สัดส่วนรายได้ · ปริมาณน้ำ · จำนวนลูกค้า', 'คิดจากการขายน้ำ (ลูกค้าทั่วไป + ลูกค้าสัญญา = 100%) ไม่รวมงานขาย/บริการอื่น · เห็นว่ากลุ่มไหนลูกค้าน้อยแต่สร้างรายได้มาก', 'ช่วงเดือน · สาขา (ตำบล) · ประเภทลูกค้า',
          '<div id="mix-chart"></div><div id="t-mix" hidden></div>', { csv: 1, tools: '<div class="seg2 sm" role="group" aria-label="มุมมอง"><button type="button" data-mv="c" aria-pressed="true">กราฟ</button><button type="button" data-mv="t" aria-pressed="false">ตาราง</button></div>' })}
      </div>
      <div class="row">
        ${card('c-brg', 'รายได้แยกตำบล × กลุ่มลูกค้า', `ล้านบาท · ${per} เทียบปีก่อน · สาขาไม้ขาว = ตำบลไม้ขาว, สาขาสาคู = ตำบลสาคู`, 'ช่วงเดือน · สาขา (ตำบล) · ประเภทลูกค้า', brTbl, { csv: 1 })}
      </div>
      <div class="row">
        ${card('c-moo', 'รายได้ลูกค้าทั่วไปแยกหมู่', 'บาท · หมู่ตามทะเบียนผู้ใช้น้ำ (ที่ตั้งมาตร) ถ้าทะเบียนไม่ระบุหรือตำบลไม่ตรงจึงใช้ที่อยู่ในใบแจ้งหนี้ แล้วจึงชื่อพื้นที่จดมาตร (ไม่รวมลูกค้าสัญญารายใหญ่) · “ไม่ระบุหมู่” = ทะเบียนและใบแจ้งหนี้ไม่มีเลขหมู่ในตำบลไม้ขาว/สาคู · แถบ YoY ตัดที่ ±50%', 'ช่วงเดือน · สาขา (ตำบล) · ประเภทลูกค้า · หมู่', '<div id="t-moo"></div>', { csv: 1 })}
      </div>
      <div class="row">
        ${card('c-ins', 'สรุปข้อสังเกต (Insight)', 'สรุปจากตัวเลขทั้งหน้าตามตัวกรองที่เลือก', 'ช่วงเดือน · สาขา (ตำบล) · ประเภทลูกค้า', `<ul class="ilist">${ins.map(([l, t, d]) => `<li><span class="ic ${l}" aria-hidden="true">${l === 'bad' ? '!' : l === 'warn' ? '⚠' : 'i'}</span><div><div class="t1">${esc(t)}</div><div class="d">${esc(d)}</div></div></li>`).join('')}</ul>`, { min: 520 })}
        ${card('c-rec', 'ข้อเสนอแนะเพื่อเพิ่มรายได้ (เพื่อพิจารณา)', 'ตัวเลขประมาณการจากข้อมูลช่วงนี้ ใช้ประกอบการตัดสินใจ ไม่ใช่ผลที่รับประกัน', '', `<ol class="ilist rec">${rec.map(([t, d], i) => `<li><span class="no">${i + 1}</span><div><div class="t1">${esc(t)}</div><div class="d">${esc(d)}</div></div>${recImp[i] ? `<span class="imp">${esc(recImp[i])}</span>` : ''}</li>`).join('')}</ol>`, { min: 520 })}
      </div>`;
    void nameS;
    $('t-moo').innerHTML = table([
      { h: 'ตำบล', nw: 1, k: 'br' }, { h: 'หมู่', nw: 1, k: 'moo' }, { h: 'ลูกค้า', n: 1, f: (x) => int(x.c1) }, { h: `รายได้ ${L0}`, n: 1, f: (x) => baht(x.n0) }, { h: `รายได้ ${L1}`, n: 1, f: (x) => baht(x.n1) },
      { h: 'YoY', cls: 'dv-cell', f: (x) => { if (!x.n0) return '–'; const c = chg(x.n1, x.n0), w = Math.min(1, Math.abs(c) / 0.5) * 100; return `<span class="dvb"><span class="l">${c < 0 ? `<i style="width:${w.toFixed(1)}%"></i>` : ''}</span><span class="r">${c >= 0 ? `<i style="width:${w.toFixed(1)}%"></i>` : ''}</span><b class="${c >= 0 ? 'v-good' : 'v-bad'}">${pctTxt(c)}</b></span>`; }, v: (x) => (x.n0 ? pctTxt(chg(x.n1, x.n0)) : '') }, { h: 'ลบ.ม.', n: 1, f: (x) => int(x.u1) }, { h: 'บาท/ลบ.ม.', n: 1, f: (x) => (x.u1 ? nf2.format(x.n1 / x.u1) : '–') }, { h: 'รายได้/ราย/เดือน', n: 1, f: (x) => (x.cm1 ? int(x.n1 / x.cm1) : '–') },
    ], moo, ['รวม', '', int(sum(moo, (x) => x.c1)), baht(sum(moo, (x) => x.n0)), baht(sum(moo, (x) => x.n1)), '', int(sum(moo, (x) => x.u1)), '', '']);
    void mooSel;
    const cats = rows.filter((r) => r.g.cat !== 'o').map((r) => r.g.name.replace(' อัตราก้าวหน้า', '').replace(' (ท่าอากาศยานภูเก็ต)', '').replace(' (ขายส่ง)', ''));
    const lab = (bold) => ({ show: true, position: 'right', fontFamily: 'Prompt', fontSize: 11, fontWeight: bold ? 600 : 400, color: bold ? C.body : C.text2, formatter: (p) => nf2.format(p.value / 1e6) });
    const sb = [
      { name: L0, type: 'bar', barWidth: 11, barGap: '15%', itemStyle: { color: C.sky, borderRadius: [0, 3, 3, 0] }, label: lab(false), data: rows.filter((r) => r.g.cat !== 'o').map((r) => round2(r.b.net)) },
      { name: L1, type: 'bar', barWidth: 11, itemStyle: { color: C.navy, borderRadius: [0, 3, 3, 0] }, label: lab(true), data: rows.filter((r) => r.g.cat !== 'o').map((r) => round2(r.a.net)) },
    ];
    chart($('ch-revbar'), { grid: { left: 8, right: 48, top: 36, bottom: 8, containLabel: true }, yAxis: { ...catAxis(cats), inverse: true, axisTick: { show: false } }, xAxis: valAxis((v) => nf0.format(v / 1e6)), series: sb, tooltip: { ...chartTT(), formatter: ttMoney() } });
    chartTable('c-revbar', cats, sb.map((s) => ({ name: s.name, data: s.data })));
    // ---- สัดส่วนรายได้ / ปริมาณน้ำ / ลูกค้า ----
    const mr = rows.filter((r) => r.g.cat !== 'o');
    const short = (n) => n.replace(' อัตราก้าวหน้า', '').replace(' (ท่าอากาศยานภูเก็ต)', '').replace(' (ขายส่ง)', '').replace(' (หอถังสูง)', '').replace(' ตำรวจภูธรภาค 8', ' ตำรวจ');
    const T21C = /^#[0-9a-f]{6}$/i.test(C.oliveChart) && /^#[0-9a-f]{6}$/i.test(C.surface || '') ? mixHex(C.oliveChart, C.surface, 0.55) : '#C9D9B6';
    const txtOn = (hex) => { if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#fff'; const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? '#1C1C1E' : '#fff'; };
    const MC = { 'T1': C.sky, 'T2': C.oliveChart, 'T2.1': T21C, 'T3': C.navy, 'T3.1': '#E8833A', 'T2.2': C.neutral, 'T2.3': /^#[0-9a-f]{6}$/i.test(C.oliveChart) ? mixHex(C.oliveChart, '#000000', 0.38) : '#45612F' };
    const tot3 = (y) => ({ net: sum(mr, (r) => (y === Y1 ? r.a : r.b).net), units: sum(mr, (r) => (y === Y1 ? r.a : r.b).units), cust: sum(mr, (r) => (y === Y1 ? r.a : r.b).cust) });
    const T1x = tot3(Y1), T0x = tot3(Y0);
    const sh = (v, t) => (t ? v / t : null);
    const MK = [['net', 'รายได้'], ['units', 'ปริมาณน้ำ'], ['cust', 'จำนวนลูกค้า']];
    const ms = mr.map((r) => ({ name: short(r.g.name), type: 'bar', stack: 'm', barWidth: 34, itemStyle: { color: MC[r.g.k] || C.neutral, borderColor: C.surface || '#fff', borderWidth: 1 },
      label: { show: true, formatter: (p) => (p.value >= 6 ? nf0.format(p.value) + '%' : ''), color: txtOn(MC[r.g.k] || C.neutral), fontFamily: 'Prompt', fontSize: 11, fontWeight: 600 },
      data: MK.map(([k]) => (T1x[k] ? Math.round(r.a[k] / T1x[k] * 1000) / 10 : 0)) }));
    const shr = (r, k) => (T1x[k] ? r.a[k] / T1x[k] : 0);
    const big = mr.slice().sort((a, b) => shr(b, 'net') - shr(a, 'net'))[0], hiU = mr.slice().sort((a, b) => (shr(b, 'units') - shr(b, 'net')) - (shr(a, 'units') - shr(a, 'net')))[0];
    $('mix-chart').innerHTML = `<div class="legend-row">${mr.map((r) => `<span><i style="background:${MC[r.g.k] || C.neutral}"></i>${esc(short(r.g.name))}</span>`).join('')}</div>
      <div class="mixbars">${MK.map(([k, l], i) => `<div class="mb-l">${l} <span class="muted">${L1}</span></div><div class="mb-b" role="img" aria-label="${l}: ${ms.map((x) => x.name + ' ' + nf1.format(x.data[i]) + '%').join(', ')}">${ms.map((x, j) => (x.data[i] > 0 ? `<span style="width:${x.data[i]}%;background:${MC[mr[j].g.k] || C.neutral};color:${txtOn(MC[mr[j].g.k] || C.neutral)}" title="${esc(x.name)} ${nf1.format(x.data[i])}%">${x.data[i] >= 6 ? nf0.format(x.data[i]) + '%' : ''}</span>` : '')).join('')}</div>`).join('')}</div>
      <p class="card-foot">${big ? `${esc(short(big.g.name))} มีลูกค้าเพียง ${pct(shr(big, 'cust'))} แต่สร้างรายได้ ${pct(shr(big, 'net'))}` : ''}${hiU && hiU !== big ? ` · ${esc(short(hiU.g.name))} ใช้น้ำ ${pct(shr(hiU, 'units'))} แต่รายได้แค่ ${pct(shr(hiU, 'net'))}` : ''}</p>`;
    document.querySelectorAll('#c-mix [data-mv]').forEach((b) => b.addEventListener('click', () => {
      const t = b.dataset.mv === 't'; $('mix-chart').hidden = t; $('t-mix').hidden = !t;
      document.querySelectorAll('#c-mix [data-mv]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }));
    const pc = (v) => (v == null ? '–' : v > 0 && v < 0.0005 ? '<0.1%' : nf1.format(v * 100) + '%');
    const dpp = (a, b) => (a == null || b == null ? '' : (() => { const d = (a - b) * 100; return Math.abs(d) < 0.05 ? '' : ` <span class="small" style="color:var(--${d > 0 ? 'status-good' : 'status-bad'})">${d > 0 ? '▲' : '▼'}${nf1.format(Math.abs(d))}</span>`; })());
    const cell = (r, k, cls) => { const a = sh(r.a[k], T1x[k]), b = sh(r.b[k], T0x[k]); return `<td class="n gs ${cls || ''}">${pc(b)}</td><td class="n ${cls || ''}"><b>${pc(a)}</b>${dpp(a, b)}</td>`; };
    const subR = (cat, label) => { const rs = mr.filter((r) => r.g.cat === cat); const f = (y) => ({ net: sum(rs, (r) => (y === Y1 ? r.a : r.b).net), units: sum(rs, (r) => (y === Y1 ? r.a : r.b).units), cust: sum(rs, (r) => (y === Y1 ? r.a : r.b).cust) }); return { g: { name: label }, a: f(Y1), b: f(Y0), sub: 1 }; };
    const mixRows = [{ head: 'ลูกค้าทั่วไป' }, ...mr.filter((r) => r.g.cat === 'g'), subR('g', 'รวมลูกค้าทั่วไป'), { head: 'ลูกค้าสัญญารายใหญ่' }, ...mr.filter((r) => r.g.cat === 'c'), subR('c', 'รวมลูกค้าสัญญา')];
    const yy = (y) => String(y + 543).slice(2);
    $('t-mix').innerHTML = `<div class="tbl-wrap" style="max-height:none"><table class="t mix-t grp-t vlines" data-csvable="1"><thead>
      <tr class="gh"><th rowspan="2">กลุ่ม</th><th class="c-g gs" colspan="2">💰 สัดส่วนรายได้</th><th class="c-g gs" colspan="2">💧 สัดส่วนปริมาณน้ำ</th><th class="c-g gs" colspan="2">👥 สัดส่วนลูกค้า</th></tr>
      <tr><th class="n gs">${L0}</th><th class="n">${L1}</th><th class="n gs">${L0}</th><th class="n">${L1}</th><th class="n gs">${L0}</th><th class="n">${L1}</th></tr></thead><tbody>
      ${mixRows.map((r) => (r.head ? `<tr class="grp"><td colspan="7">${r.head}</td></tr>` : `<tr class="${r.sub ? 'sub' : ''}"><td class="nw">${r.g.k ? `<span class="dot" style="background:${MC[r.g.k]}"></span>` : ''}${esc(short(r.g.name))}</td>${cell(r, 'net')}${cell(r, 'units')}${cell(r, 'cust')}</tr>`)).join('')}
      <tr class="total"><td>รวมขายน้ำ</td><td class="n gs">100%</td><td class="n">100%</td><td class="n gs">100%</td><td class="n">100%</td><td class="n gs">100%</td><td class="n">100%</td></tr>
      </tbody></table></div><div class="small" style="margin-top:6px;color:var(--text-2)">▲▼ = เปลี่ยนกี่จุด % จากปีก่อน · ลูกค้า = จำนวนรายที่มีบิลในช่วง</div>`;
    const puRows = rows.filter((r) => r.g.cat !== 'o' && r.a.units).sort((a, b) => pu(b.a) - pu(a.a));
    const avg = uAll1 ? wAll1 / uAll1 : 0;
    const ps = [{ name: 'บาท/ลบ.ม.', type: 'bar', barMaxWidth: 22, itemStyle: { borderRadius: [0, 4, 4, 0], color: (p) => (p.value < avg ? C.orange : C.navy) }, data: puRows.map((r) => Math.round(pu(r.a) * 100) / 100),
      label: { show: true, position: 'right', color: C.body, fontFamily: 'Prompt', formatter: (p) => nf2.format(p.value) },
      markLine: { silent: true, symbol: 'none', lineStyle: { color: C.text2, type: 'dashed' }, label: { formatter: 'เฉลี่ย ' + nf2.format(avg), position: 'start', color: C.text2, fontFamily: 'Prompt' }, data: [{ xAxis: Math.round(avg * 100) / 100 }] } }];
    chart($('ch-pu'), { legend: { show: false }, grid: { left: 8, right: 56, top: 24, bottom: 8, containLabel: true }, xAxis: valAxis((v) => nf0.format(v)), yAxis: { ...catAxis(puRows.map((r) => r.g.name.replace(' อัตราก้าวหน้า', ''))), inverse: true, axisTick: { show: false } }, series: ps, tooltip: { ...chartTT(), valueFormatter: (v) => nf2.format(v) + ' บาท/ลบ.ม.' } });
    const lowest = puRows[puRows.length - 1];
    if ($('pu-foot')) $('pu-foot').textContent = `แท่งสีส้ม = ต่ำกว่าค่าเฉลี่ย${lowest ? ` · ${lowest.g.name} ต่ำสุดที่ ${fmtPU(pu(lowest.a))} บาท/ลบ.ม.` : ''}`;
    chartTable('c-pu', puRows.map((r) => r.g.name), ps.map((s) => ({ name: s.name, data: s.data })), 'p2');
  }

  // ================= การใช้น้ำเทียบปีก่อน (ย้ายจาก WMS dashboard เดิม) =================
  const UK = { up: ['ใช้น้ำเพิ่มขึ้น (≥ +10%)', 'up'], flat: ['ใกล้เคียงเดิม (±10%)', 'na'], down: ['ใช้น้ำลดลง (≤ −10%)', 'down'], new: ['เริ่มใช้น้ำ/ลูกค้าใหม่', 'up'], stop: ['ไม่มีการใช้น้ำ/หยุดใช้', 'down'] };
  const AUDIT = { active_no_bill: 'ทะเบียนใช้งาน แต่ไม่มีบิล 2 เดือนล่าสุด', inactive_billed: 'ทะเบียนงด/ยกเลิก แต่ยังออกบิลเดือนล่าสุด', pending_billed: 'ทะเบียนรอติดตั้ง แต่มีบิลแล้ว' };
  // ช่วงเปรียบเทียบของหน้าการใช้น้ำ: เดือนที่เลือก (ตัดที่เดือนเต็มล่าสุดที่มีข้อมูลรายผู้ใช้น้ำ) เทียบเดือนเดียวกันปีก่อน
  // จัดกลุ่มรายทะเบียน (รวมทุกสาขาของใบแจ้งหนี้): ใหม่ / หยุดใช้ / เพิ่ม ≥10% / ลด ≥10% / ใกล้เคียง — เกณฑ์เดียวกับ SQL 14
  const CONTRACT = ['T2.2', 'T3.1'];
  function usageWin(from, to) {
    const ms = S.cmMonths, cmax = ms[ms.length - 1];
    const t = to > cmax ? cmax : to, f = from > t ? t : from;
    const m1 = monthsBetween(f, t), m0 = m1.map((m) => addM(m, -12));
    const i1 = m1.map((m) => ms.indexOf(m)), i0 = m0.map((m) => ms.indexOf(m));
    const by = new Map();
    for (const r of S.cm) {
      if (CONTRACT.includes(r.ty) || r.ty === 'T2.3') continue;
      const q = (ix) => ix.reduce((a, i) => a + (i >= 0 && typeof r.u[i] === 'number' ? r.u[i] : 0), 0);
      const q1 = q(i1), q0 = q(i0);
      let x = by.get(r.reg);
      if (!x) { x = { reg: r.reg, name: r.name, ty: r.ty, br: r.br, bq: -1, q0: 0, q1: 0 }; by.set(r.reg, x); }
      x.q0 += q0; x.q1 += q1;
      if (q0 + q1 > x.bq) { x.bq = q0 + q1; x.br = r.br; }
    }
    // หอถัง อบต.: ก่อน มี.ค. 69 บิลรวมทะเบียนเดียว (หน่วยจากไฟล์ตรวจเทียบ) หลังจากนั้นแยกรายหอ — เทียบเป็น 1 รายรวมทุกหอ
    const htU = (ms) => sum(S.sales.filter((r) => r.ty === 'T2.3' && ms.includes(r.m) && (r.src === 'W' || (r.src === 'L' && r.units))), (r) => r.units);
    const h1 = htU(m1), h0 = htU(m0);
    if (h1 || h0) by.set('HT', { reg: 'หอถัง อบต. (รวมทุกหอ)', name: 'อบต.ไม้ขาว (หอถังสูง)', ty: 'T2.3', br: 'ไม้ขาว', bq: 0, q0: h0, q1: h1 });
    const rows = [...by.values()].map((x) => ({ ...x, k: x.q0 === 0 && x.q1 === 0 ? null : x.q0 === 0 ? 'new' : x.q1 === 0 ? 'stop' : x.q1 >= x.q0 * 1.1 ? 'up' : x.q1 <= x.q0 * 0.9 ? 'down' : 'flat' })).filter((x) => x.k);
    return { m1, m0, clipped: to > cmax, rows };
  }
  function pUsage(el) {
    const U = S.d.usage_compare;
    const UW = usageWin(S.f.from, S.f.to), lastM = UW.m1[UW.m1.length - 1], Y1 = Number(lastM.slice(0, 4)), Y0 = Y1 - 1;
    const rng = (a) => (a.length === 1 ? mLabel(a[0]) : `${mLabel(a[0])}–${mLabel(a[a.length - 1])}`);
    const per1 = rng(UW.m1), per0 = rng(UW.m0);
    const ur = UW.rows.filter((r) => okBr(r.br) && okTy(r.ty));
    const st = ['up', 'flat', 'down', 'new', 'stop'].flatMap((k) => MOO_BR.concat(['อื่น ๆ']).map((b) => {
      const x = ur.filter((r) => r.k === k && (b === 'อื่น ๆ' ? !MOO_BR.includes(r.br) : r.br === b));
      return { br: b, k, n: x.length, q0: sum(x, (r) => r.q0), q1: sum(x, (r) => r.q1) };
    })).filter((r) => r.n);
    const days = (m) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
    const qd = (m, tys) => snapMonth(m, tys).units / days(m);
    const ex1 = sum(st, (r) => r.q1), ex0 = sum(st, (r) => r.q0);
    const nDown = sum(st.filter((r) => r.k === 'down'), (r) => r.n), qDown = sum(st.filter((r) => r.k === 'down'), (r) => r.q0 - r.q1);
    const nUp = sum(st.filter((r) => r.k === 'up'), (r) => r.n), qUp = sum(st.filter((r) => r.k === 'up'), (r) => r.q1 - r.q0);
    const au0 = (U.audit || []).filter((r) => okBr(r[2]));
    const nNoBill = au0.filter((r) => r[6] === 'active_no_bill').length, nInBill = au0.filter((r) => r[6] === 'inactive_billed').length, nPend = au0.filter((r) => r[6] === 'pending_billed').length;
    setScope(`${per1} เทียบ ${per0}`);
    el.innerHTML = `
      <div class="kpis">
        ${kpi(`ปริมาณน้ำ ${mLabel(lastM)}`, int(qd(lastM, S.types)), 'ลบ.ม./วัน', `ปริมาณน้ำที่ออกใบแจ้งหนี้ ÷ จำนวนวันในเดือน (เดือนสุดท้ายของช่วงที่เลือก)${UW.clipped ? ' · เดือนที่ยังไม่ครบไม่นำมาเทียบ' : ''}`, [['ไม่รวม กปภ.', int(qd(lastM, S.types.filter((t) => t !== 'T2.2'))) + ' ลบ.ม./วัน', 'v-mute']])}
        ${kpi(`ลูกค้าทั่วไป ${per1}`, int(ex1), 'ลบ.ม.', `ลูกค้าทั่วไป (ไม่รวม กปภ. ทอท.) · เทียบ ${per0} ${int(ex0)} ลบ.ม.`, [cmpRow('YoY', ex1, ex0), [per0, int(ex0) + ' ลบ.ม.', 'v-mute']], 'accent')}
        ${kpi('ลูกค้าที่ใช้น้ำลดลง ≥ 10%', int(nDown), 'ราย', `${per1} เทียบ ${per0} · ลดลงรวม ${int(qDown)} ลบ.ม.`, [['ลดลงรวม', '−' + int(qDown) + ' ลบ.ม.', 'v-bad'], ['หยุดใช้', int(sum(st.filter((r) => r.k === 'stop'), (r) => r.n)) + ' ราย', 'v-mute']], '', { vcls: 'v-bad' })}
        ${kpi('ลูกค้าที่ใช้น้ำเพิ่มขึ้น ≥ 10%', int(nUp), 'ราย', `${per1} เทียบ ${per0} · เพิ่มรวม ${int(qUp)} ลบ.ม.`, [['เพิ่มรวม', '+' + int(qUp) + ' ลบ.ม.', 'v-good'], ['ลูกค้าใหม่', int(sum(st.filter((r) => r.k === 'new'), (r) => r.n)) + ' ราย', 'v-mute']], '', { vcls: 'v-good' })}
      </div>
      <div class="row">
        ${card('c-qd', `<span id="qd-title"></span>`, `แท่ง = ปี ${Y1 + 543} แยกประเภทลูกค้า · เส้น = ยอดรวมแต่ละปี · ลูกค้าสัญญา = ทอท. กปภ. · หน่วยน้ำลูกค้าสัญญาก่อน มี.ค. 69 จากไฟล์ตรวจเทียบ Pay2Head`, 'สาขา (ตำบล)',
          `<div class="yoy-chips" id="qd-chips"></div><div class="chart tall" id="ch-qd"></div>`, { table: 1, foot: '<span id="qd-foot"></span>', tools: '<div class="seg2 sm" role="group" aria-label="ตัวชี้วัดของกราฟ"><button type="button" data-mt="u" aria-pressed="true">ปริมาณน้ำ (ลบ.ม./วัน)</button><button type="button" data-mt="r" aria-pressed="false">รายได้ค่าน้ำ (ล้านบาท)</button></div>' })}
      </div>
      <div class="row">
        ${card('c-qst', 'ลูกค้าตามการเปลี่ยนแปลงการใช้น้ำ', `${per1} เทียบ ${per0} · ลูกค้าทั่วไป (ไม่รวม กปภ. ทอท.) · ช่วงเดียวกันทั้งสองปีเพื่อตัดผลฤดูกาล`, 'ช่วงเดือน · สาขา (ตำบล) · ประเภทลูกค้า', '<div id="t-qst"></div>', { csv: 1, w: 1.3, min: 660 })}
        ${card('c-fall', 'ที่มาของปริมาณน้ำที่เปลี่ยนไป', `ลบ.ม. · จาก ${int(ex0)} (${per0}) เป็น ${int(ex1)} (${per1}) = ${ex1 - ex0 >= 0 ? '+' : '−'}${int(Math.abs(ex1 - ex0))}`, 'ช่วงเดือน · สาขา (ตำบล) · ประเภทลูกค้า', '<div id="fall"></div>', { w: 1, min: 420, foot: '<span id="fall-foot"></span>' })}
      </div>
      <div class="row">
        ${card('c-qdecl', '20 อันดับลูกค้าทั่วไปที่ใช้น้ำลดลงมากที่สุด', `ลบ.ม. ${per1} เทียบ ${per0} · อาจสอบถามลูกค้า ตรวจมาตร/รั่ว/แหล่งน้ำทดแทน`, 'ช่วงเดือน · สาขา (ตำบล) · ประเภทลูกค้า', '<div id="t-qdecl"></div>', { csv: 1 })}
      </div>
      <div class="row">
        ${card('c-aud', 'ตรวจทะเบียนเทียบการออกบิล', 'รายที่สถานะทะเบียนกับการออกบิลไม่สอดคล้อง (สาขาที่เปิดอยู่) · คำอธิบายจากหน้างานยังไม่มีในฐานข้อมูล', 'สาขา (ตำบล)', '<div id="t-aud"></div>',
          { csv: 1, tools: `<span class="chips">${nNoBill ? `<span class="pill warn">ใช้งานแต่ไม่มีบิล ${nNoBill}</span>` : ''}${nInBill ? `<span class="pill down">งด/ยกเลิกแต่ยังออกบิล ${nInBill}</span>` : ''}${nPend ? `<span class="pill warn">รอติดตั้งแต่มีบิล ${nPend}</span>` : ''}</span>` })}
      </div>`;
    const gs = ['up', 'flat', 'down', 'new', 'stop'].map((k) => { const x = st.filter((r) => r.k === k); const by = (b) => sum(x.filter((r) => r.br === b), (r) => r.n); return { k, mk: by('ไม้ขาว'), sk: by('สาคู'), n: sum(x, (r) => r.n), q0: sum(x, (r) => r.q0), q1: sum(x, (r) => r.q1) }; });
    $('t-qst').innerHTML = table([
      { h: 'การเปลี่ยนแปลง', f: (r) => `<span class="pill ${UK[r.k][1]}">${UK[r.k][0]}</span>` }, { h: 'ไม้ขาว', n: 1, f: (r) => int(r.mk) }, { h: 'สาคู', n: 1, f: (r) => int(r.sk) }, { h: 'รวม (ราย)', n: 1, f: (r) => int(r.n) },
      { h: `ลบ.ม. ${per0}`, n: 1, f: (r) => int(r.q0) }, { h: `ลบ.ม. ${per1}`, n: 1, f: (r) => int(r.q1) }, { h: 'ผลต่าง', n: 1, f: (r) => (r.q1 - r.q0 >= 0 ? '+' : '') + int(r.q1 - r.q0) },
    ], gs, ['รวม', int(sum(gs, (r) => r.mk)), int(sum(gs, (r) => r.sk)), int(sum(gs, (r) => r.n)), int(ex0), int(ex1), (ex1 - ex0 >= 0 ? '+' : '') + int(ex1 - ex0)]);
    // กราฟน้ำตก: ปีก่อน → +ใช้เพิ่ม → ±ใกล้เคียง → −ใช้ลด → +ลูกค้าใหม่ → −หยุดใช้ → ปีนี้ (คำนวณจากตารางด้านซ้าย)
    const steps = ['up', 'flat', 'down', 'new', 'stop'].map((k) => [{ up: 'ใช้น้ำเพิ่มขึ้น', flat: 'ใกล้เคียงเดิม', down: 'ใช้น้ำลดลง', new: 'ลูกค้าใหม่', stop: 'หยุดใช้' }[k], gs.find((g) => g.k === k)]).map(([n, g]) => [n, g.q1 - g.q0]);
    let run = ex0; const fl = [{ n: per0, a: 0, b: ex0, tot: 1 }];
    steps.forEach(([n, dv]) => { fl.push({ n, a: run, b: run + dv, dv }); run += dv; });
    fl.push({ n: per1, a: 0, b: run, tot: 1 });
    const vals = fl.flatMap((f) => (f.tot ? [f.b] : [f.a, f.b])), hi = Math.max(...vals) * 1.03, lo = Math.max(0, Math.min(...fl.filter((f) => !f.tot).flatMap((f) => [f.a, f.b])) * 0.7);
    const sc = (v) => Math.max(0, (v - lo) / (hi - lo) * 100);
    $('fall').innerHTML = `<div class="fall" role="img" aria-label="ปริมาณน้ำ ${esc(per0)} ${int(ex0)} ลบ.ม. → ${esc(per1)} ${int(run)} ลบ.ม. · ${steps.map(([n, d]) => n + ' ' + (d >= 0 ? '+' : '−') + int(Math.abs(d))).join(' · ')}">${fl.map((f) => {
      const l = f.tot ? 0 : sc(Math.min(f.a, f.b)), w = f.tot ? sc(f.b) : Math.max(0.6, Math.abs(sc(f.b) - sc(f.a)));
      return `<span class="fl-n${f.tot ? ' tot' : ''}">${esc(f.n)}</span><span class="fl-t"><i class="${f.tot ? 'tot' : f.dv >= 0 ? 'pos' : 'neg'}" style="left:${l.toFixed(2)}%;width:${w.toFixed(2)}%"></i></span><b class="${f.tot ? '' : f.dv >= 0 ? 'v-good' : 'v-bad'}">${f.tot ? int(f.b) : (f.dv >= 0 ? '+' : '−') + int(Math.abs(f.dv))}</b>`;
    }).join('')}</div><div class="fl-axis muted small">แกนเริ่มที่ ${int(lo)} ลบ.ม. (ไม่ได้เริ่มที่ 0) เพื่อให้เห็นการเปลี่ยนแปลง</div>`;
    const gDown = gs.find((g) => g.k === 'down'), gUp = gs.find((g) => g.k === 'up');
    $('fall-foot').innerHTML = `${gUp.q1 - gUp.q0 + (gDown.q1 - gDown.q0) >= 0 ? 'รายที่ใช้น้ำเพิ่มชดเชยรายที่ลดได้ทั้งหมด แต่' : 'รายที่ใช้น้ำเพิ่มชดเชยรายที่ลดไม่หมด —'} <b class="v-bad">${int(gDown.n)} รายที่ใช้ลด</b> หายไป ${int(gDown.q0 - gDown.q1)} ลบ.ม. — ควรติดตาม 20 อันดับแรกด้านล่าง`;
    const dl = ur.filter((r) => r.k === 'down' || r.k === 'stop').sort((a, b) => (a.q1 - a.q0) - (b.q1 - b.q0) || (a.reg < b.reg ? -1 : 1)).slice(0, 20);
    const dMax = Math.max(1, ...dl.map((r) => r.q0 - r.q1));
    $('t-qdecl').innerHTML = table([
      { h: '#', n: 1, f: (r) => `<span class="rank">${dl.indexOf(r) + 1}</span>`, v: (r) => dl.indexOf(r) + 1 }, { h: 'ทะเบียน', nw: 1, cls: 'muted', k: 'reg' }, { h: 'ชื่อ', k: 'name', cls: 'name' }, { h: 'สาขา', nw: 1, cls: 'muted', k: 'br' }, { h: 'ประเภท', nw: 1, f: (r) => `<span class="ty ${r.ty === 'T3' ? 't3' : ''}">${esc(TY_NAME[r.ty] || r.ty)}</span>`, v: (r) => r.ty },
      { h: `ลบ.ม. ${per0}`, n: 1, cls: 'muted', f: (r) => int(r.q0) }, { h: `ลบ.ม. ${per1}`, n: 1, f: (r) => int(r.q1) }, { h: 'ผลต่าง (ลบ.ม.)', cls: 'bar-cell', f: (r) => `<span class="hb"><span class="track"><i style="width:${((r.q0 - r.q1) / dMax * 100).toFixed(1)}%"></i></span><b>−${int(r.q0 - r.q1)}</b></span>`, v: (r) => r.q1 - r.q0 },
      { h: '%', n: 1, f: (r) => `<b class="v-bad">${r.q0 ? '−' + nf1.format(Math.abs((r.q1 - r.q0) / r.q0 * 100)) + '%' : '–'}</b>`, v: (r) => (r.q0 ? nf1.format((r.q1 - r.q0) / r.q0 * 100) : '') },
    ], dl);
    const au = (U.audit || []).map(([reg, name, br, status, ty, lb, issue, inst]) => ({ reg, name, br, status, ty, lb, issue, inst })).filter((r) => okBr(r.br));
    // ข้อสังเกตเพิ่ม: ติดตั้งมาตรภายใน 2 เดือนล่าสุด = ยังไม่ครบรอบออกบิล (ไม่ใช่ความผิดพลาด) · กปภ. = สัญญาสิ้นสุด
    const [ly, lm] = S.lastFull.split('-').map(Number), winStart = lm === 1 ? `${ly - 1}-12-01` : `${ly}-${String(lm - 1).padStart(2, '0')}-01`;
    const auWhy = (r) => (r.issue !== 'active_no_bill' ? '' : r.inst && r.inst >= winStart ? `<span class="info-line">ⓘ ติดตั้งมาตร ${dLabel(r.inst)} — ยังไม่ครบรอบจดและออกบิล</span>`
      : r.ty === 'T2.2' ? '<span class="info-line">ⓘ สัญญาขายส่ง กปภ. สิ้นสุดแล้ว — ทะเบียนยังเป็นสถานะใช้งาน</span>'
      : r.inst ? `<span class="warn-line">⚠ ติดตั้งมาตรตั้งแต่ ${dLabel(r.inst)} แต่ยังไม่มีบิล</span>` : '');
    $('t-aud').innerHTML = au.length ? table([
      { h: 'ทะเบียน', nw: 1, k: 'reg' }, { h: 'ชื่อ', f: (r) => esc(r.name || '–'), cls: 'name' }, { h: 'สาขา', nw: 1, k: 'br' }, { h: 'สถานะทะเบียน', nw: 1, f: (r) => esc(STATUS_TH[r.status] || r.status) },
      { h: 'บิลล่าสุด', nw: 1, f: (r) => (r.lb ? dLabel(r.lb) : 'ไม่เคยมีบิล') }, { h: 'ข้อสังเกต', f: (r) => `<span class="pill warn">⚠ ${esc(AUDIT[r.issue] || r.issue)}</span>${auWhy(r)}`, v: (r) => (AUDIT[r.issue] || r.issue) + (r.inst ? ` · ติดตั้งมาตร ${r.inst}` : '') },
    ], au) : '<div class="state">ไม่พบรายการที่ไม่สอดคล้อง</div>';
    drawYoY(Y0, Y1, lastM, S.qdMetric || 'u');
    document.querySelectorAll('#c-qd .seg2 button').forEach((b) => b.addEventListener('click', () => {
      S.qdMetric = b.dataset.mt;
      document.querySelectorAll('#c-qd .seg2 button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      drawYoY(Y0, Y1, lastM, S.qdMetric);
    }));
  }
  // กราฟเทียบรายปี: แท่งซ้อน = ปีปัจจุบันแยก T1/T2/T3/ลูกค้าสัญญา · เส้น = ยอดรวมปีนี้ vs ปีก่อน (ม.ค.–ธ.ค.)
  function drawYoY(Y0, Y1, lastM, mt) {
    document.querySelectorAll('#c-qd .seg2 button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.mt === mt)));
    const mm = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
    const days = (m) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
    const has = (m) => S.months.includes(m) && m <= lastM;
    const val = (m, tys) => { if (!has(m)) return null; const x = snapMonth(m, tys); return mt === 'u' ? Math.round(x.units / days(m)) : round2(x.net); };
    const htC = /^#[0-9a-f]{6}$/i.test(C.oliveChart) ? mixHex(C.oliveChart, '#000000', 0.38) : '#45612F';
    const GR = [['T1', ['T1'], C.sky], ['T2 (รวม T2.1)', ['T2', 'T2.1'], C.oliveChart], ['อบต.ไม้ขาว (หอถังสูง)', ['T2.3'], htC], ['T3', ['T3'], C.navy], ['ลูกค้าสัญญา (ทอท. กปภ.)', ['T3.1', 'T2.2'], C.neutral]];
    const ALL = GR.flatMap((g) => g[1]);
    const y1 = (m) => `${Y1}-${m}`, y0 = (m) => `${Y0}-${m}`;
    const tot = (m) => { const v = GR.map((g) => val(m, g[1])); return v.some((x) => x == null) ? null : (mt === 'u' ? v.reduce((a, b) => a + b, 0) : round2(v.reduce((a, b) => a + b, 0))); };
    const mil = (v) => nf2.format(v / 1e6);
    const ser = GR.map(([name, tys, color]) => ({ name, tys, type: 'bar', stack: 's', barMaxWidth: 34, itemStyle: barStyle(color), data: mm.map((m) => val(y1(m), tys)) }));
    ser.push({ name: `รวมปี ${Y0 + 543}`, type: 'line', noPulse: true, symbolSize: 7, z: 5, lineStyle: { width: 2.5, type: 'dashed' }, itemStyle: { color: C.text2 }, data: mm.map((m) => tot(y0(m))) });
    ser.push({ name: `รวมปี ${Y1 + 543}`, type: 'line', symbolSize: 8, z: 6, lineStyle: { width: 3 }, itemStyle: { color: '#E8833A' }, data: mm.map((m) => tot(y1(m))) });
    const li = Number(lastM.slice(5, 7)) - 1, lv = ser[ser.length - 1].data[li];
    if (!REDUCED && lastM.slice(0, 4) === String(Y1) && lv != null) ser.push({ type: 'effectScatter', name: '', data: [[TH_M[li], lv]], symbolSize: 9, z: 7, tooltip: { show: false }, silent: true, itemStyle: { color: '#E8833A' }, rippleEffect: { scale: 3.2, brushType: 'stroke', period: 2.4 }, animationDelay: 2200 });
    const unitTxt = mt === 'u' ? 'ลบ.ม./วัน' : 'ล้านบาท';
    $('qd-title').textContent = `${mt === 'u' ? 'ปริมาณน้ำต่อวัน' : 'รายได้ค่าน้ำ (ไม่รวม VAT)'} รายเดือน ปี ${Y1 + 543} เทียบ ${Y0 + 543} (${unitTxt})`;
    const upto = mm.filter((m) => has(y1(m)));
    const ytd = (Y, tys) => upto.reduce((a, m) => { const x = snapMonth(`${Y}-${m}`, tys); return a + (mt === 'u' ? x.units : x.net); }, 0);
    const chip = (name, tys) => { const a = ytd(Y1, tys), b = ytd(Y0, tys); if (!b) return ''; const d = (a / b - 1) * 100;
      if (Math.abs(d) < 0.05) return `<span class="yc"><b>${esc(name)}</b> ● ทรงตัว</span>`;
      return `<span class="yc ${d >= 0 ? 'up' : 'down'}"><b>${esc(name)}</b> ${d >= 0 ? '▲ +' : '▼ '}${nf1.format(d)}%</span>`; };
    // ประโยคสรุปใต้กราฟ: เดือนที่ลดแรงสุด + ลูกค้าทั่วไป vs ลูกค้าสัญญา (สะสม)
    {
      const yo = upto.map((m) => { const a = tot(y1(m)), b = tot(y0(m)); return { m, c: a != null && b ? a / b - 1 : null }; }).filter((x) => x.c != null);
      const worst = yo.slice().sort((a, b) => a.c - b.c)[0];
      const CG = GR[GR.length - 1], gT = GR.filter((g) => g !== CG).flatMap((g) => g[1]), cT = CG[1];
      const gA = ytd(Y1, gT), gB = ytd(Y0, gT), cA = ytd(Y1, cT), cB = ytd(Y0, cT);
      const pp = (a, b) => (b ? (a / b - 1) * 100 : null), sg = (v) => (v == null ? '–' : (v >= 0 ? '+' : '−') + nf1.format(Math.abs(v)) + '%');
      const f = $('qd-foot');
      if (f) f.innerHTML = `${worst && worst.c < 0 ? `ลดลงแรงสุดเดือน <b>${TH_M[+worst.m - 1]} ${(Y1 + 543) % 100}</b> (${sg(worst.c * 100)} เทียบปีก่อน) · ` : ''}สะสม ม.ค.–${TH_M[upto.length - 1]}: ลูกค้าทั่วไป (T1–T3 + หอถัง อบต.) <b class="${gA >= gB ? 'v-good' : 'v-bad'}">${sg(pp(gA, gB))}</b> · ลูกค้าสัญญา <b class="${cA >= cB ? 'v-good' : 'v-bad'}">${sg(pp(cA, cB))}</b>${cA < cB ? ' — ยอดรวมที่ลดมาจากลูกค้าสัญญา (กปภ. ไม่มีการส่งน้ำหลังสัญญาสิ้นสุด)' : ''}`;
    }
    $('qd-chips').innerHTML = `<span class="yc-l">${mt === 'u' ? 'ปริมาณน้ำ' : 'รายได้ค่าน้ำ'} ม.ค.–${TH_M[upto.length - 1]} ${Y1 + 543} เทียบช่วงเดียวกันปี ${Y0 + 543}:</span>` +
      GR.map((g) => chip(g[0], g[1])).join('') + chip('รวม', ALL);
    const fmtV = (v) => (v == null ? '–' : mt === 'u' ? nf0.format(v) : mil(v) + ' ล้านบาท');
    const tt = (ps) => {
      const arr = Array.isArray(ps) ? ps : [ps]; const i = arr[0].dataIndex;
      const a = tot(y1(mm[i])), b = tot(y0(mm[i]));
      const yoy = a != null && b ? ((a / b - 1) * 100) : null;
      const yy = (v1, v0) => (v1 == null || !v0 ? '' : ` <span style="color:${v1 >= v0 ? C.good : C.bad}">${v1 >= v0 ? '▲ +' : '▼ '}${nf1.format((v1 / v0 - 1) * 100)}%</span>`);
      return `<b>${TH_M[i]}</b> <span style="opacity:.7">(เทียบ ${TH_M[i]} ${Y0 + 543})</span><br>` + arr.filter((p) => p.seriesType !== 'effectScatter').map((p) => {
        const g = GR.find((x) => x[0] === p.seriesName);
        return `${p.marker}${esc(p.seriesName)}: <b>${fmtV(p.value)}</b>${g ? yy(p.value, val(y0(mm[i]), g[1])) : ''}`;
      }).join('<br>') +
        (yoy != null ? `<br><b>YoY ${yoy >= 0 ? '▲ +' : '▼ '}${nf1.format(yoy)}%</b>` : '');
    };
    const el = $('ch-qd'); const old = echarts.getInstanceByDom(el);
    if (old) { S.charts = S.charts.filter((c) => c !== old); old.dispose(); }
    chart(el, { grid: { left: 8, right: 16, top: 44, bottom: 8, containLabel: true }, xAxis: catAxis(TH_M), yAxis: valAxis((v) => (mt === 'u' ? nf0.format(v) : nf1.format(v / 1e6))), series: ser, tooltip: { ...chartTT(), trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: tt } });
    chartTable('c-qd', TH_M, ser.filter((s) => s.type !== 'effectScatter').map((s) => ({ name: s.name, data: s.data })), mt === 'u' ? 'u' : undefined);
  }

  const Q = {
    dup_identical: ['ใบแจ้งหนี้ซ้ำทุกค่า (เลขที่ ลูกค้า วันที่ ยอด หน่วย)', 'ตัดออกเหลือ 1 ใบในยอดขายแล้ว', 'แก้แล้วใน dashboard'],
    dup_number_diff: ['เลขที่ใบแจ้งหนี้ซ้ำแต่ข้อมูลต่างกัน', 'นับทุกใบ (เป็นคนละเอกสารที่ใช้เลขชนกัน)', 'รอตรวจสอบ'],
    inv_cancelled: ['ใบแจ้งหนี้สถานะยกเลิก', 'ไม่นับในยอดขาย', 'ข้อมูลอ้างอิง'],
    inv_no_customer: ['ใบแจ้งหนี้ไม่มีผู้ใช้น้ำ', 'นับเป็น “ไม่ระบุ”', 'ข้อมูลอ้างอิง'],
    inv_no_type: ['ใบแจ้งหนี้ที่ผู้ใช้น้ำไม่มีประเภท', 'นับเป็น “ไม่ระบุ/รอตรวจสอบ”', 'ข้อมูลอ้างอิง'],
    inv_branch_inactive: ['ใบแจ้งหนี้ของสาขาที่ปิดแล้ว (นาเตย/หล่อยูง)', 'แสดงแยกสาขาตามเดิม', 'ข้อมูลอ้างอิง'],
    inv_zero_total_free: ['ใบแจ้งหนี้ยอด 0 จากส่วนลด/น้ำฟรีทั้งใบ', 'นับหน่วยน้ำ ยอดขายสุทธิ 0 (ยอดเงินในคอลัมน์ = ส่วนลดรวม)', 'ข้อมูลอ้างอิง'],
    inv_negative: ['ใบแจ้งหนี้ยอดหรือหน่วยติดลบ', 'นับตามจริง', 'ข้อมูลอ้างอิง'],
    inv_units_gt_5000: ['ใบแจ้งหนี้หน่วย > 5,000 ลบ.ม. (ลูกค้ารายใหญ่)', 'นับตามจริง ควรสุ่มตรวจมาตรวัด (ยอด = ลบ.ม.)', 'ข้อมูลอ้างอิง'],
    paid_no_receipt: ['ใบแจ้งหนี้สถานะชำระแล้วแต่ไม่พบใบเสร็จ (ในช่วง)', 'ยอดรับชำระตามใบเสร็จจึงต่ำกว่าจริง', 'รอตรวจสอบ'],
    paid_multi_receipt: ['ใบแจ้งหนี้ที่มีใบเสร็จมากกว่า 1 ใบ', 'นับทุกใบเสร็จ (อาจเป็นการชำระบางส่วน)', 'รอตรวจสอบ'],
    receipt_ne_invoice: ['ยอดใบเสร็จไม่เท่ายอดใบแจ้งหนี้', 'นับตามใบเสร็จ', 'รอตรวจสอบ'],
    receipt_dup_number: ['เลขที่ใบเสร็จซ้ำ (เลขชนกัน ข้อมูลต่างกัน)', 'นับทุกใบ', 'รอตรวจสอบ'],
    receipt_no_paydate: ['ใบเสร็จไม่มีวันที่รับชำระ', 'ใช้วันที่ออกใบเสร็จแทน', 'ข้อมูลอ้างอิง'],
    cn_test: ['ใบลดหนี้ทดสอบที่ยังไม่ยกเลิก', 'ยังนับในยอดขาย (ยอดน้อย) ควรยกเลิกในระบบ', 'รอตรวจสอบ'],
    receipt_zero_total: ['ใบเสร็จยอด 0 (หักด้วยใบลดหนี้ทั้งใบ)', 'ไม่มีผลต่อยอดรับชำระ (ยอดเงินในคอลัมน์ = VAT ในใบเสร็จ)', 'ข้อมูลอ้างอิง'],
    date_be_year: ['เอกสารบันทึกวันที่เป็นปี พ.ศ.', 'ใบเสร็จแปลงเป็น ค.ศ. ก่อนนับ (ยอดเงิน = ใบเสร็จ) · ใบแจ้งหนี้เก่าไม่อยู่ในช่วงรายงาน', 'แก้แล้วใน dashboard'],
    receipt_branch_ne_invoice: ['ใบเสร็จระบุสาขาต่างจากใบแจ้งหนี้ (ส่วนใหญ่ระบบเดิมบันทึกเป็นนาเตย)', 'ใช้สาขาของใบแจ้งหนี้', 'แก้แล้วใน dashboard'],
    fee_type_unknown: ['ใบแจ้งหนี้งานขายที่ไม่ผูกผู้ใช้น้ำ/ประเภท', 'นับเป็น “ไม่ระบุ/รอตรวจสอบ”', 'ข้อมูลอ้างอิง'],
  };
  function pQuality(el) {
    const items = S.d.quality.items;
    const notes = [
      ['กปภ. (T2.2) ไม่มีรายได้บางเดือน: สัญญาขายส่งสิ้นสุดแล้ว (บิลสุดท้าย ก.ค. 69) และ พ.ค. 69 หน้าแล้งไม่มีน้ำส่ง', S.pwaMissing.length ? pwaTxt(S.pwaMissing) : 'ไม่พบ', 'ยอดขายเดือนดังกล่าวลดลงจริง · การเปรียบเทียบ YoY ติดเครื่องหมาย ⚠ เพื่อให้รู้ว่าเปรียบเทียบกับช่วงที่ยังมี กปภ.'],
      ['ลูกค้ารายใหญ่ 3 ราย (กปภ. ทอท. หอถัง อบต.) ก่อน มี.ค. 69 ออกบิลในระบบงานขาย ไม่มีหน่วยน้ำ', 'นำยอดเงินจากใบแจ้งหนี้งานขาย (INT/IMK) มารวมเป็นค่าน้ำ + เติมหน่วยน้ำ (ลบ.ม.) จากไฟล์ตรวจเทียบ Pay2Head 389 ใบ (ยอดเงินตรงกับ WMS ทุกเดือน)', `ใช้ชั่วคราวจนกว่าโปรแกรมเมอร์นำเข้า WMS${S.legAdded.length ? ' · เพิ่มบิลที่ WMS ไม่มี: ' + S.legAdded.map((x) => (x.ty === 'T2.2' ? 'กปภ.' : x.ty) + ' ' + mLabel(x.m) + ' ' + baht(x.amt) + ' บาท').join(', ') : ''}`],
      ['สาขา “นาเตย” ในข้อมูล', 'นาเตยเป็นชื่อสาขาไม้ขาวในระบบเดิม — รวมเข้าสาขาไม้ขาวทุกหน้า', 'ตัวเลขสาขาไม้ขาวครบขึ้น'],
      ['ใบแจ้งหนี้ซ้ำทุกค่า', 'ตัดเหลือ 1 ใบ — ตรงกับไฟล์ตรวจ (ในช่วงรายงานมี 8 แถว 87,605.63 บาท ส่วนใหญ่ 6,300 แถวเป็นปี 2565 อยู่นอกช่วง)', 'ยอดขายไม่นับซ้ำ'],
      ['บิลทดสอบ BL2604210001 (1 บาท) และ BL2604210002 (133.75 บาท)', 'ยังนับอยู่ในข้อมูล (ยอดน้อย ไม่กระทบตัวเลขที่แสดง)', 'รอยกเลิกบิลและปิดทะเบียน AR00C-01859/01860 ในระบบ'],

      ['ส่วนลดในใบแจ้งหนี้ค่าน้ำรวม VAT แต่ VAT ไม่ถูกลดตาม (WMS-307)', 'ยอดขายถอด VAT ออกจากส่วนลดตามสัดส่วน', 'ยอดรวม VAT ใน dashboard อาจต่างจากยอดในใบแจ้งหนี้เล็กน้อย'],
      ['ลูกหนี้คำนวณได้เฉพาะ ณ วันที่ดึงข้อมูล', 'ระบบไม่เก็บประวัติสถานะรายวัน', 'การเลือกวันอ้างอิงย้อนหลังในโหมดสดจะใช้สถานะปัจจุบันของเอกสาร'],
      ['ประเภทลูกค้าและสาขาใช้ค่าในทะเบียนปัจจุบัน · หมู่ใช้ค่าในทะเบียนปัจจุบัน (สำรองด้วยที่อยู่ในใบแจ้งหนี้ล่าสุด)', 'ไม่ใช่ค่า ณ วันที่ออกบิล', 'ลูกค้าที่ย้ายประเภทจะถูกนับในประเภทใหม่ทั้งช่วง'],
      ['ชื่อลูกค้าแสดงเต็ม', 'ลูกค้ายินยอมให้เปิดเผยชื่อตอนสมัครใช้น้ำ · ชื่อมาจากใบแจ้งหนี้ล่าสุด', 'ไม่แสดงเลขบัตร เบอร์โทร ที่อยู่ และบัญชีธนาคาร (ไม่จำเป็นต่อ dashboard)'],
    ];
    el.innerHTML = `
      <h2 class="sec-title">คุณภาพข้อมูลและนิยาม</h2>
      <div class="grid">
        ${card('c-q', 'ผลตรวจคุณภาพข้อมูล (ช่วง ' + dLabel(S.d._start || '2024-11-01') + ' – ' + dLabel(S.asof) + ')', 'ไม่มีรายการใดถูกตัดทิ้งเงียบ ๆ — ทุกข้อระบุวิธีจัดการในตัวเลข', '', `<div id="t-q"></div>`, { csv: 1 })}
        ${card('c-n', 'ข้อจำกัดที่มีผลต่อความหมายของตัวเลข', '', '', table([{ h: 'ประเด็น', k: 0 }, { h: 'วิธีจัดการ', k: 1 }, { h: 'ผลต่อการอ่านตัวเลข', k: 2 }], notes))}
        ${card('c-d', 'นิยาม KPI', '', '', table([{ h: 'KPI', k: 0 }, { h: 'นิยาม / สูตร', k: 1 }, { h: 'ฐานเวลา', k: 2 }], KPI_DEF))}
      </div>`;
    $('t-q').innerHTML = table([
      { h: 'รายการ', f: (r) => esc((Q[r[0]] || [r[0]])[0]) }, { h: 'จำนวน', n: 1, f: (r) => int(r[1]) }, { h: 'ยอด', n: 1, f: (r) => (r[2] == null ? '–' : r[0] === 'inv_units_gt_5000' ? int(r[2]) + ' ลบ.ม.' : baht(r[2])) },
      { h: 'การจัดการใน dashboard', f: (r) => esc((Q[r[0]] || [])[1] || '') }, { h: 'สถานะ', nw: 1, f: (r) => { const s = (Q[r[0]] || [])[2] || ''; return `<span class="pill ${s === 'รอตรวจสอบ' ? 'warn' : s.startsWith('แก้') ? 'up' : 'na'}">${s === 'รอตรวจสอบ' ? '⚠ ' : s.startsWith('แก้') ? '✓ ' : ''}${s}</span>`; } },
    ], items.filter((r) => r[1] > 0));
  }
  const KPI_DEF = [
    ['ยอดขายสุทธิ (ไม่รวม VAT)', 'ค่าน้ำ + ค่าบริการรายเดือน − ส่วนลด (ถอด VAT ตามสัดส่วน) + ใบแจ้งหนี้งานขาย (subtotal) − ใบลดหนี้ (ไม่รวม VAT ตามสัดส่วน) · ไม่รวมใบแจ้งหนี้ที่ยกเลิก · ใบแจ้งหนี้ที่ถูกลดหนี้เต็มจำนวน (ออกผิดแล้วออกใหม่) ตัดออกคู่กับใบลดหนี้ ทั้งรายได้และหน่วยน้ำ · ไม่รวมเงินประกัน', 'วันที่ออกเอกสาร'],
    ['ปริมาณน้ำ (ลบ.ม.)', 'รวม = หน่วยในใบแจ้งหนี้ค่าน้ำ · ฟรี = min(หน่วย, สิทธิ์น้ำฟรีในใบ) · คิดเงิน = รวม − ฟรี', 'วันที่ออกใบแจ้งหนี้'],
    ['ยอดรับชำระตามใบเสร็จ', 'ยอดในใบเสร็จค่าน้ำ + ใบเสร็จงานขาย + ใบเสร็จเงินประกัน (รวม VAT) · ภาษีหัก ณ ที่จ่ายแยกแสดง · ยังไม่ได้กระทบยอดธนาคาร จึงไม่เรียกว่าเงินสดรับจริง', 'วันที่รับชำระ (ไม่มีใช้วันที่ใบเสร็จ)'],
    ['สัดส่วนรับชำระต่อยอดแจ้งหนี้', 'รับชำระค่าน้ำในช่วง ÷ ใบแจ้งหนี้ค่าน้ำในช่วง (รวม VAT) — คนละรุ่นเอกสาร ไม่ใช่อัตราเก็บเงิน', 'ช่วงเดือน'],
    ['อัตราเก็บเงินรายรุ่น', 'ยอดใบแจ้งหนี้ค่าน้ำรุ่นเดือน X ที่ชำระแล้ว (ใบเสร็จถึงวันอ้างอิง) ÷ ยอดแจ้งหนี้รุ่นเดียวกัน · ตรงเวลา = ชำระภายในวันครบกำหนด · เฉพาะระบบใหม่ (มี.ค. 69 เป็นต้นไป)', 'เดือนออกใบแจ้งหนี้ + วันอ้างอิง'],
    ['ลูกหนี้คงค้าง / อายุหนี้', 'ใบแจ้งหนี้ค่าน้ำสถานะค้างชำระ ออก ≤ วันอ้างอิง แบ่งช่วง ยังไม่ครบกำหนด / 1–30 / 31–60 / 61–90 / > 90 วันหลังวันครบกำหนด (ไม่ซ้อนกัน รวมกันเท่ายอดคงค้าง) + ใบแจ้งหนี้งานขายค้างชำระ (ไม่มีวันครบกำหนด)', 'วันอ้างอิง'],
    ['ลูกค้าที่ออกใบแจ้งหนี้', 'จำนวนผู้ใช้น้ำที่มีใบแจ้งหนี้ค่าน้ำ (ไม่ยกเลิก) ในเดือน · ลูกค้าใหม่ = ใบแรกในประวัติอยู่ในเดือนนั้น', 'วันที่ออกใบแจ้งหนี้'],
    ['ยอดขายจากลูกค้าใหม่', 'ค่าน้ำ + ค่าบริการ − ส่วนลด (ไม่รวม VAT) ของลูกค้าที่ใบแจ้งหนี้ค่าน้ำใบแรกอยู่ในช่วงที่เลือก นับเฉพาะยอดที่เกิดในช่วงเดียวกัน + งานขาย (เช่นค่าติดตั้ง) ของลูกค้ากลุ่มเดียวกัน · ไม่รวมทะเบียนลูกค้าสัญญาที่ย้ายเข้าระบบใหม่', 'วันที่ออกใบแจ้งหนี้'],
    ['MoM / YoY / YTD', 'เทียบช่วงยาวเท่ากันก่อนหน้า / ช่วงเดียวกันปีก่อน / ม.ค.–เดือนที่เลือก เทียบปีก่อน · ไม่แสดงเมื่อไม่มีข้อมูลฐานหรือเดือนไม่ครบ · ⚠ เมื่อช่วงที่เทียบมีเดือนที่ไม่มีรายได้ กปภ. (หน้าแล้ง/สัญญาสิ้นสุด)', 'วันที่ออกเอกสาร'],
    ['เป้ายอดขาย', 'ไม่มีข้อมูลเป้าในระบบ แสดง “ยังไม่กำหนดเป้า”', '–'],
  ];

  // ---------- routing ----------
  function route() {
    const p = (location.hash || '#snapshot').slice(1);
    if (p === 'fresh') { $('fresh').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' }); history.replaceState(null, '', '#' + S.page); return; }
    S.page = PAGES[p] ? p : 'snapshot';
    render({ enter: true });
    $('page').focus({ preventScroll: true });
  }

  async function boot() {
    try {
      S.cfg = await getJSON('/api/config');
      await load(S.cfg.mode === 'live' ? S.cfg.asof_default : null);
      S.d._start = S.cfg.snapshot && S.cfg.snapshot.start;
      initFilters();
      initTheme();
      window.addEventListener('hashchange', route);
      window.addEventListener('resize', () => S.charts.forEach((c) => c.resize()));
      $('drill-close').onclick = () => $('drill').close();
      route();
    } catch (e) {
      console.error(e);
      $('fresh').textContent = 'โหลดข้อมูลไม่สำเร็จ';
      $('page').innerHTML = `<div class="card state err">⚠ โหลดข้อมูลไม่สำเร็จ: ${esc(e.message)}<br><button class="btn" id="retry">ลองใหม่</button></div>`;
      $('retry').addEventListener('click', () => location.reload());
    }
  }
  if (window.HEA_STATIC) window.HEADash = { start: (bundle) => { S.bundle = bundle; boot(); } };
  else boot();
})();
