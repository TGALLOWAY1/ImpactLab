// Captures the /#/explainer finale frame (attack + sustain both engaged),
// then composes an annotated PNG suitable for a LinkedIn post.
//
// Output:
//   explainer-annotated.png  — 1280×900, raw canvas + SVG callouts + caption
//
// Usage:  node screenshot-explainer-annotated.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import { readFileSync } from 'fs';

const APP_DIR = '/home/user/ImpactLab/transient-shaper-mb';

// --- 1) Launch Vite ---------------------------------------------------------
const server = spawn('npx', ['vite', '--port', '5173'], {
  cwd: APP_DIR,
  stdio: ['ignore', 'pipe', 'pipe'],
});
const port = await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('Vite did not start within 30s')), 30_000);
  server.stdout.on('data', (data) => {
    const m = data.toString().match(/Local:\s+http:\/\/localhost:(\d+)/);
    if (m) { clearTimeout(t); resolve(m[1]); }
  });
  server.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`));
});
console.log(`Vite ready on port ${port}`);
// Extra settle time so the server is actually accepting TCP.
await sleep(1500);

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 900 });
page.on('console', (msg) => console.log(`[browser ${msg.type()}]`, msg.text()));
page.on('pageerror', (err) => console.error('[browser error]', err.message));

await page.goto(`http://localhost:${port}/#/explainer`, { waitUntil: 'networkidle' });

// --- 2) Wait for pre-render ("Ready") --------------------------------------
const maxWaitMs = 90_000;
const start = Date.now();
while (Date.now() - start < maxWaitMs) {
  const status = await page.evaluate(() => {
    const el = document.querySelector('div[style*="opacity"]');
    return el ? el.textContent : '';
  });
  if (status && status.includes('Ready')) break;
  await sleep(400);
}
console.log('Pre-render complete');

// --- 3) Play, wait until we're inside the finale scene ---------------------
// Scene timeline (cumulative): intro 6s, detector 12s, attack-up 21s,
// attack-down 30s, sustain-up 39s, sustain-down 48s, finale 56s.
// 51s puts us 3s into the finale (attack=50, sustain=35): both colors visible.
const FINALE_T = 51_000;
await page.getByRole('button', { name: 'Play' }).click();
console.log(`Playing to t=${FINALE_T / 1000}s (finale scene)...`);
await sleep(FINALE_T);

// --- 4) Grab the raw canvas pixels as a PNG data URL -----------------------
const dataUrl = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return c.toDataURL('image/png');
});
// Stop playback to be tidy
try {
  await page.getByRole('button', { name: 'Stop' }).click();
} catch {}
console.log('Captured finale frame');

