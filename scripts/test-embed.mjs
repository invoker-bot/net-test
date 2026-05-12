// Specifically exercises the `embed` button in the struct library — appends
// preset fields onto whatever's already in the parser. Run while vite is
// serving debug.html on :5173.

import puppeteer from 'puppeteer-core';
import os from 'node:os';
import path from 'node:path';

const CHROMIUM = path.join(
  os.homedir(),
  'AppData', 'Local', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe',
);

const fail = (m) => { console.error('✗ ' + m); process.exitCode = 1; };
const pass = (m) => console.log('✓ ' + m);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.error('[console]', m.text());
  });
  await page.setViewport({ width: 1480, height: 900 });
  await page.goto('http://localhost:5173/debug.html', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));

  // Select ACC Physics connection.
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('[class*="mx-2 my-0.5"]'));
    rows.find((r) => r.textContent.includes('ACC Physics'))?.click();
  });
  await new Promise((r) => setTimeout(r, 200));

  const fieldCountBefore = await page.$$eval('[class*="field-dot-"]', (els) => els.length);
  pass(`fields before any action: ${fieldCountBefore}`);

  // Open library.
  await page.evaluate(() => document.querySelector('button[title="Struct library"]')?.click());
  await new Promise((r) => setTimeout(r, 250));

  // Inspect embed button state on each preset row.
  const buttons = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return { dialog: false };
    const rows = Array.from(dialog.querySelectorAll('.group'));
    return {
      dialog: true,
      rows: rows.map((r) => {
        const nameEl = r.querySelector('span');
        const btns = Array.from(r.querySelectorAll('button'));
        return {
          name: nameEl?.textContent || '',
          buttons: btns.map((b) => {
            const cs = window.getComputedStyle(b);
            return {
              text: b.textContent.trim(),
              opacity: cs.opacity,
              visibility: cs.visibility,
              pointerEvents: cs.pointerEvents,
              rect: b.getBoundingClientRect().toJSON(),
            };
          }),
        };
      }),
    };
  });
  console.log('library row buttons:\n' + JSON.stringify(buttons, null, 2));

  // Click `embed` on ACC Physics.
  const clickResult = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const rows = Array.from(dialog.querySelectorAll('.group'));
    const accRow = rows.find((r) => r.querySelector('span')?.textContent === 'ACC Physics');
    if (!accRow) return 'no-acc-row';
    const embedBtn = Array.from(accRow.querySelectorAll('button')).find((b) => b.textContent.trim() === 'embed');
    if (!embedBtn) return 'no-embed-btn';
    embedBtn.click();
    return 'clicked';
  });
  if (clickResult === 'clicked') pass('clicked embed on ACC Physics');
  else fail('embed click failed: ' + clickResult);
  await new Promise((r) => setTimeout(r, 500));

  const fieldCountAfter = await page.$$eval('[class*="field-dot-"]', (els) => els.length);
  if (fieldCountAfter > fieldCountBefore) {
    pass(`embed appended fields: ${fieldCountBefore} → ${fieldCountAfter}`);
  } else {
    fail(`embed had no effect: still ${fieldCountAfter} fields`);
  }

  // Embed again should DOUBLE the field count (or close to it).
  await page.evaluate(() => document.querySelector('button[title="Struct library"]')?.click());
  await new Promise((r) => setTimeout(r, 200));
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const rows = Array.from(dialog.querySelectorAll('.group'));
    const accRow = rows.find((r) => r.querySelector('span')?.textContent === 'ACC Physics');
    const embedBtn = Array.from(accRow.querySelectorAll('button')).find((b) => b.textContent.trim() === 'embed');
    embedBtn.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  const fieldCountTwice = await page.$$eval('[class*="field-dot-"]', (els) => els.length);
  if (fieldCountTwice > fieldCountAfter) {
    pass(`second embed appended again: ${fieldCountAfter} → ${fieldCountTwice}`);
  } else {
    fail(`second embed had no effect: still ${fieldCountTwice}`);
  }

  await page.screenshot({ path: 'scripts/.shot-embed.png' });
  console.log('\nsaved scripts/.shot-embed.png');

  await browser.close();
})().catch((e) => { console.error('UNHANDLED', e); process.exit(1); });
