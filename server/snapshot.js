// สร้าง snapshot จากฐานข้อมูลจริง: node server/snapshot.js [YYYY-MM-DD]
// ใช้ environment variables ชุดเดียวกับ server.js และเขียนไฟล์ลง data/
'use strict';
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const ROOT = path.join(__dirname, '..');
const asof = process.argv[2] || new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const months = Number(process.env.HISTORY_MONTHS || 24);
const d = new Date(asof + 'T00:00:00Z');
const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - months, 1)).toISOString().slice(0, 10);

const pool = new Pool({
  host: process.env.PGHOST, port: Number(process.env.PGPORT || 5432), database: process.env.PGDATABASE,
  user: process.env.PGUSER, password: process.env.PGPASSWORD,
  ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== '0' } : false,
  options: '-c default_transaction_read_only=on -c statement_timeout=120000',
});

(async () => {
  const files = fs.readdirSync(path.join(ROOT, 'sql')).filter((f) => /^\d\d_.*\.sql$/.test(f)).sort();
  for (const f of files) {
    const name = f.replace(/^\d\d_/, '').replace(/\.sql$/, '');
    const sql = fs.readFileSync(path.join(ROOT, 'sql', f), 'utf8');
    const res = name === 'meta' ? await pool.query(sql) : await pool.query(sql, [start, asof]);
    const row = res.rows[0];
    fs.writeFileSync(path.join(ROOT, 'data', name + '.json'), JSON.stringify(row[Object.keys(row)[0]]));
    console.log('ok', name);
  }
  fs.writeFileSync(path.join(ROOT, 'data', '_snapshot.json'), JSON.stringify({ asof, start, fetched_at: new Date().toISOString(), source: 'server/snapshot.js' }, null, 1));
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
