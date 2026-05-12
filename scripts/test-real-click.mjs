// Real-mouse-click coverage for the library menu: load, embed, and
// click-outside-to-close. This is the regression test for the global
// `mousedown` listener vs. menu-internal click bug.

import puppeteer from 'puppeteer-core';
import os from 'node:os';
import path from 'node:path';

const CHROMIUM = path.join(
  os.homedir(),
  'AppData', 'Local', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe',
);

const fail = (m) => { console.error('✗ ' + m); process.exitCode = 1; };
const pass = (m) => console.log('✓ ' + m);

async function openLibrary(page) {
  const r = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => /Load from library/i.test(b.textContent || ''))
             || document.querySelector('button[title="Struct library"]');
    return btn?.getBoundingClientRect().toJSON();
  });
  if (!r) throw new Error('no library opener button');
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await new Promise((r) => setTimeout(r, 250));
}

async function rectOfPresetButton(page, presetName, btnText) {
  return page.evaluate(({ presetName, btnText }) => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    const rows = Array.from(d.querySelectorAll('.group'));
    const row = rows.find((r) => r.querySelector('span')?.textContent === presetName);
    if (!row) return null;
    const btn = Array.from(row.querySelectorAll('button')).find((b) => b.textContent.trim() === btnText);
    return btn?.getBoundingClientRect().toJSON();
  }, { presetName, btnText });
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM, headless: 'new', args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.setViewport({ width: 1480, height: 900 });
  await page.goto('http://localhost:5173/debug.html', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));

  // Select ACC Physics connection.
  const acc = await page.evaluate(() => {
    const r = Array.from(document.querySelectorAll('[class*="mx-2 my-0.5"]')).find((x) => x.textContent.includes('ACC Physics'));
    return r?.getBoundingClientRect().toJSON();
  });
  await page.mouse.click(acc.x + acc.width / 2, acc.y + 30);
  await new Promise((r) => setTimeout(r, 200));

  // --- TEST 1: REAL load click ---
  await openLibrary(page);
  let r = await rectOfPresetButton(page, 'ACC Physics', 'load');
  if (!r) { fail('load button rect not found'); }
  else {
    await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
    await new Promise((r) => setTimeout(r, 400));
    const n = await page.$$eval('[class*="field-dot-"]', (els) => els.length);
    if (n >= 70) pass(`real-mouse load: ${n} fields loaded`);
    else fail(`real-mouse load: only ${n} fields`);
  }

  // --- TEST 2: REAL embed click (append on top of the just-loaded preset) ---
  await openLibrary(page);
  r = await rectOfPresetButton(page, 'ACC Physics', 'embed');
  if (!r) { fail('embed button rect not found'); }
  else {
    const before = await page.$$eval('[class*="field-dot-"]', (els) => els.length);
    await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
    await new Promise((r) => setTimeout(r, 400));
    const after = await page.$$eval('[class*="field-dot-"]', (els) => els.length);
    if (after > before) pass(`real-mouse embed: ${before} → ${after} fields appended`);
    else fail(`real-mouse embed: ${before} → ${after} (no change)`);
  }

  // --- TEST 3: click OUTSIDE should still close the menu ---
  await openLibrary(page);
  const openState = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
  if (!openState) fail('library not actually open');
  // Click way out — hex viewer empty area, center of the screen.
  await page.mouse.click(600, 400);
  await new Promise((r) => setTimeout(r, 250));
  const closedState = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
  if (!closedState) pass('click outside still closes the menu');
  else fail('click outside no longer closes the menu (over-fixed)');

  await page.screenshot({ path: 'scripts/.shot-fix-verified.png' });
  console.log('\nsaved scripts/.shot-fix-verified.png');

  await browser.close();
})().catch((e) => { console.error('UNHANDLED', e); process.exit(1); });
