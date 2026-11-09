// HEA Sales Executive Dashboard — backend
// โหมด LIVE: อ่านฐานข้อมูล WMS (PostgreSQL) แบบอ่านอย่างเดียวผ่าน environment variables
// โหมด SNAPSHOT: อ่านไฟล์ data/*.json ที่ดึงไว้ (ระบุชัดบนหน้าจอว่าเป็นข้อมูลชุดคงที่)
'use strict';
const fs = require('fs');
const path = require('path');
const express = require('express');

const ROOT = path.join(__dirname, '..');
const SQL_DIR = path.join(ROOT, 'sql');
const DATA_DIR = process.env.SNAPSHOT_DIR || path.join(ROOT, 'data');
const PORT = Number(process.env.PORT || 8080);
const SNAPSHOT = process.env.SNAPSHOT === '1' || !process.env.PGHOST;
const CACHE_TTL = Number(process.env.CACHE_TTL_SECONDS || 600) * 1000;
const HISTORY_MONTHS = Number(process.env.HISTORY_MONTHS || 24);

// ชุดข้อมูล -> ไฟล์ SQL (ทุกไฟล์รับ $1 = วันแรกของช่วง, $2 = วันอ้างอิง ยกเว้น meta)
const DATASETS = {
  sales_cube: '01_sales_cube.sql',
  dma_monthly: '02_dma_monthly.sql',
  customers: '03_customers.sql',
  top_customers: '04_top_customers.sql',
  declines: '05_declines.sql',
  collections: '06_collections.sql',
  cohort: '07_cohort.sql',
  ar: '08_ar.sql',
  debtors: '09_debtors.sql',
  drill_top: '10_drill_top.sql',
  quality: '11_quality.sql',
  meta: '12_meta.sql',
  revenue_groups: '13_revenue_groups.sql',
  pipeline: '15_pipeline.sql',
  usage_compare: '14_usage_compare.sql',
};
const NO_PARAMS = new Set(['meta']);
// ข้อมูลเสริมที่ไม่ได้อยู่ในฐานข้อมูล (ไฟล์ใน data/) — ใช้ทั้งโหมดสดและ snapshot
const FILE_DATASETS = { legacy_units: 'legacy_units.json' };

let pool = null;
if (!SNAPSHOT) {
  const { Pool } = require('pg');
  pool = new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== '0' } : false,
    max: 4,
    application_name: 'hea-sales-dashboard',
    // ทุก session เป็น read-only และมีเพดานเวลา
    options: `-c default_transaction_read_only=on -c statement_timeout=${Number(process.env.STATEMENT_TIMEOUT_MS || 60000)}`,
  });
}

const cache = new Map();
const isoDate = (d) => d.toISOString().slice(0, 10);
function todayBangkok() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}
function rangeFor(asof) {
  const d = new Date(asof + 'T00:00:00Z');
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - HISTORY_MONTHS, 1));
  return [isoDate(start), asof];
}

async function runDataset(name, asof) {
  const sql = fs.readFileSync(path.join(SQL_DIR, DATASETS[name]), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const res = NO_PARAMS.has(name) ? await client.query(sql) : await client.query(sql, rangeFor(asof));
    await client.query('COMMIT');
    const row = res.rows[0];
    return row[Object.keys(row)[0]];
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

function readSnapshot(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name + '.json'), 'utf8'));
}
function snapshotInfo() {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, '_snapshot.json'), 'utf8')); } catch { return {}; }
}

const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'");
  next();
});

app.get('/api/config', (req, res) => {
  const snap = SNAPSHOT ? snapshotInfo() : {};
  res.json({
    mode: SNAPSHOT ? 'snapshot' : 'live',
    asof_default: SNAPSHOT ? snap.asof : todayBangkok(),
    snapshot: SNAPSHOT ? snap : null,
    history_months: HISTORY_MONTHS,
    datasets: Object.keys(DATASETS).concat(Object.keys(FILE_DATASETS)),
  });
});

app.get('/api/ds/:name', async (req, res) => {
  const name = req.params.name;
  if (FILE_DATASETS[name]) {
    try { return res.json({ data: JSON.parse(fs.readFileSync(path.join(DATA_DIR, FILE_DATASETS[name]), 'utf8')), mode: SNAPSHOT ? 'snapshot' : 'live' }); }
    catch (e) { return res.json({ data: null }); }
  }
  if (!DATASETS[name]) return res.status(404).json({ error: 'ไม่มีชุดข้อมูลนี้' });
  try {
    if (SNAPSHOT) {
      const info = snapshotInfo();
      return res.json({ data: readSnapshot(name), fetched_at: info.fetched_at || null, asof: info.asof || null, mode: 'snapshot' });
    }
    let asof = String(req.query.asof || todayBangkok());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asof) || isNaN(Date.parse(asof))) return res.status(400).json({ error: 'รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)' });
    if (asof > todayBangkok()) asof = todayBangkok();
    const key = name + '|' + asof;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.t < CACHE_TTL && req.query.refresh !== '1') return res.json(hit.body);
    const data = await runDataset(name, asof);
    const body = { data, fetched_at: new Date().toISOString(), asof, mode: 'live' };
    cache.set(key, { t: Date.now(), body });
    res.json(body);
  } catch (e) {
    console.error(`[${name}]`, e.message);
    res.status(500).json({ error: 'ดึงข้อมูลไม่สำเร็จ', detail: e.message });
  }
});

app.use(express.static(path.join(ROOT, 'public'), { maxAge: '1h' }));

app.listen(PORT, () => {
  console.log(`HEA Sales Executive Dashboard: http://localhost:${PORT}  mode=${SNAPSHOT ? 'SNAPSHOT (' + DATA_DIR + ')' : 'LIVE'}`);
});
