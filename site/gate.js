/* HEA Sales Executive Dashboard — ประตูเข้าสู่ระบบ Microsoft 365 (ใช้เฉพาะเว็บ static เช่น GitHub Pages)
   ลำดับ: เข้าสู่ระบบ Entra ID -> ตรวจ tenant + กลุ่ม -> ดึงไฟล์กุญแจจาก SharePoint ด้วยสิทธิ์ของผู้ใช้ (Graph)
          -> ถอดรหัสข้อมูล (AES-256-GCM) ในเบราว์เซอร์ -> เปิด dashboard
   ไฟล์ข้อมูลบน Git เป็นข้อมูลเข้ารหัส ผู้ที่ไม่มีสิทธิ์อ่านไฟล์กุญแจใน SharePoint เปิดไม่ได้ */
'use strict';
(function () {
  const AUTH = window.HEA_AUTH || {};
  const SCOPES = ['User.Read', 'Files.Read.All'];
  const ENC = window.HEA_ENC;
  const $ = (id) => document.getElementById(id);
  const go = $('go'), out = $('out'), err = $('err');
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const ready = () => { go.disabled = false; go.textContent = 'เข้าสู่ระบบด้วย Microsoft 365'; };
  const busy = (t) => { go.disabled = true; go.textContent = t; err.textContent = ''; };
  const fail = (t, app) => { err.textContent = t; ready(); if (app) { out.hidden = false; out.onclick = () => app.logoutRedirect(); } };

  if (!window.msal) { fail('โหลดระบบเข้าสู่ระบบ Microsoft ไม่ได้ ลองรีเฟรชหน้า'); go.disabled = true; return; }
  if (!window.crypto || !crypto.subtle) { fail('เบราว์เซอร์นี้เปิดรายงานไม่ได้ ลองเปิดด้วย Edge, Chrome หรือ Safari'); go.disabled = true; return; }
  if (!ENC || !AUTH.clientId || !AUTH.tenantId || !AUTH.keyShareUrl) { fail('ยังตั้งค่าเว็บไม่ครบ (auth-config.js / data.enc.js) — ติดต่อฝ่าย IT'); go.disabled = true; return; }

  const redirectUri = AUTH.redirectUri || (location.origin + location.pathname.replace(/index\.html$/, ''));
  const app = new msal.PublicClientApplication({
    auth: { clientId: AUTH.clientId, authority: 'https://login.microsoftonline.com/' + AUTH.tenantId, redirectUri },
    cache: { cacheLocation: 'sessionStorage' },
  });
  const login = () => app.loginRedirect({ scopes: SCOPES, prompt: 'select_account' });
  const shareId = (u) => 'u!' + btoa(unescape(encodeURIComponent(u))).replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');

  async function token(account) {
    try { return (await app.acquireTokenSilent({ scopes: SCOPES, account })).accessToken; }
    catch (e) { if (e instanceof msal.InteractionRequiredAuthError) { await app.acquireTokenRedirect({ scopes: SCOPES, account }); return null; } throw e; }
  }
  async function fetchKey(tok) {
    const base = 'https://graph.microsoft.com/v1.0/shares/' + shareId(AUTH.keyShareUrl) + '/driveItem';
    const H = { headers: { Authorization: 'Bearer ' + tok } };
    const r = await fetch(base, H);
    if (r.status === 401 || r.status === 403 || r.status === 404) throw new Error('nokey');
    if (!r.ok) throw new Error('graph ' + r.status);
    const item = await r.json();
    let txt = null;
    const dl = item['@microsoft.graph.downloadUrl'] || item['@content.downloadUrl'];
    if (dl) { try { const k = await fetch(dl); if (k.ok) txt = await k.text(); } catch (e) { /* ลองวิธีถัดไป */ } }
    if (txt === null && item.id && item.parentReference && item.parentReference.driveId) {
      const k = await fetch('https://graph.microsoft.com/v1.0/drives/' + item.parentReference.driveId + '/items/' + item.id + '/content', H);
      if (k.ok) txt = await k.text();
    }
    if (txt === null) { const k = await fetch(base + '/content', H); if (!k.ok) throw new Error('download ' + k.status); txt = await k.text(); }
    return txt.replace(/^﻿/, '').trim();
  }
  async function open(account) {
    const c = account.idTokenClaims || {};
    if (c.tid && c.tid !== AUTH.tenantId) return fail('บัญชีนี้ไม่ได้อยู่ในองค์กร', app);
    if (AUTH.groupId) {
      if (c._claim_names && c._claim_names.groups) return fail('บัญชีนี้อยู่ในหลายกลุ่มเกินกว่าที่ระบบตรวจได้ — ติดต่อฝ่าย IT', app);
      if (!(c.groups || []).includes(AUTH.groupId)) return fail('บัญชีนี้ยังไม่มีสิทธิ์ดูรายงาน (ต้องอยู่ในกลุ่ม ' + (AUTH.groupName || AUTH.groupId) + ') — ติดต่อฝ่าย IT', app);
    }
    busy('กำลังเปิดรายงาน…');
    try {
      const tok = await token(account); if (!tok) return;
      const raw = await fetchKey(tok);
      const key = await crypto.subtle.importKey('raw', b64(raw), 'AES-GCM', false, ['decrypt']);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(ENC.i) }, key, b64(ENC.c));
      const bundle = JSON.parse(new TextDecoder().decode(plain));
      $('lock').hidden = true;
      $('dash-root').hidden = false;
      $('who').textContent = account.name || account.username || '';
      $('userbar').hidden = false;
      $('logout').title = 'ผู้ใช้: ' + (account.name || account.username || '') + ' · คลิกเพื่อออกจากระบบ';
      $('logout').onclick = () => app.logoutRedirect({ account });
      window.HEADash.start(bundle);
    } catch (x) {
      console.error(x);
      fail(x && x.message === 'nokey' ? 'บัญชีนี้ยังไม่ได้รับสิทธิ์อ่านไฟล์กุญแจใน SharePoint — ติดต่อฝ่าย IT'
        : x && x.name === 'OperationError' ? 'ไฟล์กุญแจใน SharePoint ไม่ตรงกับข้อมูลชุดนี้ — ติดต่อฝ่าย IT'
        : 'เปิดรายงานไม่สำเร็จ (' + ((x && (x.errorCode || x.message)) || 'ไม่ทราบสาเหตุ') + ') ลองรีเฟรชหน้า', app);
    }
  }
  (async () => {
    try {
      await app.initialize();
      const resp = await app.handleRedirectPromise();
      const account = (resp && resp.account) || app.getAllAccounts()[0];
      go.onclick = login;
      if (account) { app.setActiveAccount(account); await open(account); } else ready();
    } catch (x) { console.error(x); go.onclick = login; fail('เข้าสู่ระบบไม่สำเร็จ (' + (x.errorCode || x.message) + ')'); }
  })();
})();
