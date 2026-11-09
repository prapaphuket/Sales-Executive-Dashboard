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
      ag0: v('ag0'), ag1: v('ag1'), ag2: v('ag2'), ag3: v('ag3'), ag4: v('ag4') });
    AGING.forEach((g) => { g.color = C[g.v]; });
    baseText.color = C.text2;
  }
  const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const TY_NAME = { T1: 'T1', T2: 'T2', 'T2.1': 'T2.1', 'T2.2': 'T2.2 กปภ.', 'T2.3': 'T2.3 หอถัง', T3: 'T3', 'T3.1': 'T3.1 ทอท.', 'ชั่วคราว-ไม้ขาว': 'ชั่วคราว', '?': 'ไม่ระบุ/รอตรวจสอบ' };
  const CH_NAME = { transfer: 'โอน', direct: 'หักบัญชี', cash: 'เงินสด', cheque: 'เช็ค', scan: 'สแกนจ่าย', '?': 'ไม่ระบุ' };
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
  const S = { cfg: null, d: {}, fetched: null, asof: null, f: {}, page: 'overview', charts: [] };
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
    S.dma = rowsOf(d.dma_monthly);
    S.cust = rowsOf(d.customers);
    S.custStatus = d.customers.status.map(([br, ty, status, n]) => ({ br, ty, status, n }));
    S.custCreated = d.customers.created.map(([m, n]) => ({ m, n }));
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
    S.asofMonth = S.asof.slice(0, 7);
    // ---- ทำความสะอาด/เสริมข้อมูล ----
    // 1) นาเตย = ชื่อสาขาไม้ขาวในระบบเดิม -> รวมเป็นไม้ขาว
    const BRMAP = { 'นาเตย': 'ไม้ขาว' };
    const nb = (arr) => arr.forEach((r) => { if (BRMAP[r.br]) r.br = BRMAP[r.br]; });
    [S.sales, S.cust, S.custStatus, S.coll, S.cohort, S.ar, S.top, S.decl, S.debt, S.rev, S.revCust].forEach(nb);
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
    S.dmas = [...new Set(S.dma.map((r) => r.dma))].sort();
    // เดือนที่ไม่มีใบแจ้งหนี้ กปภ. (T2.2) ทั้งที่ควรมีทุกเดือน -> เตือนเมื่อเปรียบเทียบ
    S.pwaMissing = months.filter((m) => m !== S.partialMonth && sum(S.sales.filter((r) => r.m === m && r.ty === 'T2.2' && (r.src === 'W' || r.src === 'L')), (r) => r.net) === 0);
  }
  const BR_ORDER = (b) => ({ 'ไม้ขาว': 1, 'สาคู': 2, 'นาเตย': 3, 'หล่อยูง': 4 }[b] || 9);

  // ---------- filters ----------
  const FX = [
    ['ช่วงเดือน', 'ยอดขาย ปริมาณน้ำ ลูกค้าใช้งาน/ลูกค้าใหม่ ยอดรับชำระ อัตราเก็บเงินรายรุ่น ยอดตาม DMA', 'ลูกหนี้คงค้าง (ใช้วันอ้างอิง) · ลูกค้ารายใหญ่ (12 เดือนเต็มล่าสุด) · รายการลูกค้าลดลง (3 เดือนเต็มล่าสุด)'],
    ['สาขา', 'ทุก KPI และกราฟ ยกเว้นที่ระบุ', '— (DMA กรองตามสาขาจากชื่อ DMA)'],
    ['ประเภทลูกค้า', 'ยอดขาย ปริมาณน้ำ ลูกค้า ลูกหนี้ ลูกค้ารายใหญ่ ลูกค้าลดลง', 'ยอดรับชำระ · อัตราเก็บเงินรายรุ่น · ยอดตาม DMA (ข้อมูลต้นทางไม่มีมิติประเภท)'],
    ['DMA', 'กราฟ/ตารางยอดค่าน้ำตาม DMA เท่านั้น', 'KPI อื่นทั้งหมด (ใบแจ้งหนี้งานขาย/ใบลดหนี้/ใบเสร็จไม่มี DMA)'],
    ['วันอ้างอิงลูกหนี้', 'ลูกหนี้คงค้าง อายุหนี้ ลูกหนี้รายใหญ่ อัตราเก็บเงินรายรุ่น (นับรับชำระถึงวันนี้)', 'ยอดขายและยอดรับชำระ (ใช้ช่วงเดือน)'],
  ];
  function initFilters() {
    const mOpts = S.months.map((m) => `<option value="${m}">${mLong(m)}${m === S.partialMonth ? ' (ไม่ครบเดือน)' : ''}</option>`).join('');
    $('f-from').innerHTML = mOpts; $('f-to').innerHTML = mOpts;
    $('f-br').innerHTML = '<option value="">ทุกสาขา</option>' + S.branches.map((b) => `<option>${esc(b)}</option>`).join('');
    $('f-ty').innerHTML = '<option value="">ทุกประเภท</option>' + S.types.map((t) => `<option value="${esc(t)}">${esc(TY_NAME[t] || t)}</option>`).join('');
    $('f-dma').innerHTML = '<option value="">ทุก DMA</option>' + S.dmas.map((x) => `<option>${esc(x)}</option>`).join('');
    $('fx-body').innerHTML = '<table class="t small"><thead><tr><th>ตัวกรอง</th><th>มีผลกับ</th><th>ไม่มีผลกับ</th></tr></thead><tbody>' +
      FX.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('') + '</tbody></table>';
    const asofEl = $('f-asof');
    if (S.cfg.mode === 'snapshot') { asofEl.type = 'text'; asofEl.value = dLabel(S.asof) + ' (คงที่)'; asofEl.disabled = true; asofEl.title = 'โหมด snapshot: ลูกหนี้คำนวณได้เฉพาะ ณ วันที่ดึงข้อมูล'; }
    else asofEl.value = S.asof;
    restoreFilters();
    ['f-from', 'f-to', 'f-br', 'f-ty', 'f-dma'].forEach((id) => $(id).addEventListener('change', onFilter));
    asofEl.addEventListener('change', async () => { if (!asofEl.value) return; await load(asofEl.value); initFilters(); render(); });
    $('f-reset').onclick = () => { setDefaults(); onFilter(); };
  }
  function setDefaults() {
    const to = S.lastFull;
    const from = to.slice(0, 4) + '-01' >= S.months[0] ? to.slice(0, 4) + '-01' : S.months[0];
    $('f-from').value = from; $('f-to').value = to; $('f-br').value = ''; $('f-ty').value = ''; $('f-dma').value = '';
  }
  function restoreFilters() {
    setDefaults();
    try {
      const saved = JSON.parse(localStorage.getItem('hea-dash-f') || 'null');
      if (saved) for (const [k, v] of Object.entries(saved)) { const el = $(k); if (el && [...el.options].some((o) => o.value === v)) el.value = v; }
    } catch (e) { /* storage อาจใช้ไม่ได้ */ }
    readFilters();
  }
  function readFilters() {
    let from = $('f-from').value, to = $('f-to').value;
    if (from > to) { [from, to] = [to, from]; $('f-from').value = from; $('f-to').value = to; }
    S.f = { from, to, br: $('f-br').value, ty: $('f-ty').value, dma: $('f-dma').value };
    ['f-br', 'f-ty', 'f-dma'].forEach((id) => $(id).classList.toggle('active', !!$(id).value));
    try { localStorage.setItem('hea-dash-f', JSON.stringify({ 'f-from': from, 'f-to': to, 'f-br': S.f.br, 'f-ty': S.f.ty, 'f-dma': S.f.dma })); } catch (e) { /* ignore */ }
  }
  function onFilter() { readFilters(); render(); }
  const okBr = (b) => !S.f.br || b === S.f.br;
  const okTy = (t) => !S.f.ty || t === S.f.ty;
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
      { data: (opt.series || []).filter((x) => x.type !== 'effectScatter').map((x) => x.name) });
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
  const barStyle = (color) => ({ color, borderColor: C.surface, borderWidth: 1 });

  // ---------- generic UI ----------
  function card(id, title, hint, applies, body, opts = {}) {
    return `<div class="card ${opts.cls || ''}" id="${id}"><div class="card-head"><div><h3>${title}</h3>${hint ? `<div class="hint">${hint}</div>` : ''}</div>
      <div class="tools">${opts.table ? `<button class="btn ghost small" data-tbl="${id}" aria-pressed="false">ตาราง</button>` : ''}${opts.csv ? `<button class="btn ghost small" data-csv="${id}">CSV</button>` : ''}</div></div>
      ${body}${applies ? `<div class="applies">ตัวกรองที่มีผล: ${applies}</div>` : ''}</div>`;
  }
  function kpi(label, value, unit, sub, cmp, cls = '') {
    return `<div class="card kpi ${cls}"><div class="label">${label}</div><div class="value">${value}<span class="unit">${unit || ''}</span></div>${sub ? `<div class="sub">${sub}</div>` : ''}${cmp ? `<div class="cmp">${cmp}</div>` : ''}</div>`;
  }
  function table(cols, rows, foot, opts = {}) {
    const th = cols.map((c) => `<th class="${c.n ? 'n' : ''}" scope="col">${c.h}</th>`).join('');
    const tr = rows.map((r, i) => `<tr ${opts.click ? `class="click" tabindex="0" data-row="${i}"` : ''}>${cols.map((c) => `<td class="${c.n ? 'n' : ''}${c.nw ? ' nw' : ''}${c.cls ? ' ' + c.cls : ''}">${c.f ? c.f(r) : esc(r[c.k])}</td>`).join('')}</tr>`).join('');
    const tf = foot ? `<tfoot><tr>${cols.map((c, i) => `<td class="${c.n ? 'n' : ''}">${foot[i] == null ? '' : foot[i]}</td>`).join('')}</tr></tfoot>` : '';
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
      cardEl.insertBefore(box, cardEl.querySelector('.applies'));
    }));
    root.querySelectorAll('[data-csv]').forEach((b) => b.addEventListener('click', () => {
      const tbl = $(b.dataset.csv).querySelector('table[data-csvable]');
      if (!tbl) return;
      const lines = [...tbl.querySelectorAll('tr')].map((tr) => [...tr.children].map((td) => '"' + td.textContent.replace(/"/g, '""').trim() + '"').join(','));
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
    $('asof-chip').innerHTML = `<span class="mode ${cfg.mode === 'live' ? 'live' : 'snapshot'}">${cfg.mode === 'live' ? 'LIVE' : 'SNAPSHOT'}</span> ข้อมูล ณ ${dLabel(cfg.mode === 'live' ? m.receipt_last : S.asof)} · <a href="#fresh">ที่มาของข้อมูล</a>`;
    const msgs = [];
    if (S.f.to === S.partialMonth) msgs.push(`เดือน ${mLong(S.partialMonth)} ยังไม่ครบเดือน (ข้อมูลถึง ${dLabel(S.asof)}) — ไม่แสดงการเปรียบเทียบ MoM/YoY ของช่วงนี้`);
    const banner = $('banner');
    banner.hidden = !msgs.length; banner.innerHTML = msgs.map((x) => '⚠ ' + esc(x)).join('<br>');
  }

  // ---------- pages ----------
  const PAGES = { overview: pOverview, revenue: pRevenue, sales: pSales, usage: pUsage, customers: pCustomers, collections: pCollections, quality: pQuality };
  function render(opts = {}) {
    readTheme();
    disposeCharts();
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

  const APPLY_SALES = 'ช่วงเดือน · สาขา · ประเภทลูกค้า';

  function pOverview(el) {
    const { from, to } = S.f, pc = periodCompare();
    const cur = salesAgg(from, to);
    const yoy = pc.yoyOk ? salesAgg(addM(from, -12), addM(to, -12)) : null;
    const mom = pc.momOk ? salesAgg(pc.momFrom, pc.momTo) : null;
    const coll = collAgg(from, to), collY = pc.yoyOk ? collAgg(addM(from, -12), addM(to, -12)) : null;
    const ar = arAgg();
    const naPartial = pc.partial ? 'ช่วงที่เลือกมีเดือนที่ยังไม่ครบ ข้อมูลรายเดือนไม่สามารถเทียบวันเดียวกันได้' : null;
    const pwaWarn = pc.pwaGap.length ? 'กปภ. ไม่มีใบแจ้งหนี้ในเดือน ' + pc.pwaGap.map(mLabel).join(', ') + ' ทำให้การเปรียบเทียบคลาดเคลื่อน' : null;
    const ytdFrom = to.slice(0, 4) + '-01';
    const ytd = salesAgg(ytdFrom, to), ytdP = addM(ytdFrom, -12) >= S.months[0] ? salesAgg(addM(ytdFrom, -12), addM(to, -12)) : null;
    const per = `${mLabel(from)}${from !== to ? ' – ' + mLabel(to) : ''}`;
    const custActive = latestActive(to);
    const ratio = cur.billWaterInclVat ? coll.water / cur.billWaterInclVat : null;
    const cohort = cohortAgg(from, to);

    el.innerHTML = `
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
        ${kpi('ยอดขายสะสมทั้งปี (YTD)', mb(ytd.net), 'ล้านบาท', `${mLabel(ytdFrom)} – ${mLabel(to)}`, cmpPill(ytd.net, ytdP && ytdP.net, 'YTD เทียบปีก่อน', { na: naPartial || (!ytdP && 'ไม่มีข้อมูลปีก่อนครบ'), warn: monthsBetween(ytdFrom, to).some((m) => S.pwaMissing.includes(m)) ? 'มีเดือนที่ กปภ. ยังไม่มีใบแจ้งหนี้' : null }))}
        ${kpi('เป้ายอดขาย', 'ยังไม่กำหนดเป้า', '', 'ไม่มีข้อมูลเป้าในระบบ — จึงไม่แสดง % เทียบเป้า', '', 'target')}
      </div>
      <div class="grid g3" style="margin-top:16px">
        ${card('c-trend', 'ยอดขายสุทธิรายเดือนแยกสาขา (ล้านบาท)', 'แท่ง = เดือนในช่วงที่เลือก · เส้น = เดือนเดียวกันปีก่อน (ทุกสาขาที่เลือกรวมกัน)', APPLY_SALES, '<div class="chart tall" id="ch-trend"></div>', { cls: 'span2', table: 1 })}
        ${card('c-issues', 'ประเด็นที่ควรติดตาม', 'คัดจากข้อมูลจริงตามเกณฑ์ที่ระบุในแต่ละข้อ', 'สาขา (บางข้อ)', `<ul class="issues">${issues().map((x) => `<li><span class="ic ${x.lvl}" aria-hidden="true">${x.lvl === 'bad' ? '!' : x.lvl === 'warn' ? '⚠' : 'i'}</span><div><b>${x.t}</b><br><span class="small">${x.d}</span></div></li>`).join('')}</ul>`)}
      </div>
      <div class="grid g2" style="margin-top:16px">
        ${card('c-arov', 'อายุลูกหนี้ค่าน้ำ ณ ' + dLabel(S.asof), 'ใบแจ้งหนี้สถานะค้างชำระ แยกตามจำนวนวันเกินกำหนด (ล้านบาท)', 'สาขา · ประเภทลูกค้า · วันอ้างอิงลูกหนี้', '<div class="chart" id="ch-arov"></div>', { table: 1 })}
        ${card('c-custov', 'ลูกค้าที่ออกใบแจ้งหนี้ค่าน้ำรายเดือน (ราย)', 'นับรายผู้ใช้น้ำที่มีใบแจ้งหนี้ค่าน้ำในเดือน · ' + (custActive ? `${mLabel(to)}: ${int(custActive)} ราย` : ''), APPLY_SALES, '<div class="chart" id="ch-custov"></div>', { table: 1 })}
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
    const series = brs.map((b) => ({ name: b, type: 'line', symbolSize: 8, lineStyle: { width: 2 }, itemStyle: { color: brColor(b) }, data: months.map((m) => sum(S.cust.filter((r) => r.m === m && brG(r.br) === b && okBr(r.br) && okTy(r.ty)), (r) => r.active) || null) }));
    chart($(elId), { xAxis: catAxis(months.map(mLabel)), yAxis: { ...valAxis((v) => nf0.format(v)), scale: true }, series, tooltip: { ...chartTT(), axisPointer: { type: 'line' }, formatter: ttMoney('u') } });
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
    if (recent.length && (!S.f.ty || S.f.ty === 'T2.2') && okBr('ไม้ขาว')) {
      out.push({ lvl: 'warn', t: `กปภ. (T2.2) ไม่มีรายได้ ${recent.length} เดือน: ${recent.map(mLabel).join(', ')}`, d: 'พ.ค. 69 ไม่มีการส่งน้ำให้ กปภ. (ช่วงแล้ง) และสัญญาขายส่งสิ้นสุดหลัง ก.ค. 69 — รายได้หายราว 1.5–2 ล้านบาทต่อเดือน ต้องหาลูกค้าแทน (ดูหน้า “รายได้ตามกลุ่มลูกค้า”)' });
    }
    const lf = S.lastFull, ly = addM(lf, -12);
    if (ly >= S.months[0]) {
      const a = salesAgg(lf, lf), b = salesAgg(ly, ly);
      if (b.net) {
        const ch = (a.net - b.net) / b.net;
        out.push({ lvl: ch < -0.1 ? 'bad' : 'info', t: `ยอดขาย ${mLabel(lf)} ${ch >= 0 ? 'เพิ่ม' : 'ลดลง'} ${nf1.format(Math.abs(ch * 100))}% เทียบ ${mLabel(ly)}`, d: `${mb(a.net)} เทียบ ${mb(b.net)} ล้านบาท (ไม่รวม VAT)${S.pwaMissing.includes(lf) ? ' · เดือนนี้ไม่มีบิล กปภ.' : ''}` });
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
    el.innerHTML = `
      <h2 class="sec-title">ยอดขายและการใช้น้ำ ${mLabel(from)}${from !== to ? ' – ' + mLabel(to) : ''}</h2>
      <div class="grid g4">
        ${kpi('ยอดขายก่อนส่วนลด (ไม่รวม VAT)', mb(cur.gross), 'ล้านบาท', 'ค่าน้ำ + ค่าบริการ + งานขาย')}
        ${kpi('ส่วนลด (ไม่รวม VAT)', mb(cur.disc), 'ล้านบาท', 'ส่วนลดในใบแจ้งหนี้ค่าน้ำ (รวมน้ำฟรี) ถอด VAT ตามสัดส่วน')}
        ${kpi('ใบลดหนี้', mb(cur.cn), 'ล้านบาท', 'หักในเดือนที่ออกใบลดหนี้')}
        ${kpi('ยอดขายสุทธิ (ไม่รวม VAT)', mb(cur.net), 'ล้านบาท', `${int(cur.docs)} เอกสาร`, '', 'accent')}
      </div>
      <div class="grid g2" style="margin-top:16px">
        ${card('c-comp', 'ยอดขายสุทธิตามประเภทรายได้ (ล้านบาท)', 'ใบลดหนี้แสดงเป็นค่าติดลบ', APPLY_SALES, '<div class="chart" id="ch-comp"></div>', { table: 1 })}
        ${card('c-units', 'ปริมาณน้ำที่ออกใบแจ้งหนี้ (ลบ.ม.)', 'คิดเงิน + น้ำฟรี = รวม · ลูกค้ารายใหญ่ระบบเดิม (ก่อน มี.ค. 69) ไม่มีข้อมูลหน่วย', APPLY_SALES, '<div class="chart" id="ch-units"></div>', { table: 1 })}
      </div>
      <div class="grid g2" style="margin-top:16px">
        ${card('c-type', 'ยอดขายสุทธิตามประเภทลูกค้า', 'ประเภทตามทะเบียนผู้ใช้น้ำปัจจุบัน', 'ช่วงเดือน · สาขา · ประเภทลูกค้า', '<div id="t-type"></div>', { csv: 1 })}
        ${card('c-dma', 'ยอดค่าน้ำตาม DMA', 'เฉพาะใบแจ้งหนี้ค่าน้ำ (ไม่รวมงานขาย ใบลดหนี้ และลูกค้ารายใหญ่ระบบเดิม) · DMA ตามทะเบียนปัจจุบัน', 'ช่วงเดือน · สาขา (จากชื่อ DMA) · DMA', '<div id="t-dma"></div>', { csv: 1 })}
      </div>
      <div class="grid" style="margin-top:16px">
        ${card('c-top', 'ลูกค้า 15 รายแรกตามยอดขาย 12 เดือนเต็มล่าสุด', `${dLabel(S.d.top_customers.window[0])} – ${dLabel(S.d.top_customers.window[1])} · คลิกแถวเพื่อดูเอกสารต้นทาง · 10 รายแรก = ${pct(S.d.top_customers.top10_net / S.d.top_customers.total_net)} ของยอดขายค่าน้ำทุกสาขา (ไม่รวมงานขาย)`, 'สาขา · ประเภทลูกค้า (ช่วงเดือนไม่มีผล)', '<div id="t-top"></div>', { csv: 1 })}
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
    $('t-type').innerHTML = table([
      { h: 'ประเภท', nw: 1, f: (r) => esc(TY_NAME[r.t] || r.t) },
      { h: 'ยอดขายสุทธิ (บาท)', n: 1, f: (r) => baht(r.net) },
      { h: 'สัดส่วน', n: 1, f: (r) => pct(tot ? r.net / tot : null) },
      { h: 'ลบ.ม.', n: 1, f: (r) => int(r.units) },
      { h: 'เอกสาร', n: 1, f: (r) => int(r.docs) },
    ], trows, ['รวม', baht(tot), tot ? '100.0%' : '', int(sum(trows, (r) => r.units)), int(sum(trows, (r) => r.docs))]);

    const drows0 = S.dma.filter((r) => inR(r.m, from, to) && (!S.f.br || r.dma.startsWith(S.f.br)) && (!S.f.dma || r.dma === S.f.dma));
    const dm = {}; drows0.forEach((r) => { const x = dm[r.dma] || (dm[r.dma] = { dma: r.dma, net: 0, units: 0, docs: 0 }); x.net += r.net; x.units += r.units; x.docs += r.docs; });
    const drows = Object.values(dm).sort((a, b) => b.net - a.net);
    $('t-dma').innerHTML = table([
      { h: 'DMA', f: (r) => esc(r.dma) + (r.dma.includes('ไม่ระบุ') ? ' <span class="pill warn">รอตรวจสอบ</span>' : '') },
      { h: 'ค่าน้ำสุทธิ (บาท)', n: 1, f: (r) => baht(r.net) },
      { h: 'ลบ.ม.', n: 1, f: (r) => int(r.units) },
      { h: 'ใบแจ้งหนี้', n: 1, f: (r) => int(r.docs) },
    ], drows, ['รวม', baht(sum(drows, (r) => r.net)), int(sum(drows, (r) => r.units)), int(sum(drows, (r) => r.docs))]);

    const top = S.top.filter((r) => okBr(r.br) && okTy(r.ty));
    $('t-top').innerHTML = table([
      { h: '#', n: 1, k: 'rk' }, { h: 'ทะเบียน', nw: 1, k: 'reg' }, { h: 'ชื่อ', f: nameCell, cls: 'name' }, { h: 'สาขา', nw: 1, k: 'br' }, { h: 'ประเภท', nw: 1, f: (r) => esc(TY_NAME[r.ty] || r.ty) },
      { h: '12 เดือนล่าสุด (บาท)', n: 1, f: (r) => baht(r.net) }, { h: '12 เดือนก่อนหน้า', n: 1, f: (r) => baht(r.prev) },
      { h: 'เปลี่ยนแปลง', n: 1, f: (r) => r.prev ? cmpPill(r.net, r.prev, '') : '–' },
      { h: 'ลบ.ม.', n: 1, f: (r) => int(r.units) }, { h: 'ค้างชำระ', n: 1, f: (r) => baht(r.ar) },
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
    const newc = sum(S.cust.filter((r) => inR(r.m, from, to) && okBr(r.br) && okTy(r.ty)), (r) => r.new);
    const st = S.custStatus.filter((r) => okBr(r.br) && okTy(r.ty));
    const stBy = (s) => sum(st.filter((r) => r.status === s), (r) => r.n);
    const tc = S.d.top_customers;
    el.innerHTML = `
      <h2 class="sec-title">ลูกค้าและการเติบโต</h2>
      <div class="grid g4">
        ${kpi('ลูกค้าที่ออกใบแจ้งหนี้ค่าน้ำ', int(act), 'ราย', `เดือน ${mLabel(to)}`, cmpPill(act, actY, 'YoY', { na: S.f.to === S.partialMonth ? 'เดือนไม่ครบ' : (!actY && 'ไม่มีข้อมูลปีก่อน') }), 'accent')}
        ${kpi('ลูกค้าใหม่ (เริ่มมีใบแจ้งหนี้ครั้งแรก)', int(newc), 'ราย', `${mLabel(from)} – ${mLabel(to)}`)}
        ${kpi('ทะเบียนผู้ใช้น้ำปัจจุบัน', int(sum(st, (r) => r.n)), 'ราย', `ใช้งาน ${int(stBy('active'))} · งดจ่ายน้ำ ${int(stBy('disconnected'))} · ยกเลิก ${int(stBy('closed'))} · รอติดตั้ง ${int(stBy('pending_install'))}`)}
        ${kpi('การกระจุกตัวของรายได้', pct(tc.top10_net / tc.total_net), '', `ลูกค้า 10 รายแรก จาก ${int(tc.n_cust)} รายที่มียอด · 20 รายแรก ${pct(tc.top20_net / tc.total_net)} (ยอดค่าน้ำ 12 เดือนล่าสุด ทุกสาขา ไม่รวมงานขาย ไม่ขึ้นกับตัวกรอง)`)}
      </div>
      <div class="grid g2" style="margin-top:16px">
        ${card('c-act', 'ลูกค้าที่ออกใบแจ้งหนี้ค่าน้ำรายเดือน (ราย)', 'ไม่รวมลูกค้ารายใหญ่ที่ออกบิลในระบบงานขายก่อน มี.ค. 69', APPLY_SALES, '<div class="chart" id="ch-act"></div>', { table: 1 })}
        ${card('c-new', 'ลูกค้าใหม่รายเดือน (ราย)', 'ลูกค้าใหม่ = ผู้ใช้น้ำที่ใบแจ้งหนี้ค่าน้ำใบแรกออกในเดือนนั้น · ทะเบียนใหม่ = ผู้ใช้น้ำที่ลงทะเบียนในเดือน (ไม่แยกสาขา/ประเภท)', 'ช่วงเดือน · สาขา · ประเภท (ทะเบียนใหม่: ช่วงเดือนเท่านั้น)', '<div class="chart" id="ch-new"></div>', { table: 1 })}
      </div>
      <div class="grid" style="margin-top:16px">
        ${card('c-decl', 'รายการเฝ้าระวัง: ลูกค้าที่ยอดลดลง', `เกณฑ์: ยอดขายสุทธิ ${dLabel(S.d.declines.window[0])}–${dLabel(S.d.declines.window[1])} ลดลง ≥ 30% เทียบ ${dLabel(S.d.declines.window[2])}–${dLabel(S.d.declines.window[3])} และฐานปีก่อน ≥ 15,000 บาท · พบ ${S.d.declines.n_match} ราย แสดง 20 รายที่ยอดลดมากสุด`, 'สาขา · ประเภทลูกค้า (ช่วงเดือนไม่มีผล)', '<div id="t-decl"></div>', { csv: 1 })}
      </div>
      <div class="grid" style="margin-top:16px">
        ${card('c-st', 'สถานะทะเบียนผู้ใช้น้ำตามประเภท', 'ข้อมูล ณ วันที่ดึง (ไม่ขึ้นกับช่วงเดือน)', 'สาขา · ประเภทลูกค้า', '<div id="t-st"></div>', { csv: 1 })}
      </div>`;
    custChart('ch-act', 'c-act', from, to);
    const ns = [
      { name: 'ลูกค้าใหม่ (ใบแจ้งหนี้แรก)', type: 'bar', barMaxWidth: 26, itemStyle: barStyle(C.navy), data: months.map((m) => sum(S.cust.filter((r) => r.m === m && okBr(r.br) && okTy(r.ty)), (r) => r.new)) },
      { name: 'ทะเบียนใหม่', type: 'bar', barMaxWidth: 26, itemStyle: barStyle(C.oliveChart), data: months.map((m) => (S.custCreated.find((x) => x.m === m) || {}).n || 0) },
    ];
    chart($('ch-new'), { xAxis: catAxis(months.map(mLabel)), yAxis: valAxis((v) => nf0.format(v)), series: ns, tooltip: { ...chartTT(), formatter: ttMoney('u') } });
    chartTable('c-new', months.map(mLabel), ns.map((s) => ({ name: s.name, data: s.data })), 'u');
    const dl = S.decl.filter((r) => okBr(r.br) && okTy(r.ty));
    $('t-decl').innerHTML = table([
      { h: 'ทะเบียน', nw: 1, k: 'reg' }, { h: 'ชื่อ', f: nameCell, cls: 'name' }, { h: 'สาขา', nw: 1, k: 'br' }, { h: 'ประเภท', nw: 1, f: (r) => esc(TY_NAME[r.ty] || r.ty) }, { h: 'สถานะ', nw: 1, f: (r) => esc(STATUS_TH[r.status] || r.status) },
      { h: '3 เดือนล่าสุด (บาท)', n: 1, f: (r) => baht(r.cur) }, { h: 'ปีก่อน (บาท)', n: 1, f: (r) => baht(r.prev) },
      { h: 'เปลี่ยนแปลง', n: 1, f: (r) => cmpPill(r.cur, r.prev, '') }, { h: 'ลบ.ม. ล่าสุด / ปีก่อน', n: 1, f: (r) => int(r.ucur) + ' / ' + int(r.uprev) },
    ], dl);
    const types = [...new Set(st.map((r) => r.ty))].sort();
    const strows = types.map((t) => { const x = st.filter((r) => r.ty === t); const g = (s) => sum(x.filter((r) => r.status === s), (r) => r.n); return { t, a: g('active'), d: g('disconnected'), c: g('closed'), p: g('pending_install'), all: sum(x, (r) => r.n) }; });
    $('t-st').innerHTML = table([
      { h: 'ประเภท', nw: 1, f: (r) => esc(TY_NAME[r.t] || r.t) }, { h: 'ใช้งาน', n: 1, f: (r) => int(r.a) }, { h: 'งดจ่ายน้ำ', n: 1, f: (r) => int(r.d) }, { h: 'ยกเลิก', n: 1, f: (r) => int(r.c) }, { h: 'รอติดตั้ง', n: 1, f: (r) => int(r.p) }, { h: 'รวม', n: 1, f: (r) => int(r.all) },
    ], strows, ['รวม', int(sum(strows, (r) => r.a)), int(sum(strows, (r) => r.d)), int(sum(strows, (r) => r.c)), int(sum(strows, (r) => r.p)), int(sum(strows, (r) => r.all))]);
  }
  // หมายเหตุลูกค้ารายใหญ่ที่ตัวเลขเปลี่ยนเพราะข้อมูล ไม่ใช่พฤติกรรมการใช้น้ำ (อ้างอิง customer_water_id)
  const KNOWN = {
    4: () => (S.pwaMissing.length ? 'ไม่มีใบแจ้งหนี้ค่าน้ำเดือน ' + S.pwaMissing.map(mLabel).join(', ') + ' — ยอดลดเพราะยังไม่ออกบิล ไม่ใช่การใช้น้ำลดลง' : ''),
    1363: () => 'ระบบเดิมออกบิลหอถังของ อบต. รวมไว้ที่ทะเบียนนี้ ระบบใหม่ (มี.ค. 69) แยกเป็นทะเบียนประเภท T2.3 — ยอดที่ลดส่วนใหญ่ย้ายไปทะเบียนใหม่',
  };
  const nameCell = (r) => esc(r.name) + (KNOWN[r.cw] && KNOWN[r.cw]() ? `<br><span class="small" style="color:var(--status-warn)">⚠ ${esc(KNOWN[r.cw]())}</span>` : '');
  const STATUS_TH = { active: 'ใช้งาน', disconnected: 'งดจ่ายน้ำ', closed: 'ยกเลิก', pending_install: 'รอติดตั้ง' };

  function pCollections(el) {
    const { from, to } = S.f;
    const months = monthsBetween(from, to);
    const coll = collAgg(from, to), sa = salesAgg(from, to, { ignoreTy: true }), ar = arAgg(), co = cohortAgg(from, to);
    el.innerHTML = `
      <h2 class="sec-title">การจัดเก็บและลูกหนี้</h2>
      <div class="grid g4">
        ${kpi('ยอดรับชำระตามใบเสร็จ (รวม VAT)', mb(coll.total), 'ล้านบาท', `${int(coll.n)} ใบเสร็จ · ตามวันที่รับชำระ · ยังไม่ได้กระทบยอดกับบัญชีธนาคาร`, '', 'accent')}
        ${kpi('ภาษีหัก ณ ที่จ่าย', baht(coll.wht), 'บาท', 'แยกจากยอดรับชำระ (ยอดในใบเสร็จไม่ได้หัก)')}
        ${kpi('สัดส่วนรับชำระต่อยอดแจ้งหนี้ (ค่าน้ำ)', pct(sa.billWaterInclVat ? coll.water / sa.billWaterInclVat : null), '', `รับชำระค่าน้ำ ${mb(coll.water)} ÷ ใบแจ้งหนี้ค่าน้ำ ${mb(sa.billWaterInclVat)} ล้านบาท (รวม VAT, ทุกประเภทลูกค้า)`)}
        ${kpi('ลูกหนี้ค่าน้ำเกินกำหนด', mb(ar.overdue), 'ล้านบาท', `จากคงค้าง ${mb(ar.total)} ล้านบาท · ${int(ar.n)} ใบ · ณ ${dLabel(S.asof)}`, '', 'accent')}
      </div>
      <div class="grid g2" style="margin-top:16px">
        ${card('c-coll', 'ยอดรับชำระรายเดือนตามประเภท (ล้านบาท)', 'ตามวันที่รับชำระ (ไม่มีวันที่รับชำระใช้วันที่ใบเสร็จ) · ไม่ใช่ยอดขาย', 'ช่วงเดือน · สาขา', '<div class="chart" id="ch-coll"></div>', { table: 1 })}
        ${card('c-ratio', 'สัดส่วนรับชำระต่อยอดแจ้งหนี้ค่าน้ำ รายเดือน', 'รับชำระในเดือน ÷ แจ้งหนี้ในเดือน (คนละรุ่นเอกสาร จึงเกิน 100% ได้) · ⚠ = กปภ. ไม่มีใบแจ้งหนี้', 'ช่วงเดือน · สาขา', '<div class="chart" id="ch-ratio"></div>', { table: 1 })}
      </div>
      <div class="grid g2" style="margin-top:16px">
        ${card('c-cohort', 'อัตราเก็บเงินรายรุ่นใบแจ้งหนี้ (ระบบใหม่ ตั้งแต่ มี.ค. 69)', `ชำระแล้ว ÷ ยอดแจ้งหนี้ของรุ่นเดียวกัน นับรับชำระถึง ${dLabel(S.asof)} · ตรงเวลา = ชำระภายในวันครบกำหนด · รุ่นล่าสุดยังไม่ครบกำหนด`, 'ช่วงเดือน (เดือนออกใบแจ้งหนี้) · สาขา · วันอ้างอิง', '<div id="t-cohort"></div>', { csv: 1 })}
        ${card('c-ch', 'ช่องทางรับชำระ', 'ใบเสร็จระบบเดิม (ก่อน มี.ค. 69) บันทึกช่องทางไม่ครบ ส่วนใหญ่แสดงเป็น “โอน” · ใบเสร็จยอด 0 = หักด้วยใบลดหนี้ทั้งใบ', 'ช่วงเดือน · สาขา', '<div id="t-ch"></div>', { csv: 1 })}
      </div>
      <div class="grid g2" style="margin-top:16px">
        ${card('c-ar', 'อายุลูกหนี้ ณ ' + dLabel(S.asof), 'ค่าน้ำตามวันครบกำหนด · ใบแจ้งหนี้งานขายค้างชำระไม่มีวันครบกำหนดในข้อมูล จึงแยกเป็น “ไม่มีวันครบกำหนด”', 'สาขา · ประเภทลูกค้า · วันอ้างอิงลูกหนี้', '<div id="t-ar"></div>', { csv: 1 })}
        ${card('c-arch', 'อายุลูกหนี้แยกสาขา (ล้านบาท)', '', 'สาขา · ประเภทลูกค้า · วันอ้างอิงลูกหนี้', '<div class="chart" id="ch-ar"></div>', { table: 1 })}
      </div>
      <div class="grid" style="margin-top:16px">
        ${card('c-debt', 'ลูกค้า 10 รายแรกที่มียอดเกินกำหนด', `ณ ${dLabel(S.asof)} · ลูกค้าที่มียอดเกินกำหนดทั้งหมด ${int(S.d.debtors.n_overdue_cust)} ราย · คลิกแถวเพื่อดูใบแจ้งหนี้ค้างชำระ`, 'สาขา · ประเภทลูกค้า · วันอ้างอิงลูกหนี้', '<div id="t-debt"></div>', { csv: 1 })}
      </div>`;
    const kinds = [['water', 'ค่าน้ำ', C.navy], ['fee', 'งานขาย/บริการ', C.oliveChart], ['bond', 'เงินประกัน', C.sky]];
    const cs = kinds.map(([k, name, color]) => ({ name, type: 'bar', stack: 'k', barMaxWidth: 34, itemStyle: barStyle(color), data: months.map((m) => round2(sum(S.coll.filter((r) => r.m === m && okBr(r.br) && r.k === k), (r) => r.amt))) }));
    chart($('ch-coll'), { xAxis: catAxis(months.map(mLabel)), yAxis: valAxis(), series: cs, tooltip: { ...chartTT(), formatter: ttMoney() } });
    chartTable('c-coll', months.map(mLabel), cs.map((s) => ({ name: s.name, data: s.data })));
    const rs = [{ name: 'สัดส่วนรับชำระต่อยอดแจ้งหนี้', type: 'line', symbolSize: 8, lineStyle: { width: 2, color: C.navy }, itemStyle: { color: C.navy },
      data: months.map((m) => { const b = salesAgg(m, m, { ignoreTy: true }).billWaterInclVat; const c = sum(S.coll.filter((r) => r.m === m && okBr(r.br) && r.k === 'water'), (r) => r.amt); return b ? Math.round((c / b) * 1000) / 1000 : null; }),
      markLine: { silent: true, symbol: 'none', lineStyle: { color: C.text2, type: 'dotted' }, label: { formatter: '100%', color: C.text2, fontFamily: 'Prompt' }, data: [{ yAxis: 1 }] } }];
    chart($('ch-ratio'), { legend: { show: false }, grid: { left: 8, right: 48, top: 16, bottom: 8, containLabel: true }, xAxis: catAxis(months.map((m) => mLabel(m) + (S.pwaMissing.includes(m) ? ' ⚠' : ''))), yAxis: valAxis((v) => nf0.format(v * 100) + '%'), series: rs,
      tooltip: { ...chartTT(), axisPointer: { type: 'line' }, valueFormatter: (v) => pct(v) } });
    chartTable('c-ratio', months.map(mLabel), rs.map((s) => ({ name: s.name, data: s.data })), 'p');

    const cm = {}; co.rows.forEach((r) => { const x = cm[r.m] || (cm[r.m] = { m: r.m, n: 0, billed: 0, paid: 0, ontime: 0, open: 0 }); ['n', 'billed', 'paid', 'ontime', 'open'].forEach((k) => { x[k] += r[k]; }); });
    const crows = Object.values(cm).sort((a, b) => a.m.localeCompare(b.m));
    $('t-cohort').innerHTML = crows.length ? table([
      { h: 'เดือนออกใบแจ้งหนี้', nw: 1, f: (r) => mLabel(r.m) }, { h: 'แจ้งหนี้ (บาท)', n: 1, f: (r) => baht(r.billed) }, { h: 'ชำระแล้ว', n: 1, f: (r) => baht(r.paid) },
      { h: 'อัตราเก็บได้', n: 1, f: (r) => pct(r.paid / r.billed) }, { h: 'ตรงเวลา', n: 1, f: (r) => pct(r.ontime / r.billed) }, { h: 'ค้าง', n: 1, f: (r) => baht(r.open) },
    ], crows, ['รวม', baht(co.billed), baht(co.paid), pct(co.billed ? co.paid / co.billed : null), pct(co.billed ? co.ontime / co.billed : null), baht(co.open)])
      : '<div class="state">ช่วงที่เลือกไม่มีใบแจ้งหนี้ระบบใหม่ (เริ่ม มี.ค. 69)</div>';

    const chm = {}; S.coll.filter((r) => inR(r.m, from, to) && okBr(r.br)).forEach((r) => { const x = chm[r.ch] || (chm[r.ch] = { ch: r.ch, n: 0, amt: 0, z: 0 }); x.n += r.n; x.amt += r.amt; x.z += r.zero_n; });
    const chrows = Object.values(chm).sort((a, b) => b.amt - a.amt);
    $('t-ch').innerHTML = table([
      { h: 'ช่องทาง', f: (r) => esc(CH_NAME[r.ch] || r.ch) }, { h: 'ใบเสร็จ', n: 1, f: (r) => int(r.n) }, { h: 'ยอด (บาท)', n: 1, f: (r) => baht(r.amt) }, { h: 'สัดส่วน', n: 1, f: (r) => pct(coll.total ? r.amt / coll.total : null) }, { h: 'ยอด 0', n: 1, f: (r) => int(r.z) },
    ], chrows, ['รวม', int(coll.n), baht(coll.total), '100.0%', int(coll.zero)]);

    const arRows = AGING.map((g) => ({ g, amt: ar.b[g.k], n: sum(ar.rows.filter((r) => r.bk === g.k), (r) => r.n), leg: sum(ar.rows.filter((r) => r.bk === g.k && r.legacy), (r) => r.amt) }));
    $('t-ar').innerHTML = table([
      { h: 'ช่วงอายุ', nw: 1, f: (r) => `<span class="sw" style="background:${r.g.color}"></span> ${r.g.name}` }, { h: 'ใบ', n: 1, f: (r) => int(r.n) }, { h: 'ยอด (บาท รวม VAT)', n: 1, f: (r) => baht(r.amt) },
      { h: 'สัดส่วน', n: 1, f: (r) => pct(ar.total ? r.amt / ar.total : null) }, { h: 'ในนี้จากระบบเดิม', n: 1, f: (r) => baht(r.leg) },
    ], arRows, ['รวม', int(ar.n), baht(ar.total), '100.0%', baht(ar.legacy)]);
    arChart('ch-ar', 'c-arch', ar);

    const dt = S.debt.filter((r) => okBr(r.br) && okTy(r.ty)).slice(0, 10);
    $('t-debt').innerHTML = table([
      { h: 'ทะเบียน', nw: 1, k: 'reg' }, { h: 'ชื่อ', f: nameCell, cls: 'name' }, { h: 'สาขา', nw: 1, k: 'br' }, { h: 'ประเภท', nw: 1, f: (r) => esc(TY_NAME[r.ty] || r.ty) }, { h: 'สถานะ', nw: 1, f: (r) => esc(STATUS_TH[r.status] || r.status) },
      { h: 'เกินกำหนด (บาท)', n: 1, f: (r) => baht(r.overdue) }, { h: '1–30', n: 1, f: (r) => baht(r.b1) }, { h: '31–60', n: 1, f: (r) => baht(r.b2) }, { h: '61–90', n: 1, f: (r) => baht(r.b3) }, { h: '> 90', n: 1, f: (r) => baht(r.b4) },
      { h: 'คงค้างทั้งหมด', n: 1, f: (r) => baht(r.ar) }, { h: 'ครบกำหนดเก่าสุด', nw: 1, f: (r) => dLabel(r.oldest) },
    ], dt, null, { click: 1 });
    $('t-debt').querySelectorAll('tr.click').forEach((tr) => {
      const open = () => { const r = dt[tr.dataset.row]; const docs = S.debtDocs.filter((x) => x.cw === r.cw);
        drill(`${r.reg} · ${r.name}`, [{ h: 'เลขที่ใบแจ้งหนี้', nw: 1, k: 'doc' }, { h: 'วันที่ออก', nw: 1, f: (x) => dLabel(x.issue) }, { h: 'ครบกำหนด', nw: 1, f: (x) => dLabel(x.due) }, { h: 'เกินกำหนด (วัน)', n: 1, f: (x) => (x.days > 0 ? int(x.days) : 'ยังไม่ครบ') }, { h: 'ลบ.ม.', n: 1, f: (x) => int(x.units) }, { h: 'ยอด (บาท รวม VAT)', n: 1, f: (x) => baht(x.amt) }],
          docs, `ใบแจ้งหนี้ค่าน้ำค้างชำระ ${docs.length} ใบ รวม ${baht(sum(docs, (x) => x.amt))} บาท ณ ${dLabel(S.asof)}`); };
      tr.addEventListener('click', open); tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
    });
  }

  // ================= รายได้ตามกลุ่มลูกค้า (รายงานสำหรับผู้บริหาร) =================
  const RG = [
    { k: 'T1', name: 'T1 อัตราก้าวหน้า', cat: 'g' }, { k: 'T2', name: 'T2 อัตราก้าวหน้า', cat: 'g' }, { k: 'T2.1', name: 'T2.1 ตำรวจภูธรภาค 8', cat: 'g' }, { k: 'T3', name: 'T3 อัตราก้าวหน้า', cat: 'g' },
    { k: 'T3.1', name: 'ทอท. (ท่าอากาศยานภูเก็ต)', cat: 'c' }, { k: 'T2.2', name: 'กปภ. (ขายส่ง)', cat: 'c' }, { k: 'T2.3', name: 'หอถังสูง อบต.ไม้ขาว', cat: 'c' },
  ];
  const rgOf = (ty) => (RG.find((g) => g.k === ty) ? ty : 'other');
  function revAgg(pred) {
    const o = {};
    const get = (k, y) => { const key = k + '|' + y; return o[key] || (o[key] = { net: 0, fee: 0, wnet: 0, units: 0, free: 0, cm: 0, cust: 0 }); };
    S.rev.filter((r) => okBr(r.br) && okTy(r.ty) && (!pred || pred(r))).forEach((r) => {
      const a = get(r.src === 'F' ? 'fee' : rgOf(r.ty), r.y);
      if (r.src === 'F') a.fee += r.net; else a.net += r.net;
      if (r.src === 'W' || (r.src === 'L' && r.units)) { a.wnet += r.net; a.units += r.units || 0; a.free += r.free || 0; }
      if (r.src === 'W' || r.src === 'L') a.cm += r.cm;
    });
    S.revCust.filter((r) => okBr(r.br) && okTy(r.ty) && (!pred || pred(r))).forEach((r) => { get(rgOf(r.ty), r.y).cust += r.n; });
    return (k, y) => o[k + '|' + y] || { net: 0, fee: 0, wnet: 0, units: 0, free: 0, cm: 0, cust: 0 };
  }
  const chg = (a, b) => (b ? (a - b) / Math.abs(b) : null);
  const pctTxt = (v) => (v == null ? '–' : (v >= 0 ? '+' : '') + nf1.format(v * 100) + '%');
  const pillChg = (a, b) => (b ? cmpPill(a, b, '') : '<span class="pill na">ใหม่</span>');

  function pRevenue(el) {
    const W = S.d.revenue_groups.window, Y1 = Number(W[1].slice(0, 4)), Y0 = Y1 - 1;
    const per = `${mLabel(W[0].slice(0, 7))} – ${mLabel(W[1].slice(0, 7))}`, perPrev = `${mLabel(W[2].slice(0, 7))} – ${mLabel(W[3].slice(0, 7))}`;
    const A = revAgg(), keys = RG.map((g) => g.k).concat(['other']);
    const tot = (y) => sum(keys, (k) => A(k, y).net) + A('fee', y).fee;
    const t1 = tot(Y1), t0 = tot(Y0);
    const pwa1 = A('T2.2', Y1).net, pwa0 = A('T2.2', Y0).net;
    const gen = (y, f) => sum(RG.filter((g) => g.cat === 'g'), (g) => f(A(g.k, y)));
    const con = (y, f) => sum(RG.filter((g) => g.cat === 'c'), (g) => f(A(g.k, y)));
    const wAll1 = gen(Y1, (a) => a.wnet) + con(Y1, (a) => a.wnet), uAll1 = gen(Y1, (a) => a.units) + con(Y1, (a) => a.units);
    const cmGen1 = gen(Y1, (a) => a.cm), months = Number(W[1].slice(5, 7));
    const pwaGap = S.pwaMissing.filter((m) => m >= W[0].slice(0, 7) && m <= W[1].slice(0, 7));
    const row = (g) => { const a = A(g.k, Y1), b = A(g.k, Y0); return { g, a, b }; };
    const rows = RG.map(row).concat([{ g: { k: 'other', name: 'อื่น ๆ / ไม่ระบุ', cat: 'o' }, a: A('other', Y1), b: A('other', Y0) }]).filter((r) => r.a.net || r.b.net);
    const pu = (a) => (a.units ? a.wnet / a.units : null), arpu = (a) => (a.cm ? a.net / a.cm : null);
    const fmtPU = (v) => (v == null ? '–' : nf2.format(v));
    const subtotal = (cat, y) => { const rs = rows.filter((r) => r.g.cat === cat); const s = (f) => sum(rs, (r) => f(y === Y1 ? r.a : r.b)); return { net: s((a) => a.net), wnet: s((a) => a.wnet), units: s((a) => a.units), cm: s((a) => a.cm), cust: s((a) => a.cust) }; };
    const tRow = (label, a, b, cls) => ({ label, a, b, cls });
    const trs = [];
    trs.push({ head: 'ลูกค้าทั่วไป (อัตราก้าวหน้า)' });
    rows.filter((r) => r.g.cat === 'g').forEach((r) => trs.push(tRow(r.g.name, r.a, r.b)));
    trs.push(tRow('รวมลูกค้าทั่วไป', subtotal('g', Y1), subtotal('g', Y0), 'sub'));
    trs.push({ head: 'ลูกค้าสัญญารายใหญ่' });
    rows.filter((r) => r.g.cat === 'c').forEach((r) => trs.push(tRow(r.g.name, r.a, r.b)));
    trs.push(tRow('รวมลูกค้าสัญญารายใหญ่', subtotal('c', Y1), subtotal('c', Y0), 'sub'));
    rows.filter((r) => r.g.cat === 'o').forEach((r) => trs.push(tRow(r.g.name, r.a, r.b)));
    trs.push(tRow('งานขาย/บริการอื่น (ค่าติดตั้ง ฯลฯ)', { net: A('fee', Y1).fee }, { net: A('fee', Y0).fee }));
    trs.push(tRow('รวมรายได้ทั้งสิ้น', { net: t1 }, { net: t0 }, 'total'));
    const tbl = `<div class="tbl-wrap"><table class="t" data-csvable="1"><thead><tr>
      <th>กลุ่มลูกค้า</th><th class="n">รายได้ ${Y0 + 543} (บาท)</th><th class="n">รายได้ ${Y1 + 543} (บาท)</th><th class="n">YoY</th><th class="n">สัดส่วน ${Y1 + 543}</th>
      <th class="n">ลบ.ม. ${Y1 + 543}</th><th class="n">บาท/ลบ.ม. ${Y0 + 543}</th><th class="n">บาท/ลบ.ม. ${Y1 + 543}</th><th class="n">ลูกค้า (ราย)</th><th class="n">รายได้/ราย/เดือน ${Y0 + 543}</th><th class="n">รายได้/ราย/เดือน ${Y1 + 543}</th></tr></thead><tbody>
      ${trs.map((r) => r.head ? `<tr class="grp"><td colspan="11">${r.head}</td></tr>` : `<tr class="${r.cls || ''}"><td>${esc(r.label)}${r.label.startsWith('กปภ') && pwaGap.length ? ` <span class="pill warn" title="ไม่มีใบแจ้งหนี้ ${pwaGap.map(mLabel).join(', ')}">⚠ ไม่มีบิล ${pwaGap.length} เดือน</span>` : ''}</td>
        <td class="n">${baht(r.b.net)}</td><td class="n">${baht(r.a.net)}</td><td class="n">${r.b.net ? pillChg(r.a.net, r.b.net) : '–'}</td><td class="n">${pct(t1 ? r.a.net / t1 : null)}</td>
        <td class="n">${r.a.units ? int(r.a.units) : '–'}</td><td class="n">${fmtPU(r.b.units ? r.b.wnet / r.b.units : null)}</td><td class="n">${fmtPU(r.a.units ? r.a.wnet / r.a.units : null)}</td>
        <td class="n">${r.a.cust ? int(r.a.cust) : '–'}</td><td class="n">${r.b.cm ? int(r.b.net / r.b.cm) : '–'}</td><td class="n">${r.a.cm ? int(r.a.net / r.a.cm) : '–'}</td></tr>`).join('')}
      </tbody></table></div>`;

    // ตำบล x กลุ่ม
    const brs = ['ไม้ขาว', 'สาคู'].filter(okBr);
    const brTbl = brs.map((br) => { const B = revAgg((r) => r.br === br); const rs = RG.map((g) => ({ g, a: B(g.k, Y1), b: B(g.k, Y0) })).filter((r) => r.a.net || r.b.net);
      const ta = sum(rs, (r) => r.a.net), tb = sum(rs, (r) => r.b.net);
      return `<h4 class="sub-h">ตำบล${br}</h4>` + table([
        { h: 'กลุ่ม', f: (r) => esc(r.g.name) }, { h: `รายได้ ${Y0 + 543}`, n: 1, f: (r) => baht(r.b.net) }, { h: `รายได้ ${Y1 + 543}`, n: 1, f: (r) => baht(r.a.net) },
        { h: 'YoY', n: 1, f: (r) => (r.b.net ? pillChg(r.a.net, r.b.net) : '–') }, { h: 'บาท/ลบ.ม.', n: 1, f: (r) => fmtPU(pu(r.a)) }, { h: 'ลูกค้า', n: 1, f: (r) => int(r.a.cust) }, { h: 'รายได้/ราย/เดือน', n: 1, f: (r) => (r.a.cm ? int(arpu(r.a)) : '–') },
      ], rs, ['รวม', baht(tb), baht(ta), tb ? pctTxt(chg(ta, tb)) : '', '', '', '']); }).join('');

    // หมู่ (ลูกค้าทั่วไป)
    const moos = {};
    S.rev.filter((r) => okBr(r.br) && okTy(r.ty) && (r.src === 'W' || r.src === 'C') && !['T2.2', 'T2.3', 'T3.1'].includes(r.ty) && ['ไม้ขาว', 'สาคู'].includes(r.br)).forEach((r) => {
      const k = r.br + '|' + r.moo, x = moos[k] || (moos[k] = { br: r.br, moo: r.moo, n1: 0, n0: 0, u1: 0, cm1: 0, cm0: 0, c1: 0 });
      if (r.y === Y1) { x.n1 += r.net; x.u1 += r.units || 0; x.cm1 += r.cm; } else { x.n0 += r.net; x.cm0 += r.cm; }
    });
    S.revCust.filter((r) => r.y === Y1 && okBr(r.br) && okTy(r.ty) && !['T2.2', 'T2.3', 'T3.1'].includes(r.ty)).forEach((r) => { const x = moos[r.br + '|' + r.moo]; if (x) x.c1 += r.n; });
    const moo = Object.values(moos).filter((x) => x.n1 || x.n0).sort((a, b) => a.br.localeCompare(b.br) || (a.moo === 'ไม่ระบุหมู่') - (b.moo === 'ไม่ระบุหมู่') || a.moo.localeCompare(b.moo, 'th', { numeric: true }));
    const mooSel = S.f.moo || '';

    // insight (คำนวณจากข้อมูล)
    const g1 = subtotal('g', Y1), g0 = subtotal('g', Y0);
    const T3 = A('T3', Y1), T3b = A('T3', Y0), T2 = A('T2', Y1), T2b = A('T2', Y0), HT = A('T2.3', Y1), AOT = A('T3.1', Y1), PW = A('T2.2', Y1);
    const ex1 = t1 - pwa1, ex0 = t0 - pwa0;
    const moov = moo.filter((x) => x.n0 > 300000 && x.moo !== 'ไม่ระบุหมู่').map((x) => ({ ...x, c: chg(x.n1, x.n0) })).sort((a, b) => a.c - b.c);
    const ins = [];
    if (t0) ins.push(['bad', `รายได้รวม ${per} ${pctTxt(chg(t1, t0))} (${mb(t1)} เทียบ ${mb(t0)} ล้านบาท)`, `ส่วนที่หายไปมาจาก กปภ. ${mb(pwa1 - pwa0)} ล้านบาท${pwaGap.length ? ` (ไม่มีใบแจ้งหนี้ ${pwaGap.map(mLabel).join(', ')} — พ.ค. ไม่มีการส่งน้ำช่วงแล้ง และสัญญาขายส่งสิ้นสุดหลัง ก.ค. 69)` : ''} · ถ้าไม่นับ กปภ. รายได้ ${pctTxt(chg(ex1, ex0))}`]);
    if (T3.net) ins.push(['info', `T3 เป็นแหล่งรายได้หลัก ${pct(T3.net / t1)} ของรายได้ และโต ${pctTxt(chg(T3.net, T3b.net))}`, `ปริมาณน้ำ T3 ${pctTxt(chg(T3.units, T3b.units))} ขณะราคาต่อหน่วยคงที่ ${fmtPU(pu(T3))} บาท/ลบ.ม. — การเติบโตมาจากปริมาณใช้น้ำของโรงแรม/คอนโด ลูกค้าเพียง ${int(T3.cust)} ราย รายได้เฉลี่ย ${int(arpu(T3))} บาท/ราย/เดือน`]);
    if (HT.units) ins.push(['warn', `หอถังสูง อบต. ใช้น้ำมากที่สุด ${int(HT.units)} ลบ.ม. แต่ราคาต่ำสุด ${fmtPU(pu(HT))} บาท/ลบ.ม.`, `เทียบ T1 ${fmtPU(pu(A('T1', Y1)))} · กปภ. ${fmtPU(pu(PW))} · ทอท. ${fmtPU(pu(AOT))} · T3 ${fmtPU(pu(T3))} บาท/ลบ.ม. — ทุก 1 บาท/ลบ.ม. ≈ ${mb(HT.units / months * 12)} ล้านบาท/ปี`]);
    if (T2.cust && T2b.cust) ins.push(['info', `T2 ลูกค้าเพิ่ม ${pctTxt(chg(T2.cust, T2b.cust))} แต่รายได้ต่อรายลดลง ${pctTxt(chg(arpu(T2), arpu(T2b)))}`, `รายได้ T2 รวม ${pctTxt(chg(T2.net, T2b.net))} — ลูกค้าใหม่ใช้น้ำน้อยกว่ารายเดิม ปริมาณน้ำรวม ${pctTxt(chg(T2.units, T2b.units))}`]);
    if (moov.length) { const lo = moov[0], hi = moov[moov.length - 1];
      ins.push(['info', `รายได้ตามหมู่: ${lo.br} ${lo.moo} ${pctTxt(lo.c)} · ${hi.br} ${hi.moo} ${pctTxt(hi.c)}`, `ความเปลี่ยนแปลงในระดับหมู่มาจากลูกค้า T3 ไม่กี่ราย (โรงแรม/คอนโด) — ดูรายชื่อที่หน้า “การใช้น้ำเทียบปีก่อน”`]); }
    const rec = [
      ['หาลูกค้าแทนน้ำขายส่ง กปภ.', `กปภ. เคยซื้อเฉลี่ย ~${int(PW.units / Math.max(1, new Set(S.rev.filter((r) => r.y === Y1 && r.ty === 'T2.2' && r.net > 0).map((r) => r.mm)).size))} ลบ.ม./เดือน ที่ ${fmtPU(pu(PW))} บาท/ลบ.ม. หากขายน้ำส่วนนี้ให้ลูกค้า T3 ได้ 10,000 ลบ.ม./เดือน ≈ +${mb(10000 * (pu(T3) || 0) * 12)} ล้านบาท/ปี — จัดลำดับโครงการ/โรงแรมตามแนวท่อ (DMA) ที่ยังไม่เป็นลูกค้า หรือเจรจาสัญญา กปภ. รอบใหม่`],
      ['ทบทวนอัตราหอถังสูง อบต.', `ราคาเฉลี่ย ${fmtPU(pu(HT))} บาท/ลบ.ม. ต่ำกว่าทุกกลุ่ม ทั้งที่ปริมาณสูงสุด — พิจารณาในการเจรจา/ทบทวนเงื่อนไขสัญญาสัมปทาน (ทุก +1 บาท ≈ +${mb(HT.units / months * 12)} ล้านบาท/ปี)`],
      ['รักษาและขยายลูกค้า T3', `T3 ${int(T3.cust)} รายสร้างรายได้ ${pct(T3.net / t1)} — ตั้งผู้ดูแลลูกค้ารายใหญ่ ติดตามรายที่ใช้น้ำลดลง (มีรายชื่อในหน้าการใช้น้ำ) ตรวจมาตร/สอบถามแหล่งน้ำทดแทน และเสนอการเชื่อมต่อให้โครงการใหม่`],
      ['ทอท.: ต่ออายุสัญญาและเร่งเก็บหนี้', `รายได้ ${mb(AOT.net)} ล้านบาท ที่ ${fmtPU(pu(AOT))} บาท/ลบ.ม. — ใช้รอบต่อสัญญาทบทวนราคา/ปริมาณขั้นต่ำ และเร่งติดตามหนี้ค้าง (ดูหน้าการจัดเก็บ)`],
      ['ลูกค้า T2 และ T2.1', `T2 รายได้ต่อรายลดลง — ตรวจการจัดประเภท (รายที่ใช้น้ำสูงควรเป็น T3) และสิทธิ์น้ำฟรี · T2.1 ตำรวจภูธรภาค 8 ราคา ${fmtPU(pu(A('T2.1', Y1)))} บาท/ลบ.ม. ต่ำกว่า T2 (${fmtPU(pu(T2))}) ควรทบทวนเงื่อนไขอัตรา`],
    ];

    el.innerHTML = `
      <h2 class="sec-title">รายได้ตามกลุ่มลูกค้า ${per} เทียบ ${perPrev}</h2>
      <div class="grid g4">
        ${kpi(`รายได้ ${per} (ไม่รวม VAT)`, mb(t1), 'ล้านบาท', `ปีก่อน ${mb(t0)} ล้านบาท`, cmpPill(t1, t0, 'YoY', { warn: pwaGap.length ? 'มีเดือนที่ กปภ. ไม่มีใบแจ้งหนี้' : null }), 'accent')}
        ${kpi('รายได้ไม่รวม กปภ.', mb(ex1), 'ล้านบาท', `ปีก่อน ${mb(ex0)} ล้านบาท`, cmpPill(ex1, ex0, 'YoY'), 'accent')}
        ${kpi('รายได้ค่าน้ำ+บริการเฉลี่ยต่อหน่วย', nf2.format(uAll1 ? wAll1 / uAll1 : 0), 'บาท/ลบ.ม.', `ทุกกลุ่มที่มีหน่วยน้ำ · ${int(uAll1)} ลบ.ม.`)}
        ${kpi('รายได้ต่อราย/เดือน (ลูกค้าทั่วไป)', int(cmGen1 ? g1.net / cmGen1 : 0), 'บาท', `ลูกค้าทั่วไป ${int(g1.cust)} ราย · ปีก่อน ${int(g0.cm ? g0.net / g0.cm : 0)} บาท`)}
      </div>
      <div class="grid" style="margin-top:16px">
        ${card('c-rev', `รายได้แยกกลุ่มลูกค้า ${per}`, 'ไม่รวม VAT · หักส่วนลดและใบลดหนี้แล้ว · บาท/ลบ.ม. = รายได้ค่าน้ำ+ค่าบริการ ÷ ลบ.ม. ที่ออกใบแจ้งหนี้ · รายได้/ราย/เดือน = รายได้ ÷ จำนวนบิลรายเดือน · ลูกค้าสัญญาปีก่อนไม่มีข้อมูลหน่วยน้ำ', 'สาขา (ตำบล) · ประเภทลูกค้า (ช่วงเดือนไม่มีผล: ใช้ ม.ค.–เดือนเต็มล่าสุด)', tbl, { csv: 1 })}
      </div>
      <div class="grid g2" style="margin-top:16px">
        ${card('c-revbar', `รายได้แยกกลุ่ม ${Y0 + 543} เทียบ ${Y1 + 543} (ล้านบาท)`, '', 'สาขา · ประเภทลูกค้า', '<div class="chart tall" id="ch-revbar"></div>', { table: 1 })}
        ${card('c-pu', 'รายได้ต่อหน่วยแยกกลุ่ม (บาท/ลบ.ม.)', `ปี ${Y1 + 543} · เส้นประ = ค่าเฉลี่ยทุกกลุ่ม`, 'สาขา · ประเภทลูกค้า', '<div class="chart tall" id="ch-pu"></div>', { table: 1 })}
      </div>
      <div class="grid g2" style="margin-top:16px">
        ${card('c-ins', 'Insight', 'สรุปจากข้อมูลจริงตามตัวกรองที่เลือก', 'สาขา · ประเภทลูกค้า', `<ul class="issues">${ins.map(([l, t, d]) => `<li><span class="ic ${l}" aria-hidden="true">${l === 'bad' ? '!' : l === 'warn' ? '⚠' : 'i'}</span><div><b>${esc(t)}</b><br><span class="small">${esc(d)}</span></div></li>`).join('')}</ul>`)}
        ${card('c-rec', 'ข้อเสนอแนะเพื่อเพิ่มรายได้', 'ตัวเลขประมาณการคำนวณจากข้อมูลช่วงนี้ ใช้ประกอบการตัดสินใจ ไม่ใช่ผลที่รับประกัน', '', `<ol class="recs">${rec.map(([t, d]) => `<li><b>${esc(t)}</b><br><span class="small">${esc(d)}</span></li>`).join('')}</ol>`)}
      </div>
      <div class="grid" style="margin-top:16px">
        ${card('c-brg', 'รายได้แยกตำบล × กลุ่มลูกค้า', `${per} เทียบปีก่อน · สาขาไม้ขาว = ตำบลไม้ขาว, สาขาสาคู = ตำบลสาคู`, 'สาขา · ประเภทลูกค้า', brTbl, { csv: 1 })}
      </div>
      <div class="grid" style="margin-top:16px">
        ${card('c-moo', 'รายได้ลูกค้าทั่วไปแยกหมู่', 'หมู่อ่านจากที่อยู่ในใบแจ้งหนี้ (ไม่รวมลูกค้าสัญญารายใหญ่) · “ไม่ระบุหมู่” = ที่อยู่ไม่มีเลขหมู่หรืออยู่นอกตำบล', 'สาขา · ประเภทลูกค้า', '<div id="t-moo"></div>', { csv: 1 })}
      </div>`;
    $('t-moo').innerHTML = table([
      { h: 'ตำบล', nw: 1, k: 'br' }, { h: 'หมู่', nw: 1, k: 'moo' }, { h: 'ลูกค้า', n: 1, f: (x) => int(x.c1) }, { h: `รายได้ ${Y0 + 543}`, n: 1, f: (x) => baht(x.n0) }, { h: `รายได้ ${Y1 + 543}`, n: 1, f: (x) => baht(x.n1) },
      { h: 'YoY', n: 1, f: (x) => (x.n0 ? pillChg(x.n1, x.n0) : '–') }, { h: 'ลบ.ม.', n: 1, f: (x) => int(x.u1) }, { h: 'บาท/ลบ.ม.', n: 1, f: (x) => (x.u1 ? nf2.format(x.n1 / x.u1) : '–') }, { h: 'รายได้/ราย/เดือน', n: 1, f: (x) => (x.cm1 ? int(x.n1 / x.cm1) : '–') },
    ], moo, ['รวม', '', int(sum(moo, (x) => x.c1)), baht(sum(moo, (x) => x.n0)), baht(sum(moo, (x) => x.n1)), '', int(sum(moo, (x) => x.u1)), '', '']);
    void mooSel;
    const cats = rows.filter((r) => r.g.cat !== 'o').map((r) => r.g.name.replace(' อัตราก้าวหน้า', '').replace(' (ท่าอากาศยานภูเก็ต)', '').replace(' (ขายส่ง)', ''));
    const sb = [
      { name: String(Y0 + 543), type: 'bar', barMaxWidth: 22, itemStyle: barStyle(C.sky), data: rows.filter((r) => r.g.cat !== 'o').map((r) => round2(r.b.net)) },
      { name: String(Y1 + 543), type: 'bar', barMaxWidth: 22, itemStyle: barStyle(C.navy), data: rows.filter((r) => r.g.cat !== 'o').map((r) => round2(r.a.net)) },
    ];
    chart($('ch-revbar'), { grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true }, xAxis: { ...catAxis(cats), axisLabel: { ...baseText, interval: 0, rotate: 30 } }, yAxis: valAxis(), series: sb, tooltip: { ...chartTT(), formatter: ttMoney() } });
    chartTable('c-revbar', cats, sb.map((s) => ({ name: s.name, data: s.data })));
    const puRows = rows.filter((r) => r.g.cat !== 'o' && r.a.units).sort((a, b) => pu(a.a) - pu(b.a));
    const avg = uAll1 ? wAll1 / uAll1 : 0;
    const ps = [{ name: 'บาท/ลบ.ม.', type: 'bar', barMaxWidth: 26, itemStyle: barStyle(C.navy), data: puRows.map((r) => Math.round(pu(r.a) * 100) / 100),
      label: { show: true, position: 'right', color: C.body, fontFamily: 'Prompt', formatter: (p) => nf2.format(p.value) },
      markLine: { silent: true, symbol: 'none', lineStyle: { color: C.text2, type: 'dashed' }, label: { formatter: 'เฉลี่ย ' + nf2.format(avg), color: C.text2, fontFamily: 'Prompt' }, data: [{ xAxis: Math.round(avg * 100) / 100 }] } }];
    chart($('ch-pu'), { legend: { show: false }, grid: { left: 8, right: 56, top: 16, bottom: 8, containLabel: true }, xAxis: valAxis((v) => nf0.format(v)), yAxis: catAxis(puRows.map((r) => r.g.name.replace(' อัตราก้าวหน้า', ''))), series: ps, tooltip: { ...chartTT(), valueFormatter: (v) => nf2.format(v) + ' บาท/ลบ.ม.' } });
    chartTable('c-pu', puRows.map((r) => r.g.name), ps.map((s) => ({ name: s.name, data: s.data })), 'p2');
  }

  // ================= การใช้น้ำเทียบปีก่อน (ย้ายจาก WMS dashboard เดิม) =================
  const UK = { up: ['ใช้น้ำเพิ่มขึ้น (≥ +10%)', 'up'], flat: ['ใกล้เคียงเดิม (±10%)', 'na'], down: ['ใช้น้ำลดลง (≤ −10%)', 'down'], new: ['เริ่มใช้น้ำ/ลูกค้าใหม่', 'up'], stop: ['ไม่มีการใช้น้ำ/หยุดใช้', 'down'] };
  const AUDIT = { active_no_bill: 'ทะเบียนใช้งาน แต่ไม่มีบิล 2 เดือนล่าสุด', inactive_billed: 'ทะเบียนงด/ยกเลิก แต่ยังออกบิลเดือนล่าสุด', pending_billed: 'ทะเบียนรอติดตั้ง แต่มีบิลแล้ว' };
  function pUsage(el) {
    const U = S.d.usage_compare, w = U.window, Y1 = Number(w[1].slice(0, 4)), Y0 = Y1 - 1;
    const per1 = `${mLabel(w[0].slice(0, 7))}–${mLabel(w[1].slice(0, 7))}`, per0 = `${mLabel(w[2].slice(0, 7))}–${mLabel(w[3].slice(0, 7))}`;
    const st = U.status.map(([br, k, n, q0, q1]) => ({ br, k, n, q0, q1 })).filter((r) => okBr(r.br));
    const mon = U.monthly.map(([m, br, qe, qx, qa]) => ({ m, br, qe: qe || 0, qx: qx || 0, qa: qa || 0 })).filter((r) => okBr(r.br));
    const days = (m) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7), 0)).getUTCDate();
    const ms1 = monthsBetween(`${Y1}-01`, w[1].slice(0, 7));
    const qd = (m, f) => sum(mon.filter((r) => r.m === m), f) / days(m);
    const ex1 = sum(st, (r) => r.q1), ex0 = sum(st, (r) => r.q0);
    const lastM = w[1].slice(0, 7);
    el.innerHTML = `
      <h2 class="sec-title">การใช้น้ำเทียบปีก่อน</h2>
      <div class="grid g4">
        ${kpi(`ปริมาณน้ำ ${mLabel(lastM)} (ลบ.ม./วัน)`, int(qd(lastM, (r) => r.qa)), 'ลบ.ม./วัน', `ไม่รวม กปภ. ${int(qd(lastM, (r) => r.qx))} ลบ.ม./วัน`, '', 'accent')}
        ${kpi(`ลูกค้าทั่วไป ${per1}`, int(ex1), 'ลบ.ม.', `เทียบ ${per0} ${int(ex0)} ลบ.ม.`, cmpPill(ex1, ex0, 'YoY'), 'accent')}
        ${kpi('ลูกค้าที่ใช้น้ำลดลง ≥ 10%', int(sum(st.filter((r) => r.k === 'down'), (r) => r.n)), 'ราย', `ลดลงรวม ${int(sum(st.filter((r) => r.k === 'down'), (r) => r.q0 - r.q1))} ลบ.ม. · หยุดใช้ ${int(sum(st.filter((r) => r.k === 'stop'), (r) => r.n))} ราย`)}
        ${kpi('ลูกค้าที่ใช้น้ำเพิ่มขึ้น ≥ 10%', int(sum(st.filter((r) => r.k === 'up'), (r) => r.n)), 'ราย', `เพิ่มรวม ${int(sum(st.filter((r) => r.k === 'up'), (r) => r.q1 - r.q0))} ลบ.ม. · ใหม่ ${int(sum(st.filter((r) => r.k === 'new'), (r) => r.n))} ราย`)}
      </div>
      <div class="grid g2" style="margin-top:16px">
        ${card('c-qd', `ปริมาณน้ำต่อวัน ม.ค. ${Y0 + 543} – ${mLabel(lastM)} (ลบ.ม./วัน)`, 'ลูกค้าเดิม = ผู้ใช้น้ำทั่วไปที่มีบิลก่อนปีนี้ (ไม่รวม กปภ. ทอท. หอถัง อบต. และลูกค้าใหม่) · ปีก่อนไม่มีหน่วยน้ำของลูกค้าสัญญารายใหญ่ (ออกบิลในระบบเดิม)', 'สาขา', '<div class="chart tall" id="ch-qd"></div>', { table: 1 })}
        ${card('c-qst', `ลูกค้าตามการเปลี่ยนแปลงการใช้น้ำ ${per1} เทียบ ${per0}`, 'ลูกค้าทั่วไป (ไม่รวม กปภ. ทอท. หอถัง อบต.) · ช่วงเดียวกันทั้งสองปีเพื่อตัดผลฤดูกาล', 'สาขา', '<div id="t-qst"></div>', { csv: 1 })}
      </div>
      <div class="grid g2" style="margin-top:16px">
        ${card('c-qdecl', '20 อันดับลูกค้าทั่วไปที่ใช้น้ำลดลงมากที่สุด', `${per1} เทียบ ${per0} · ควรให้ฝ่ายขายติดต่อสอบถาม`, 'สาขา · ประเภทลูกค้า', '<div id="t-qdecl"></div>', { csv: 1 })}
        ${card('c-aud', 'ตรวจทะเบียนเทียบการออกบิล', 'รายที่สถานะทะเบียนกับการออกบิลไม่สอดคล้อง (สาขาที่เปิดอยู่) · คำอธิบายจากหน้างานยังไม่มีในฐานข้อมูล', 'สาขา', '<div id="t-aud"></div>', { csv: 1 })}
      </div>`;
    const gs = ['up', 'flat', 'down', 'new', 'stop'].map((k) => { const x = st.filter((r) => r.k === k); const by = (b) => sum(x.filter((r) => r.br === b), (r) => r.n); return { k, mk: by('ไม้ขาว'), sk: by('สาคู'), n: sum(x, (r) => r.n), q0: sum(x, (r) => r.q0), q1: sum(x, (r) => r.q1) }; });
    $('t-qst').innerHTML = table([
      { h: 'การเปลี่ยนแปลง', f: (r) => `<span class="pill ${UK[r.k][1]}">${UK[r.k][0]}</span>` }, { h: 'ไม้ขาว', n: 1, f: (r) => int(r.mk) }, { h: 'สาคู', n: 1, f: (r) => int(r.sk) }, { h: 'รวม (ราย)', n: 1, f: (r) => int(r.n) },
      { h: `ลบ.ม. ${per0}`, n: 1, f: (r) => int(r.q0) }, { h: `ลบ.ม. ${per1}`, n: 1, f: (r) => int(r.q1) }, { h: 'ผลต่าง', n: 1, f: (r) => (r.q1 - r.q0 >= 0 ? '+' : '') + int(r.q1 - r.q0) },
    ], gs, ['รวม', int(sum(gs, (r) => r.mk)), int(sum(gs, (r) => r.sk)), int(sum(gs, (r) => r.n)), int(ex0), int(ex1), (ex1 - ex0 >= 0 ? '+' : '') + int(ex1 - ex0)]);
    const dl = U.decl.map(([reg, name, br, ty, q0, q1]) => ({ reg, name, br, ty, q0, q1 })).filter((r) => okBr(r.br) && okTy(r.ty));
    $('t-qdecl').innerHTML = table([
      { h: 'ทะเบียน', nw: 1, k: 'reg' }, { h: 'ชื่อ', k: 'name', cls: 'name' }, { h: 'สาขา', nw: 1, k: 'br' }, { h: 'ประเภท', nw: 1, f: (r) => esc(TY_NAME[r.ty] || r.ty) },
      { h: `ลบ.ม. ${Y0 + 543}`, n: 1, f: (r) => int(r.q0) }, { h: `ลบ.ม. ${Y1 + 543}`, n: 1, f: (r) => int(r.q1) }, { h: 'ผลต่าง', n: 1, f: (r) => int(r.q1 - r.q0) }, { h: '%', n: 1, f: (r) => cmpPill(r.q1, r.q0, '') },
    ], dl);
    const au = (U.audit || []).map(([reg, name, br, status, ty, lb, issue]) => ({ reg, name, br, status, ty, lb, issue })).filter((r) => okBr(r.br));
    $('t-aud').innerHTML = au.length ? table([
      { h: 'ทะเบียน', nw: 1, k: 'reg' }, { h: 'ชื่อ', f: (r) => esc(r.name || '–'), cls: 'name' }, { h: 'สาขา', nw: 1, k: 'br' }, { h: 'สถานะทะเบียน', nw: 1, f: (r) => esc(STATUS_TH[r.status] || r.status) },
      { h: 'บิลล่าสุด', nw: 1, f: (r) => (r.lb ? dLabel(r.lb) : 'ไม่เคยมีบิล') }, { h: 'ข้อสังเกต', f: (r) => `<span class="pill warn">⚠ ${esc(AUDIT[r.issue] || r.issue)}</span>` },
    ], au) : '<div class="state">ไม่พบรายการที่ไม่สอดคล้อง</div>';
    const months = monthsBetween(`${Y0}-01`, lastM);
    const ser = [
      { name: 'รวมทั้งหมด', type: 'line', symbolSize: 6, lineStyle: { width: 2 }, itemStyle: { color: C.navy }, data: months.map((m) => Math.round(qd(m, (r) => r.qa))) },
      { name: 'ไม่รวม กปภ.', type: 'line', symbolSize: 6, lineStyle: { width: 2 }, itemStyle: { color: C.oliveChart }, data: months.map((m) => Math.round(qd(m, (r) => r.qx))) },
      { name: 'ลูกค้าเดิม (ทั่วไป)', type: 'line', symbolSize: 6, lineStyle: { width: 2, type: 'dashed' }, itemStyle: { color: C.text2 }, data: months.map((m) => Math.round(qd(m, (r) => r.qe))) },
    ];
    chart($('ch-qd'), { xAxis: catAxis(months.map(mLabel)), yAxis: valAxis((v) => nf0.format(v)), series: ser, tooltip: { ...chartTT(), axisPointer: { type: 'line' }, formatter: ttMoney('u') } });
    chartTable('c-qd', months.map(mLabel), ser.map((s) => ({ name: s.name, data: s.data })), 'u');
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
      ['กปภ. (T2.2) ไม่มีใบแจ้งหนี้บางเดือน (พ.ค. 69 ไม่มีการส่งน้ำ, สัญญาสิ้นสุดหลัง ก.ค. 69)', S.pwaMissing.length ? S.pwaMissing.map(mLabel).join(', ') : 'ไม่พบ', 'ยอดขายเดือนดังกล่าวลดลงจริง · การเปรียบเทียบ YoY ติดเครื่องหมาย ⚠ เพื่อให้รู้ว่าเปรียบเทียบกับช่วงที่ยังมี กปภ.'],
      ['ลูกค้ารายใหญ่ 3 ราย (กปภ. ทอท. หอถัง อบต.) ก่อน มี.ค. 69 ออกบิลในระบบงานขาย ไม่มีหน่วยน้ำ', 'นำยอดเงินจากใบแจ้งหนี้งานขาย (INT/IMK) มารวมเป็นค่าน้ำ + เติมหน่วยน้ำ (ลบ.ม.) จากไฟล์ตรวจเทียบ Pay2Head 389 ใบ (ยอดเงินตรงกับ WMS ทุกเดือน)', `ใช้ชั่วคราวจนกว่าโปรแกรมเมอร์นำเข้า WMS${S.legAdded.length ? ' · เพิ่มบิลที่ WMS ไม่มี: ' + S.legAdded.map((x) => (x.ty === 'T2.2' ? 'กปภ.' : x.ty) + ' ' + mLabel(x.m) + ' ' + baht(x.amt) + ' บาท').join(', ') : ''}`],
      ['สาขา “นาเตย” ในข้อมูล', 'นาเตยเป็นชื่อสาขาไม้ขาวในระบบเดิม — รวมเข้าสาขาไม้ขาวทุกหน้า', 'ตัวเลขสาขาไม้ขาวครบขึ้น'],
      ['ใบแจ้งหนี้ซ้ำทุกค่า', 'ตัดเหลือ 1 ใบ — ตรงกับไฟล์ตรวจ (ในช่วงรายงานมี 8 แถว 87,605.63 บาท ส่วนใหญ่ 6,300 แถวเป็นปี 2565 อยู่นอกช่วง)', 'ยอดขายไม่นับซ้ำ'],
      ['บิลทดสอบ BL2604210001 (1 บาท) และ BL2604210002 (133.75 บาท)', 'ยังนับอยู่ในข้อมูล (ยอดน้อย ไม่กระทบตัวเลขที่แสดง)', 'รอยกเลิกบิลและปิดทะเบียน AR00C-01859/01860 ในระบบ'],

      ['ส่วนลดในใบแจ้งหนี้ค่าน้ำรวม VAT แต่ VAT ไม่ถูกลดตาม (WMS-307)', 'ยอดขายถอด VAT ออกจากส่วนลดตามสัดส่วน', 'ยอดรวม VAT ใน dashboard อาจต่างจากยอดในใบแจ้งหนี้เล็กน้อย'],
      ['ลูกหนี้คำนวณได้เฉพาะ ณ วันที่ดึงข้อมูล', 'ระบบไม่เก็บประวัติสถานะรายวัน', 'การเลือกวันอ้างอิงย้อนหลังในโหมดสดจะใช้สถานะปัจจุบันของเอกสาร'],
      ['ประเภทลูกค้า สาขา และ DMA ใช้ค่าในทะเบียนปัจจุบัน', 'ไม่ใช่ค่า ณ วันที่ออกบิล', 'ลูกค้าที่ย้ายประเภทจะถูกนับในประเภทใหม่ทั้งช่วง'],
      ['ชื่อบุคคลธรรมดาถูกปิด', 'แสดงชื่อเฉพาะนิติบุคคล หน่วยงาน และลูกค้าประเภท T2.2/T2.3/T3/T3.1', 'ตาม PDPA และข้อกำหนดไม่แสดงข้อมูลส่วนบุคคลเกินจำเป็น'],
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
    ['ยอดขายสุทธิ (ไม่รวม VAT)', 'ค่าน้ำ + ค่าบริการรายเดือน − ส่วนลด (ถอด VAT ตามสัดส่วน) + ใบแจ้งหนี้งานขาย (subtotal) − ใบลดหนี้ (ไม่รวม VAT) · ไม่รวมใบแจ้งหนี้ที่ยกเลิก · ไม่รวมเงินประกัน', 'วันที่ออกเอกสาร'],
    ['ปริมาณน้ำ (ลบ.ม.)', 'รวม = หน่วยในใบแจ้งหนี้ค่าน้ำ · ฟรี = min(หน่วย, สิทธิ์น้ำฟรีในใบ) · คิดเงิน = รวม − ฟรี', 'วันที่ออกใบแจ้งหนี้'],
    ['ยอดรับชำระตามใบเสร็จ', 'ยอดในใบเสร็จค่าน้ำ + ใบเสร็จงานขาย + ใบเสร็จเงินประกัน (รวม VAT) · ภาษีหัก ณ ที่จ่ายแยกแสดง · ยังไม่ได้กระทบยอดธนาคาร จึงไม่เรียกว่าเงินสดรับจริง', 'วันที่รับชำระ (ไม่มีใช้วันที่ใบเสร็จ)'],
    ['สัดส่วนรับชำระต่อยอดแจ้งหนี้', 'รับชำระค่าน้ำในช่วง ÷ ใบแจ้งหนี้ค่าน้ำในช่วง (รวม VAT) — คนละรุ่นเอกสาร ไม่ใช่อัตราเก็บเงิน', 'ช่วงเดือน'],
    ['อัตราเก็บเงินรายรุ่น', 'ยอดใบแจ้งหนี้ค่าน้ำรุ่นเดือน X ที่ชำระแล้ว (ใบเสร็จถึงวันอ้างอิง) ÷ ยอดแจ้งหนี้รุ่นเดียวกัน · ตรงเวลา = ชำระภายในวันครบกำหนด · เฉพาะระบบใหม่ (มี.ค. 69 เป็นต้นไป)', 'เดือนออกใบแจ้งหนี้ + วันอ้างอิง'],
    ['ลูกหนี้คงค้าง / อายุหนี้', 'ใบแจ้งหนี้ค่าน้ำสถานะค้างชำระ ออก ≤ วันอ้างอิง แบ่งช่วง ยังไม่ครบกำหนด / 1–30 / 31–60 / 61–90 / > 90 วันหลังวันครบกำหนด (ไม่ซ้อนกัน รวมกันเท่ายอดคงค้าง) + ใบแจ้งหนี้งานขายค้างชำระ (ไม่มีวันครบกำหนด)', 'วันอ้างอิง'],
    ['ลูกค้าที่ออกใบแจ้งหนี้', 'จำนวนผู้ใช้น้ำที่มีใบแจ้งหนี้ค่าน้ำ (ไม่ยกเลิก) ในเดือน · ลูกค้าใหม่ = ใบแรกในประวัติอยู่ในเดือนนั้น', 'วันที่ออกใบแจ้งหนี้'],
    ['MoM / YoY / YTD', 'เทียบช่วงยาวเท่ากันก่อนหน้า / ช่วงเดียวกันปีก่อน / ม.ค.–เดือนที่เลือก เทียบปีก่อน · ไม่แสดงเมื่อไม่มีข้อมูลฐานหรือเดือนไม่ครบ · ⚠ เมื่อมีเดือนที่ กปภ. ไม่มีใบแจ้งหนี้', 'วันที่ออกเอกสาร'],
    ['เป้ายอดขาย', 'ไม่มีข้อมูลเป้าในระบบ แสดง “ยังไม่กำหนดเป้า”', '–'],
  ];

  // ---------- routing ----------
  function route() {
    const p = (location.hash || '#overview').slice(1);
    if (p === 'fresh') { $('fresh').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' }); history.replaceState(null, '', '#' + S.page); return; }
    S.page = PAGES[p] ? p : 'overview';
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
