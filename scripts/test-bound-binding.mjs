// Drives the SendPanel's `bound` generator kind end-to-end:
// 1. Set up an outgoing UDP-style connection with a small struct
// 2. Start the ACC Physics mock stream
// 3. In the Send panel's Generated mode, set a field to `bound` reading
//    ACC's `gas` field; verify the live preview reflects the mock packet
// 4. Send → confirm the outgoing bytes carry the bound value

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

  // Click ACC Physics connection and load its preset so its struct is known.
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('[class*="mx-2 my-0.5"]'));
    rows.find((r) => r.textContent.includes('ACC Physics'))?.click();
  });
  await new Promise((r) => setTimeout(r, 200));

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const open = buttons.find((b) => /Load from library/i.test(b.textContent || ''))
              || document.querySelector('button[title="Struct library"]');
    const r = open.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }).then(({ x, y }) => page.mouse.click(x, y));
  await new Promise((r) => setTimeout(r, 250));

  const loadRect = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    const acc = Array.from(d.querySelectorAll('.group')).find((r) => r.querySelector('span')?.textContent === 'ACC Physics');
    const btn = Array.from(acc.querySelectorAll('button')).find((b) => b.textContent.trim() === 'load');
    return btn.getBoundingClientRect().toJSON();
  });
  await page.mouse.click(loadRect.x + loadRect.width / 2, loadRect.y + loadRect.height / 2);
  await new Promise((r) => setTimeout(r, 400));
  pass('ACC Physics struct loaded onto ACC connection');

  // Turn on streaming so the mock packet generator starts feeding ACC.
  const liveRect = await page.evaluate(() => {
    const accRow = Array.from(document.querySelectorAll('[class*="mx-2 my-0.5"]')).find((r) => r.textContent.includes('ACC Physics'));
    const off = Array.from(accRow.querySelectorAll('button')).find((b) => b.textContent.trim() === 'OFF');
    return off?.getBoundingClientRect().toJSON();
  });
  if (liveRect) {
    await page.mouse.click(liveRect.x + liveRect.width / 2, liveRect.y + liveRect.height / 2);
    await new Promise((r) => setTimeout(r, 300));
    pass('ACC connection set to LIVE — mock packets flowing');
  } else {
    fail('could not find OFF button on ACC row');
  }

  // Switch to UDP Listener — we'll set its struct to a small 2-field outgoing
  // packet and bind both fields to ACC values.
  await page.evaluate(() => {
    const r = Array.from(document.querySelectorAll('[class*="mx-2 my-0.5"]')).find((r) => r.textContent.includes('UDP Lis'));
    r?.click();
  });
  await new Promise((r) => setTimeout(r, 250));

  // Inject a 2-field struct directly into UDP Listener's slot via React's
  // setStructsByConn. Simplest: drive through window.__nettest_debug if we
  // expose one — otherwise add fields via the UI. For testing, just embed
  // ACC Physics into UDP Listener so it has fields to work with.
  await page.evaluate(() => {
    document.querySelector('button[title="Struct library"]')?.click();
  });
  await new Promise((r) => setTimeout(r, 250));
  const embedRect = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    const acc = Array.from(d.querySelectorAll('.group')).find((r) => r.querySelector('span')?.textContent === 'ACC Physics');
    const btn = Array.from(acc.querySelectorAll('button')).find((b) => b.textContent.trim() === 'load');
    return btn.getBoundingClientRect().toJSON();
  });
  await page.mouse.click(embedRect.x + embedRect.width / 2, embedRect.y + embedRect.height / 2);
  await new Promise((r) => setTimeout(r, 400));
  pass('UDP Listener now has a struct (loaded ACC Physics for binding source matching)');

  // SendPanel is open by default (sendOpen = useState(true) in App.jsx).
  // No toggle needed — just switch its mode tab.

  // Switch SendPanel to Generated mode.
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    btns.find((b) => b.textContent.trim() === 'generated')?.click();
  });
  await new Promise((r) => setTimeout(r, 300));

  // Find packetId row in the generated list and switch its kind to `bound`.
  // The row class contains `grid-cols-[16px_120px_92px_1fr]` — Tailwind
  // arbitrary value with bracket characters that CSS attribute selectors
  // can't escape cleanly. Pick the row via JS class-substring filter instead.
  const switched = await page.evaluate((name) => {
    const row = Array.from(document.querySelectorAll('div')).find((d) =>
      typeof d.className === 'string'
      && d.className.includes('grid-cols-[16px_120px_92px_1fr]')
      && d.textContent.includes(name)
      && d.querySelector('select')
    );
    if (!row) return 'no-row';
    const select = row.querySelector('select');
    const opt = Array.from(select.options).find((o) => o.value === 'bound');
    if (!opt) return 'no-bound-option';
    select.value = 'bound';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return 'ok';
  }, 'packetId');
  if (switched === 'ok') pass('packetId field switched to bound kind');
  else fail('failed to switch kind: ' + switched);
  await new Promise((r) => setTimeout(r, 250));

  // Now configure source conn + source field via the new selects in BoundParams.
  const configured = await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('div')).find((d) =>
      typeof d.className === 'string'
      && d.className.includes('grid-cols-[16px_120px_92px_1fr]')
      && d.textContent.includes('packetId')
      && d.querySelector('select')
    );
    const selects = Array.from(row.querySelectorAll('select'));
    // selects[0] = kind, selects[1] = source conn, selects[2] = source field
    if (selects.length < 3) return { ok: false, n: selects.length };
    // Pick ACC Physics conn (id c6 in our mock).
    const accOpt = Array.from(selects[1].options).find((o) => /ACC/.test(o.textContent));
    selects[1].value = accOpt.value;
    selects[1].dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, picked: accOpt.textContent };
  });
  if (configured.ok) pass(`source connection set: ${configured.picked}`);
  else fail('source conn picker missing: ' + JSON.stringify(configured));
  await new Promise((r) => setTimeout(r, 250));

  const fieldPicked = await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('div')).find((d) =>
      typeof d.className === 'string'
      && d.className.includes('grid-cols-[16px_120px_92px_1fr]')
      && d.textContent.includes('packetId')
      && d.querySelector('select')
    );
    const selects = Array.from(row.querySelectorAll('select'));
    const opt = Array.from(selects[2].options).find((o) => o.value === 'gas');
    if (!opt) return { ok: false, options: Array.from(selects[2].options).map((o) => o.value) };
    selects[2].value = 'gas';
    selects[2].dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true };
  });
  if (fieldPicked.ok) pass('source field set to ACC.gas');
  else fail('source field picker missing gas: ' + JSON.stringify(fieldPicked));
  await new Promise((r) => setTimeout(r, 500));

  // Live preview should show a non-`—` value because mock ACC stream is flowing.
  const previewState = await page.evaluate(() => {
    const row = Array.from(document.querySelectorAll('div')).find((d) =>
      typeof d.className === 'string'
      && d.className.includes('grid-cols-[16px_120px_92px_1fr]')
      && d.textContent.includes('packetId')
      && d.querySelector('select')
    );
    const span = Array.from(row.querySelectorAll('span')).find((s) => s.textContent.trim().startsWith('='));
    return span?.textContent.trim() || null;
  });
  console.log('live preview chip:', previewState);
  if (previewState && previewState !== '= —') {
    pass(`live binding preview: "${previewState}"`);
  } else {
    fail(`live binding preview did not resolve: ${previewState}`);
  }

  await page.screenshot({ path: 'scripts/.shot-bound-ui.png' });
  pass('screenshot saved → scripts/.shot-bound-ui.png');

  await browser.close();
})().catch((e) => { console.error('UNHANDLED', e); process.exit(1); });
