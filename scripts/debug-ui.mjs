// Drives the renderer in a real browser via puppeteer-core + the chromium
// that playwright already downloaded. Run after `npm run dev` so vite is up
// on :5173. Mock harness lives at /debug.html.

import puppeteer from 'puppeteer-core';
import os from 'node:os';
import path from 'node:path';

const CHROMIUM = path.join(
  os.homedir(),
  'AppData', 'Local', 'ms-playwright', 'chromium-1223', 'chrome-win64', 'chrome.exe',
);

const URL = 'http://localhost:5173/debug.html';

const fail = (msg) => { console.error('✗ ' + msg); process.exitCode = 1; };
const pass = (msg) => console.log('✓ ' + msg);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    headless: 'new',
    args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage();
    page.on('pageerror', (err) => console.error('[pageerror]', err.message));
    page.on('console', (m) => {
      if (m.type() === 'error') console.error('[console error]', m.text());
    });

    await page.setViewport({ width: 1480, height: 900 });
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 800));

    // 1. Did the app render at all?
    const connCount = await page.$$eval('[class*="mx-2 my-0.5"]', (els) => els.length);
    if (connCount >= 3) pass(`connection sidebar shows ${connCount} rows`);
    else fail(`expected ≥3 connection rows, got ${connCount}`);

    // 2. Click the ACC Physics connection.
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('[class*="mx-2 my-0.5"]'));
      const acc = rows.find((r) => r.textContent.includes('ACC Physics'));
      if (acc) acc.click();
    });
    await new Promise((r) => setTimeout(r, 300));

    // 3. Open the struct library (doc icon, top-right of parser panel).
    const opened = await page.evaluate(() => {
      // The library button is the last `<button title="Struct library">` in the
      // parser panel header. Plain title search works.
      const btn = document.querySelector('button[title="Struct library"]');
      if (!btn) return 'no-button';
      btn.click();
      return 'clicked';
    });
    if (opened === 'clicked') pass('clicked Struct library button');
    else fail('Struct library button not found: ' + opened);
    await new Promise((r) => setTimeout(r, 300));

    // 4. Find the library menu and verify ACC Physics row + load button.
    const presetInfo = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return { ok: false, reason: 'no-dialog' };
      const rows = Array.from(dialog.querySelectorAll('.group'));
      const accRow = rows.find((r) => r.querySelector('span')?.textContent === 'ACC Physics');
      if (!accRow) return { ok: false, reason: 'no-acc-row', rowCount: rows.length };
      const loadBtn = Array.from(accRow.querySelectorAll('button')).find((b) => b.textContent.trim() === 'load');
      if (!loadBtn) return { ok: false, reason: 'no-load-btn', rowHTML: accRow.outerHTML.slice(0, 400) };
      const computed = window.getComputedStyle(loadBtn);
      return {
        ok: true,
        opacity: computed.opacity,
        display: computed.display,
        visibility: computed.visibility,
        rect: loadBtn.getBoundingClientRect().toJSON(),
        text: loadBtn.textContent.trim(),
      };
    });
    console.log('load button info:', JSON.stringify(presetInfo, null, 2));
    if (presetInfo.ok) {
      if (parseFloat(presetInfo.opacity) >= 0.99) pass('load button is visible (opacity=' + presetInfo.opacity + ')');
      else fail('load button still hidden (opacity=' + presetInfo.opacity + ')');
    }

    // 5. Click the load button and verify the parser panel filled in.
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const rows = Array.from(dialog.querySelectorAll('.group'));
      const accRow = rows.find((r) => r.querySelector('span')?.textContent === 'ACC Physics');
      const loadBtn = Array.from(accRow.querySelectorAll('button')).find((b) => b.textContent.trim() === 'load');
      loadBtn.click();
    });
    await new Promise((r) => setTimeout(r, 500));

    // Count fields rendered in parser panel — every field row has the dot
    // marker class `field-dot-*`.
    const fieldCount = await page.$$eval('[class*="field-dot-"]', (els) => els.length);
    if (fieldCount >= 70) pass(`parser panel shows ${fieldCount} fields after load`);
    else fail(`parser panel only has ${fieldCount} fields after load (expected ~80)`);

    // 6. Spot-check a field name to confirm we got the ACC preset.
    const hasPacketId = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('span'))
        .some((s) => s.textContent === 'packetId');
    });
    if (hasPacketId) pass('packetId field present');
    else fail('packetId field missing');

    // 7. Comment input in the property panel — click the `packetId` row in
    //    the parser tree, then look specifically at the textarea inside the
    //    property panel (not SendPanel's raw input which has its own textarea).
    await page.evaluate(() => {
      // Find the row whose name span says exactly "packetId".
      const labels = Array.from(document.querySelectorAll('span'));
      const pk = labels.find((s) => s.textContent === 'packetId');
      if (pk) pk.closest('.grid')?.click();
    });
    await new Promise((r) => setTimeout(r, 300));
    const commentInfo = await page.evaluate(() => {
      // Property panel is the section bordering on the bottom with
      // `border-t border-zinc-200 bg-zinc-50/60`. Search there.
      const panels = Array.from(document.querySelectorAll('[class*="border-t"][class*="border-zinc-200"]'));
      for (const p of panels) {
        const ta = p.querySelector('textarea');
        if (ta && ta.placeholder?.includes('What this field means')) {
          return { ok: true, value: ta.value, placeholder: ta.placeholder };
        }
      }
      return { ok: false, panelCount: panels.length };
    });
    const expected = 'physics tick counter';
    if (commentInfo.ok && commentInfo.value?.includes(expected)) {
      pass(`comment textarea shows packetId's note: "${commentInfo.value.slice(0, 60)}…"`);
    } else {
      fail('comment textarea did not show expected note: ' + JSON.stringify(commentInfo));
    }

    // 8. LIVE toggle — click and verify status changes.
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const liveBtn = btns.find((b) => b.textContent.trim() === 'OFF');
      if (liveBtn) liveBtn.click();
    });
    await new Promise((r) => setTimeout(r, 400));
    const isLive = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).some((b) => b.textContent.trim() === 'LIVE')
    );
    if (isLive) pass('LIVE toggle flips OFF → LIVE');
    else fail('LIVE toggle did not flip');

    // 9. With LIVE on the ACC connection, mock packets should arrive and
    //    packetId should be > 0 in the parser panel.
    await new Promise((r) => setTimeout(r, 600));
    const packetIdValue = await page.evaluate(() => {
      // Find the row containing "packetId" and grab its value chip.
      const labels = Array.from(document.querySelectorAll('span'));
      const pkLabel = labels.find((s) => s.textContent === 'packetId');
      if (!pkLabel) return null;
      const row = pkLabel.closest('.grid');
      if (!row) return null;
      const valueDiv = row.querySelector('.mono');
      return valueDiv ? valueDiv.textContent.trim() : null;
    });
    if (packetIdValue && packetIdValue !== '—' && packetIdValue !== '0') {
      pass(`packetId is live decoding: ${packetIdValue}`);
    } else {
      fail(`packetId value not updating: ${packetIdValue}`);
    }

    // 10. REC toggle.
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const recBtns = btns.filter((b) => b.textContent.trim() === 'REC');
      // Click the REC on the ACC row — first one whose closest selected row
      // contains "ACC Physics".
      const accRec = recBtns.find((b) => {
        const row = b.closest('[class*="mx-2 my-0.5"]');
        return row && row.textContent.includes('ACC Physics');
      });
      if (accRec) accRec.click();
    });
    await new Promise((r) => setTimeout(r, 300));
    const recOn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const acc = btns.find((b) =>
        b.textContent.trim() === 'REC' &&
        b.closest('[class*="mx-2 my-0.5"]')?.textContent.includes('ACC Physics') &&
        b.className.includes('rose-50')
      );
      return !!acc;
    });
    if (recOn) pass('REC toggle flips to rose-50 styling on click');
    else fail('REC toggle did not flip');

    // Screenshots — full app + close-up of the library menu post-load.
    await page.screenshot({ path: 'scripts/.debug-after-load.png', fullPage: false });
    pass('screenshot saved → scripts/.debug-after-load.png');

    console.log('\nDone.');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error('UNHANDLED', e);
  process.exit(1);
});
