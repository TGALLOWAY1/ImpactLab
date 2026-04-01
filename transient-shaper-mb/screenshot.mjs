import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

// Start Vite dev server
const server = spawn('npx', ['vite', '--port', '5173'], {
  cwd: '/home/user/ImpactLab/transient-shaper-mb',
  stdio: ['ignore', 'pipe', 'pipe'],
});

// Wait for server to be ready
const port = await new Promise((resolve) => {
  server.stdout.on('data', (data) => {
    const match = data.toString().match(/Local:\s+http:\/\/localhost:(\d+)/);
    if (match) resolve(match[1]);
  });
  setTimeout(() => resolve('5173'), 8000);
});

console.log(`Vite server ready on port ${port}`);

// Launch headless Chromium
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1160, height: 800 });
await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle' });

// Wait for canvas waveforms to animate
await sleep(2000);

// Capture screenshot
await page.screenshot({
  path: '/home/user/ImpactLab/transient-shaper-mb/screenshot.png',
  fullPage: false,
});

console.log('Screenshot saved to screenshot.png');

await browser.close();
server.kill();
process.exit(0);
