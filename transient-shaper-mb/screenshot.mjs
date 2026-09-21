import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

const ROOT = '/home/user/ImpactLab/transient-shaper-mb';

// The plugin is authored at 1400x860 and PluginShell scales it to fit.
// The primary capture uses a viewport large enough for scale to land at 1.0,
// so styling diffs stay pixel-comparable. The previous 1160x800 viewport was
// SMALLER than the plugin, which is why every committed screenshot was clipped.
const CAPTURES = [
  { name: 'screenshot.png', width: 1440, height: 900, label: 'full size (scale 1.0)' },
  { name: 'screenshot-scaled.png', width: 1100, height: 720, label: 'scaled down (regression for PluginShell)' },
];

const server = spawn('npx', ['vite', '--port', '5173'], {
  cwd: ROOT,
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

const browser = await chromium.launch();
const page = await browser.newPage();

for (const capture of CAPTURES) {
  await page.setViewportSize({ width: capture.width, height: capture.height });
  await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle' });

  // Let the canvas waveforms animate a little before capturing.
  await sleep(2000);

  // SharedArrayBuffer is required for the real-time per-band visualisation.
  // If a cross-origin subresource ever sneaks into index.html, COEP blocks it
  // and this silently flips to false — so assert it on every capture.
  const isolated = await page.evaluate(() => window.crossOriginIsolated);
  if (!isolated) {
    console.warn('  WARNING: crossOriginIsolated is false — SharedArrayBuffer is unavailable.');
  }

  await page.screenshot({ path: `${ROOT}/${capture.name}`, fullPage: false });
  console.log(`Saved ${capture.name} — ${capture.width}x${capture.height}, ${capture.label}`);
}

await browser.close();
server.kill();
process.exit(0);
