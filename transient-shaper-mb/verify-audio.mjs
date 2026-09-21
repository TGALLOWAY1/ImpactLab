import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const ROOT = dirname(fileURLToPath(import.meta.url));


const FIXTURE = process.env.VERIFY_AUDIO || `${ROOT}/fixtures/impulse-loop.wav`;
const server = spawn('npx', ['vite', '--port', '5175'], { cwd: ROOT, stdio: ['ignore','pipe','pipe'] });
const port = await new Promise((r) => {
  server.stdout.on('data', (d) => { const m = d.toString().match(/localhost:(\d+)/); if (m) r(m[1]); });
  setTimeout(() => r('5175'), 8000);
});

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream'],
});
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle' });
await sleep(1000);

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { ok ? (pass++, console.log(`  PASS  ${n}`)) : (fail++, console.log(`  FAIL  ${n} ${d}`)); };

console.log('\n=== Audio engine regression ===');
await page.locator('button[aria-label="Start the audio engine"]').click();
await sleep(1500);
check('engine started (power button flips to pressed)',
  await page.locator('button[aria-pressed="true"][aria-label="Audio engine running"]').count() === 1);

await page.locator('input[type="file"]').setInputFiles(FIXTURE);
await sleep(2000);
check('file loaded (transport appears)', await page.locator('button:has-text("Play")').count() === 1);

await page.locator('button:has-text("Play")').click();
await sleep(2500);
check('playing', await page.locator('button:has-text("Stop")').count() === 1);

// The real-time SAB path writes per-band peaks; sample the canvases for non-background pixels.
const painted = await page.evaluate(() => [...document.querySelectorAll('canvas')].map((c) => {
  const ctx = c.getContext('2d');
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let lit = 0;
  for (let i = 0; i < d.length; i += 4 * 97) {
    if (d[i] > 40 || d[i+1] > 40 || d[i+2] > 60) lit++;
  }
  return lit;
}));
check(`all 5 band canvases are drawing real signal [${painted}]`, painted.every((n) => n > 20));

const meterMoved = await page.evaluate(() => {
  const el = document.querySelector('[data-meter-fill]');
  return getComputedStyle(el).clipPath;
});
check(`IN meter is reading level (clip-path ${meterMoved})`, !meterMoved.includes('100%'));

// Delta lane
await page.locator('button:has-text("Delta")').click();
await sleep(1200);
check('delta toggle engaged', (await page.locator('button:has-text("Delta")').getAttribute('aria-pressed')) === 'true');
check('canvases still drawing with delta on',
  (await page.evaluate(() => { const c = document.querySelector('canvas'); const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let n=0; for (let i=0;i<d.length;i+=4*97) if (d[i]>40||d[i+1]>40||d[i+2]>60) n++; return n; })) > 20);
await page.locator('button:has-text("Delta")').click();

// Solo / bypass
await page.locator('button[aria-label="Solo Low band"]').click();
await sleep(400);
check('solo dims the other strips',
  await page.evaluate(() => getComputedStyle(document.querySelectorAll('section[aria-label]')[0]).opacity === '0.65'));
await page.locator('button[aria-label="Solo Low band"]').click();

// Export
await page.locator('button:has-text("Save")').click();
const dl = await page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
check('export produced a WAV download', dl !== null && /\.wav$/i.test(dl?.suggestedFilename() ?? ''));

console.log('\n=== Scaled viewport: canvases stay correctly sized ===');
await page.setViewportSize({ width: 1100, height: 720 });
await sleep(1500);
const sized = await page.evaluate(() => {
  const scale = parseFloat(getComputedStyle(document.querySelector('[class*="viewport"]')).getPropertyValue('--plugin-scale'));
  return [...document.querySelectorAll('canvas')].map((c) => {
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    return { okW: Math.abs(c.width - Math.round(r.width * dpr)) <= 1, okH: Math.abs(c.height - Math.round(r.height * dpr)) <= 1, scale };
  });
});
check(`backing store tracks the transformed rect at scale ${sized[0].scale.toFixed(3)}`, sized.every((s) => s.okW && s.okH));

const realErrors = errors.filter((e) => !/favicon|AudioContext was not allowed/i.test(e));
check(`no runtime errors (${realErrors.length})`, realErrors.length === 0, realErrors.slice(0, 5).join(' | '));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
await browser.close(); server.kill();
process.exit(fail > 0 ? 1 : 0);
