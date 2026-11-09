// สร้างไฟล์นำเสนอแยก (HTML ไฟล์เดียว เปิดได้ออฟไลน์) จากตัวเลขชุดเดียวกับหน้า Executive Snapshot
// ใช้: node scripts/build-present.js <snapdata.json> <out.html>
//   snapdata.json ได้จาก window.HEASnap ในหน้า #snapshot ของ dashboard (scripts/screens.js หรือ console)
'use strict';
const fs = require('fs'), path = require('path');
const [src, out] = process.argv.slice(2);
const ROOT = path.join(__dirname, '..');
const fdir = path.join(ROOT, 'scripts', 'present-fonts');
const font = (w, sub, range) => `@font-face{font-family:'Plex Thai';font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${fs.readFileSync(path.join(fdir, `ibm-plex-sans-thai-${sub}-${w}-normal.woff2`)).toString('base64')}) format('woff2');unicode-range:${range};}`;
const TH = 'U+0E01-0E5B,U+200C-200D,U+25CC', LA = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+25B2,U+25BC,U+25CF,U+FEFF';
const fonts = [400, 600].map((w) => font(w, 'thai', TH) + font(w, 'latin', LA)).join('\n');
let html = fs.readFileSync(path.join(ROOT, 'scripts', 'present-template.html'), 'utf8');
html = html.replace('/*__FONTS__*/', fonts).replace('/*__DATA__*/null', fs.readFileSync(src, 'utf8').replace(/</g, '\\u003c'));
fs.writeFileSync(out, html);
console.log('เขียน', out, (html.length / 1024).toFixed(0), 'KB');
