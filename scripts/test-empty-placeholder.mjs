// Verifies the path: empty parser → click the BIG "Load from library" button
// inside EmptyStructPlaceholder → menu opens → click load on ACC Physics.
// Distinct from the doc-icon header-button path the prior test used.

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
    executablePath: CHROMIUM, headless: 'new', args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.error('[console]', m.text());
  });
  await page.setViewport({ width: 1480, height: 900 });
  await page.goto('http://localhost:5173/debug.html', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));

  // Pick ACC Physics so the parser panel is empty (fresh: no struct bound).
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('[class*="mx-2 my-0.5"]'));
    rows.find((r) => r.textContent.includes('ACC Physics'))?.click();
  });
  await new Promise((r) => setTimeout(r, 250));

  // Locate the BIG button by its exact label text.
  const big = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const target = buttons.find((b) => /Load from library/i.test(b.textContent || ''));
    if (!target) return { found: false };
    const cs = window.getComputedStyle(target);
    return {
      found: true,
      text: target.textContent.trim(),
      opacity: cs.opacity,
      visibility: cs.visibility,
      pointerEvents: cs.pointerEvents,
      rect: target.getBoundingClientRect().toJSON(),
      onclickWired: typeof target.onclick === 'function' || target.hasAttribute('onclick'),
    };
  });
  console.log('big button info:', JSON.stringify(big, null, 2));
  if (!big.found) { fail('big "Load from library" button NOT in DOM'); await browser.close(); return; }

  await page.screenshot({ path: 'scripts/.shot-placeholder-before.png' });
  console.log('saved scripts/.shot-placeholder-before.png');

  // CLICK THE BIG BUTTON.
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button'))
      .find((b) => /Load from library/i.test(b.textContent || ''))
      ?.click();
  });
  await new Promise((r) => setTimeout(r, 300));

  // Did the library menu open?
  const dialogOpen = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return d ? { open: true, height: d.getBoundingClientRect().height } : { open: false };
  });
  if (dialogOpen.open) pass(`menu opened (height ${dialogOpen.height}px)`);
  else fail('menu did NOT open after clicking the big button');

  await page.screenshot({ path: 'scripts/.shot-placeholder-after-bigclick.png' });
  console.log('saved scripts/.shot-placeholder-after-bigclick.png');

  // Click load on ACC Physics row.
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const rows = Array.from(dialog.querySelectorAll('.group'));
    const acc = rows.find((r) => r.querySelector('span')?.textContent === 'ACC Physics');
    Array.from(acc.querySelectorAll('button')).find((b) => b.textContent.trim() === 'load')?.click();
  });
  await new Promise((r) => setTimeout(r, 400));

  const finalCount = await page.$$eval('[class*="field-dot-"]', (els) => els.length);
  if (finalCount >= 70) pass(`parser panel now shows ${finalCount} field dots`);
  else fail(`expected ≥70 field dots, got ${finalCount}`);

  await page.screenshot({ path: 'scripts/.shot-placeholder-final.png' });
  console.log('saved scripts/.shot-placeholder-final.png');

  await browser.close();
})().catch((e) => { console.error('UNHANDLED', e); process.exit(1); });