// --- 5) Build annotated composition in a fresh page ------------------------
const composePage = await browser.newPage();
await composePage.setViewportSize({ width: 1280, height: 900 });

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; background: #07090E; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .stage { width: 1280px; height: 900px; position: relative; overflow: hidden; background: #07090E; }
  .frame { position: absolute; left: 0; top: 0; width: 1280px; height: 720px; }
  .frame img { display: block; width: 1280px; height: 720px; }
  svg.overlay { position: absolute; left: 0; top: 0; width: 1280px; height: 720px; pointer-events: none; }
  .caption {
    position: absolute; left: 0; top: 720px; width: 1280px; height: 180px;
    display: flex; flex-direction: column; justify-content: center; align-items: center;
    color: #E6EAF2; text-align: center;
  }
  .caption .kicker {
    font-size: 13px; letter-spacing: 3px; color: #5BC0EB; font-weight: 700; margin-bottom: 10px;
  }
  .caption .title {
    font-size: 34px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 10px;
  }
  .caption .title .grn { color: #5ECA89; }
  .caption .title .ylw { color: #F5C84B; }
  .caption .sub {
    font-size: 16px; color: rgba(230,234,242,0.72); font-weight: 500; max-width: 1100px; line-height: 1.5;
  }
  .caption .stack { font-size: 12px; color: rgba(230,234,242,0.45); margin-top: 12px; letter-spacing: 1px; }
  /* Callout label pill style */
  .tag { font-weight: 700; fill: #0B0E14; }
</style></head>
<body>
<div class="stage">
  <div class="frame"><img id="src" src="${dataUrl}" /></div>

  <svg class="overlay" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <marker id="arrow-blue" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#5BC0EB"/>
      </marker>
      <marker id="arrow-green" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#5ECA89"/>
      </marker>
      <marker id="arrow-yellow" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#F5C84B"/>
      </marker>
      <marker id="arrow-pink" viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" fill="#EA6AA6"/>
      </marker>
    </defs>

    <!-- ============================================================ -->
    <!-- Row 1 callout: INPUT (blue) — parked on right side to avoid -->
    <!-- covering the first drum hit's transient on the left edge.    -->
    <!-- ============================================================ -->
    <g>
      <rect x="936" y="92" width="318" height="46" rx="6" fill="#5BC0EB" opacity="0.95"/>
      <text x="950" y="114" font-size="14" font-weight="800" fill="#0B0E14">1 &nbsp; INPUT SIGNAL</text>
      <text x="950" y="131" font-size="11" font-weight="600" fill="#0B0E14" opacity="0.9">Raw drum loop — untouched</text>
      <path d="M 950 120 Q 760 150 560 155" stroke="#5BC0EB" stroke-width="2.5"
            fill="none" marker-end="url(#arrow-blue)" opacity="0.9"/>
    </g>

    <!-- ============================================================ -->
    <!-- Row 2 callout: DETECT (green) — arrow into a triangle marker -->
    <!-- Row 2 panel approx y=272..450                                -->
    <!-- ============================================================ -->
    <g>
      <rect x="36" y="284" width="336" height="46" rx="6" fill="#5ECA89" opacity="0.95"/>
      <text x="50" y="306" font-size="14" font-weight="800" fill="#0B0E14">2 &nbsp; TRANSIENT DETECTION</text>
      <text x="50" y="323" font-size="11" font-weight="600" fill="#0B0E14" opacity="0.9">Dual-envelope detector flags each onset ▼</text>
      <!-- Arrow pointing up-left toward the first triangle marker in row 2 -->
      <path d="M 60 286 Q 40 270 24 262" stroke="#5ECA89" stroke-width="2.5"
            fill="none" marker-end="url(#arrow-green)" opacity="0.9"/>
    </g>

    <!-- ============================================================ -->
    <!-- Row 3 callout A: ATTACK tint (green) -->
    <!-- Row 3 panel approx y=466..644                                -->
    <!-- ============================================================ -->
    <g>
      <rect x="36" y="478" width="324" height="46" rx="6" fill="#5ECA89" opacity="0.95"/>
      <text x="50" y="500" font-size="14" font-weight="800" fill="#0B0E14">3a &nbsp; GREEN = ATTACK BOOST</text>
      <text x="50" y="517" font-size="11" font-weight="600" fill="#0B0E14" opacity="0.9">First milliseconds of every hit → punchier</text>
      <!-- Arrow landing on the green-tinted onset of the third big hit (~x≈655) -->
      <path d="M 340 524 Q 490 540 640 500" stroke="#5ECA89" stroke-width="2.5"
            fill="none" marker-end="url(#arrow-green)" opacity="0.9"/>
    </g>

    <!-- Row 3 callout B: SUSTAIN tint (yellow) -->
    <g>
      <rect x="896" y="478" width="358" height="46" rx="6" fill="#F5C84B" opacity="0.95"/>
      <text x="910" y="500" font-size="14" font-weight="800" fill="#0B0E14">3b &nbsp; YELLOW = SUSTAIN BOOST</text>
      <text x="910" y="517" font-size="11" font-weight="600" fill="#0B0E14" opacity="0.9">Body &amp; tail of each hit → more ring &amp; weight</text>
      <!-- Arrow landing inside the body/tail of the hit at ~0:02 (x≈720..780) -->
      <path d="M 900 524 Q 830 545 760 535" stroke="#F5C84B" stroke-width="2.5"
            fill="none" marker-end="url(#arrow-yellow)" opacity="0.9"/>
    </g>

    <!-- Playhead emphasis (thin glow) -->
  </svg>

  <div class="caption">
    <div class="kicker">IMPACTLAB · TRANSIENT SHAPER MB</div>
    <div class="title">
      <span class="grn">Attack</span> and <span class="ylw">Sustain</span>, visualized — in the browser.
    </div>
    <div class="sub">
      A per-band dual-envelope detector tags every onset, then gain-shapes the attack window and sustain tail independently.
      No mockup — this is a real AudioWorklet DSP pipeline running on a drum loop, pre-rendered offline and played back frame-accurate.
    </div>
    <div class="stack">REACT · WEB AUDIO · AUDIOWORKLET · CANVAS · PROTOTYPE FOR A JUCE PLUGIN</div>
  </div>
</div>
<script>
  // Signal when the embedded image has decoded so the screenshot waits.
  (async () => {
    const img = document.getElementById('src');
    if (!img.complete) await new Promise(r => img.onload = r);
    document.body.setAttribute('data-ready', '1');
  })();
</script>
</body></html>`;

await composePage.setContent(html, { waitUntil: 'domcontentloaded' });
await composePage.waitForSelector('body[data-ready="1"]');

await composePage.screenshot({
  path: `${APP_DIR}/explainer-annotated.png`,
  clip: { x: 0, y: 0, width: 1280, height: 900 },
});
console.log('Wrote explainer-annotated.png');

// Also emit the raw (un-annotated) frame for reference
const rawPngBase64 = dataUrl.replace(/^data:image\/png;base64,/, '');
const { writeFileSync } = await import('fs');
writeFileSync(`${APP_DIR}/explainer-finale-raw.png`, Buffer.from(rawPngBase64, 'base64'));
console.log('Wrote explainer-finale-raw.png');

await browser.close();
server.kill();
process.exit(0);
