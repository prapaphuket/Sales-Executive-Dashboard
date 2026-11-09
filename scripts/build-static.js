// สร้างเว็บ static (สำหรับ GitHub Pages) ที่ข้อมูลเข้ารหัส AES-256-GCM และเปิดได้หลังเข้าสู่ระบบ Microsoft 365
// ใช้: node scripts/build-static.js --key <ไฟล์กุญแจ> [--out site] [--data data]
//   ถ้าไฟล์กุญแจยังไม่มี จะสร้างกุญแจใหม่ (base64 ของ 32 ไบต์) ไว้ที่ path นั้น — ห้ามเก็บไฟล์กุญแจใน Git
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const keyPath = arg('key');
const out = path.resolve(arg('out', path.join(ROOT, 'site')));
const dataDir = path.resolve(arg('data', path.join(ROOT, 'data')));
if (!keyPath) { console.error('ต้องระบุ --key <ไฟล์กุญแจ>'); process.exit(1); }
if (path.resolve(keyPath).startsWith(out)) { console.error('ห้ามเก็บไฟล์กุญแจไว้ในโฟลเดอร์เว็บ'); process.exit(1); }

let keyB64;
if (fs.existsSync(keyPath)) keyB64 = fs.readFileSync(keyPath, 'utf8').replace(/^﻿/, '').trim();
else { keyB64 = crypto.randomBytes(32).toString('base64'); fs.writeFileSync(keyPath, keyB64 + '\n', { mode: 0o600 }); console.log('สร้างกุญแจใหม่:', keyPath); }
const key = Buffer.from(keyB64, 'base64');
if (![16, 24, 32].includes(key.length)) { console.error('ไฟล์กุญแจไม่ถูกต้อง (ต้องเป็น base64 ของ 16/24/32 ไบต์)'); process.exit(1); }

// รวมข้อมูล
const snap = JSON.parse(fs.readFileSync(path.join(dataDir, '_snapshot.json'), 'utf8'));
const names = fs.readdirSync(path.join(ROOT, 'sql')).filter((f) => /^\d\d_.*\.sql$/.test(f)).sort().map((f) => f.replace(/^\d\d_/, '').replace(/\.sql$/, ''));
const ds = {};
for (const n of names) ds[n] = JSON.parse(fs.readFileSync(path.join(dataDir, n + '.json'), 'utf8'));
const bundle = { config: { mode: 'snapshot', asof_default: snap.asof, snapshot: snap, history_months: 24, datasets: names }, ds };

const iv = crypto.randomBytes(12);
const c = crypto.createCipheriv('aes-' + key.length * 8 + '-gcm', key, iv);
const enc = Buffer.concat([c.update(JSON.stringify(bundle), 'utf8'), c.final(), c.getAuthTag()]); // WebCrypto: ciphertext||tag

// คัดลอกไฟล์เว็บ
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, 'public'), out, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'static', 'gate.css'), path.join(out, 'gate.css'));
fs.copyFileSync(path.join(ROOT, 'static', 'auth-config.js'), path.join(out, 'auth-config.js'));
fs.writeFileSync(path.join(out, 'data.enc.js'), '/* ข้อมูลเข้ารหัส AES-GCM — ถอดได้ด้วยกุญแจใน SharePoint เท่านั้น */\nwindow.HEA_ENC = ' + JSON.stringify({ i: iv.toString('base64'), c: enc.toString('base64'), asof: snap.asof, built: new Date().toISOString() }) + ';\n');
fs.writeFileSync(path.join(out, '.nojekyll'), '');

let html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const rep = (a, b) => { if (!html.includes(a)) throw new Error('ไม่พบใน index.html: ' + a); html = html.replace(a, b); };
rep('<meta name="viewport" content="width=device-width, initial-scale=1">', '<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="robots" content="noindex, nofollow">');
rep('<link rel="stylesheet" href="styles.css">', '<link rel="stylesheet" href="styles.css">\n<link rel="stylesheet" href="gate.css">');
rep('<div class="app">', `<div class="lock" id="lock">
  <div class="lock-box">
    <div class="logo-zone"><img class="logo" src="assets/hea-logo-white@2x.png" width="132" height="76" alt="HYDRO ENTERPRISE AND AQUA DESIGN — บริษัท ไฮโดรเอ็นเตอร์ไพร์ส แอนด์ อะควอดีซายน์ จำกัด"></div>
    <form onsubmit="return false">
      <h1>HEA Sales Executive Dashboard</h1>
      <p>ภาพรวมยอดขายและการจัดเก็บธุรกิจน้ำประปา · รายงานภายใน บริษัท ไฮโดรเอ็นเตอร์ไพร์ส แอนด์ อะควอดีซายน์ จำกัด</p>
      <p>เข้าสู่ระบบด้วยบัญชี Microsoft 365 ของบริษัท</p>
      <button class="btn" id="go" type="button" disabled>กำลังตรวจสอบ…</button>
      <button class="btn ghost" id="out" type="button" hidden>ออกจากระบบ / ลองบัญชีอื่น</button>
      <p class="err" id="err" role="alert"></p>
    </form>
  </div>
</div>
<div class="app" id="dash-root" hidden>`);
rep('<div class="side-foot">', '<div class="userbar" id="userbar" hidden><span id="who"></span><button type="button" id="logout">ออกจากระบบ</button></div>\n    <div class="side-foot">');
rep('<script src="app.js"></script>', '<script>window.HEA_STATIC = 1;</script>\n<script src="vendor/msal-browser.min.js"></script>\n<script src="auth-config.js"></script>\n<script src="data.enc.js"></script>\n<script src="app.js"></script>\n<script src="gate.js"></script>');
fs.writeFileSync(path.join(out, 'index.html'), html);
console.log('สร้างเว็บที่', out, '· ข้อมูล ณ', snap.asof, '·', (enc.length / 1024).toFixed(0), 'KB (เข้ารหัส)');
