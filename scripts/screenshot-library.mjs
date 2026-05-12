import puppeteer from 'puppeteer-core';
import os from 'node:os';
import path from 'node:path';

const CHROMIUM = path.join(
  os.homedir(),
  'AppData', 'Local', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe',
);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    headless: 'new',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1480, height: 900 });
  await page.goto('http://localhost:5173/debug.html', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));

  // Click the ACC Physics connection in the sidebar.
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('[class*="mx-2 my-0.5"]'));
    const acc = rows.find((r) => r.textContent.includes('ACC Physics'));
    acc?.click();
  });
  await new Promise((r) => setTimeout(r, 200));

  // Screenshot 1: "no fields" placeholder visible on the right + struct lib closed.
  await page.screenshot({ path: 'scripts/.shot-1-empty.png' });
  console.log('saved scripts/.shot-1-empty.png — empty state (No fields defined)');

  // Click the library button (doc icon, top right of parser panel).
  await page.evaluate(() => {
    document.querySelector('button[title="Struct library"]')?.click();
  });
  await new Promise((r) => setTimeout(r, 250));

  // Screenshot 2: library menu open with ACC Physics row + load button visible.
  await page.screenshot({ path: 'scripts/.shot-2-library-open.png' });
  console.log('saved scripts/.shot-2-library-open.png — library menu open');

  // Click the load button on the ACC Physics row.
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const rows = Array.from(dialog.querySelectorAll('.group'));
    const accRow = rows.find((r) => r.querySelector('span')?.textContent === 'ACC Physics');
    const loadBtn = Array.from(accRow.querySelectorAll('button')).find((b) => b.textContent.trim() === 'load');
    loadBtn?.click();
  });
  await new Promise((r) => setTimeout(r, 500));

  // Screenshot 3: parser panel full of ACC fields.
  await page.screenshot({ path: 'scripts/.shot-3-loaded.png' });
  console.log('saved scripts/.shot-3-loaded.png — ACC fields loaded');

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
