// ถ่ายภาพหน้าจอทุกหน้า: node scripts/screens.js http://localhost:8080 out_dir [scale]
const { chromium } = require('playwright');
(async () => {
  const [base, out, scale] = [process.argv[2] || 'http://localhost:8080', process.argv[3] || 'screenshots', Number(process.argv[4] || 1)];
  const fs = require('fs'); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: scale });
  const errs = []; p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
  const pages = ['overview', 'sales', 'customers', 'collections', 'quality'];
  for (const [i, pg] of pages.entries()) {
    await p.goto(base + '/#' + pg); await p.waitForTimeout(1500);
    if (i === 0) await p.reload(), await p.waitForTimeout(1500);
    await p.screenshot({ path: `${out}/${i + 1}_${pg}.png`, fullPage: true });
  }
  // drill-down + tablet
  await p.goto(base + '/#collections'); await p.waitForTimeout(1200);
  await p.click('#t-debt tr.click'); await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/6_drilldown_debtor.png` });
  await p.keyboard.press('Escape');
  await p.selectOption('#f-br', 'สาคู'); await p.waitForTimeout(800);
  await p.goto(base + '/#overview'); await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/7_filter_sakhu.png`, fullPage: true });
  await p.selectOption('#f-br', ''); 
  const t = await b.newPage({ viewport: { width: 1024, height: 1366 }, deviceScaleFactor: scale });
  await t.goto(base + '/#overview'); await t.waitForTimeout(1500);
  await t.screenshot({ path: `${out}/8_tablet_overview.png`, fullPage: true });
  console.log(JSON.stringify(errs));
  await b.close();
})();
