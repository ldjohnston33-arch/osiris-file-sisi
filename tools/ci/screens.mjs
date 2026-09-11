// CI helper: screenshots of the running app (desktop + phone, drawer open,
// all layers on, Analyst Mode) and any console errors. Output: ci/screens/.
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, devices } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:3000';
await mkdir('ci/screens', { recursive: true });
const logs = [];
const browser = await chromium.launch();
const wait = ms => new Promise(r => setTimeout(r, ms));

async function session(name, ctxOpts, fn) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push({ name, type: m.type(), text: m.text().slice(0, 500) }); });
  page.on('pageerror', e => logs.push({ name, type: 'pageerror', text: String(e).slice(0, 800) }));
  page.on('requestfailed', r => logs.push({ name, type: 'requestfailed', text: `${r.url().slice(0, 200)} ${r.failure()?.errorText}` }));
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await wait(9000);
    await fn(page);
  } catch (e) {
    logs.push({ name, type: 'script', text: String(e).slice(0, 800) });
  }
  await ctx.close();
}

await session('desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, async page => {
  await page.screenshot({ path: 'ci/screens/desktop-top.png' });
  await page.screenshot({ path: 'ci/screens/desktop-full.png', fullPage: true });
  const chips = page.locator('[aria-label="Map layers"] .chip');
  for (let i = 1; i < (await chips.count()); i++) await chips.nth(i).click();
  await wait(2500);
  await page.locator('.map-card').screenshot({ path: 'ci/screens/desktop-map-all-layers.png' });
  const row = page.locator('.status-row:not([disabled])').first();
  if (await row.count()) {
    await row.click();
    await wait(2500);
    const basis = page.getByRole('button', { name: /Show the basis/ });
    if (await basis.count()) await basis.first().click();
    await wait(800);
    await page.screenshot({ path: 'ci/screens/desktop-drawer.png' });
    await page.keyboard.press('Escape');
  }
  // A conflict item, for the linkage block.
  const conflictDot = page.locator('.tl-dot[style*="--dot: #ff4d5e"]').first();
  if (await conflictDot.count()) {
    await conflictDot.scrollIntoViewIfNeeded();
    await conflictDot.click();
    await wait(2500);
    await page.screenshot({ path: 'ci/screens/desktop-drawer-conflict.png' });
    await page.keyboard.press('Escape');
  }
  await page.getByRole('button', { name: /Analyst Mode/ }).click();
  await wait(1500);
  await page.screenshot({ path: 'ci/screens/desktop-analyst-full.png', fullPage: true });
});

await session('phone', { ...devices['iPhone 13'] }, async page => {
  await page.screenshot({ path: 'ci/screens/phone-top.png' });
  await page.screenshot({ path: 'ci/screens/phone-full.png', fullPage: true });
  const row = page.locator('.status-row:not([disabled])').first();
  if (await row.count()) {
    await row.click();
    await wait(2500);
    await page.screenshot({ path: 'ci/screens/phone-drawer.png' });
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  logs.push({ name: 'phone', type: 'metric', text: `horizontal overflow px: ${overflow}` });
});

await browser.close();
await writeFile('ci/screens/console.json', JSON.stringify(logs, null, 2));
console.log(`${logs.length} console/log entries`);
