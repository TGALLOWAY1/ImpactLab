import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

const server = spawn('npx', ['vite', '--port', '5173'], {
  cwd: '/home/user/ImpactLab/transient-shaper-mb',
  stdio: ['ignore', 'pipe', 'pipe'],
});

const port = await new Promise((resolve) => {
  server.stdout.on('data', (data) => {
    const match = data.toString().match(/Local:\s+http:\/\/localhost:(\d+)/);
    if (match) resolve(match[1]);
  });
  setTimeout(() => resolve('5173'), 8000);
});

console.log(`Vite server ready on port ${port}`);

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });

page.on('console', (msg) => console.log(`[browser ${msg.type()}]`, msg.text()));
page.on('pageerror', (err) => console.error('[browser error]', err.message));

await page.goto(`http://localhost:${port}/#/explainer`, { waitUntil: 'networkidle' });

// Wait for pre-render to finish (status text changes to "Ready")
const maxWaitMs = 60000;
const start = Date.now();
while (Date.now() - start < maxWaitMs) {
  const status = await page.evaluate(() => {
    const el = document.querySelector('div[style*="opacity"]');
    return el ? el.textContent : '';
  });
  if (status && status.includes('Ready')) break;
  await sleep(400);
}

await sleep(300);

// Screenshot scene 1 (intro) — should show row 1 only
await page.screenshot({
  path: '/home/user/ImpactLab/transient-shaper-mb/explainer-s1-intro.png',
  fullPage: false,
});

// Click Play
const playBtn = await page.getByRole('button', { name: 'Play' });
await playBtn.click();

// Scene boundaries (cumulative from scenes.js): 6, 12, 21, 30, 39, 48, 56
// Seek-and-screenshot by waiting: reveal-detector at ~9s, attack-up mid at ~17s
await sleep(9000); // ~9s in = reveal-detector scene
await page.screenshot({
  path: '/home/user/ImpactLab/transient-shaper-mb/explainer-s2-detector.png',
  fullPage: false,
});

await sleep(9000); // ~18s = attack-up scene
await page.screenshot({
  path: '/home/user/ImpactLab/transient-shaper-mb/explainer-s3-attackup.png',
  fullPage: false,
});

await sleep(18000); // ~36s = sustain-up
await page.screenshot({
  path: '/home/user/ImpactLab/transient-shaper-mb/explainer-s5-sustainup.png',
  fullPage: false,
});

console.log('Screenshots saved');

await browser.close();
server.kill();
process.exit(0);
