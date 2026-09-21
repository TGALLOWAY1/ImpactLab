/**
 * Capture the baseline screen set required by /product/snapshots/README.md.
 * Run from transient-shaper-mb/:  node capture-snapshots.mjs
 */
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(ROOT, '..', 'product', 'snapshots');
const DATE = new Date().toISOString().slice(0, 10);
const FIXTURE = process.env.SNAPSHOT_AUDIO || `${ROOT}/fixtures/impulse-loop.wav`;

const server = spawn('npx', ['vite', '--port', '5176'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
const port = await new Promise((r) => {
  server.stdout.on('data', (d) => { const m = d.toString().match(/localhost:(\d+)/); if (m) r(m[1]); });
  setTimeout(() => r('5176'), 8000);
});

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${DATE}_${name}.png`, fullPage: false });
  console.log(`  ${DATE}_${name}.png`);
};

await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle' });
await sleep(1500);
await shot('main_default');

await page.setViewportSize({ width: 1100, height: 720 });
await sleep(1200);
await shot('main_scaled-viewport');
await page.setViewportSize({ width: 1440, height: 900 });
await sleep(800);

await page.locator('button[aria-label="Start the audio engine"]').click();
await sleep(1200);
await page.locator('input[type="file"]').setInputFiles(FIXTURE);
await sleep(1800);
await page.locator('button:has-text("Play")').click();
await sleep(2500);
await shot('main_playback');

await page.locator('button[aria-label="Solo Low band"]').click();
await page.locator('button[aria-label="Bypass High band"]').click();
await sleep(1200);
await shot('main_solo-bypass');
await page.locator('button[aria-label="Solo Low band"]').click();
await page.locator('button[aria-label="Bypass High band"]').click();

// Keyboard focus is a first-class state now, so it gets a capture of its own.
// Driven by real Tab presses: a programmatic .focus() does not reliably satisfy
// the browser's :focus-visible heuristic after prior mouse input.
await page.evaluate(() => document.activeElement?.blur());
for (let i = 0; i < 40; i++) {
  await page.keyboard.press('Tab');
  const onKnob = await page.evaluate(
    () => document.activeElement?.getAttribute('aria-label') === 'Sub band Attack amount',
  );
  if (onKnob) break;
}
await sleep(400);
await shot('main_keyboard-focus');

await page.goto(`http://localhost:${port}/#/explainer`, { waitUntil: 'networkidle' });
await sleep(1500);
await shot('explainer_start');
const play = page.locator('button:has-text("Play")');
if (await play.count()) {
  await play.first().click();
  await sleep(4000);
  await shot('explainer_mid-scene');
}

await browser.close();
server.kill();
process.exit(0);
