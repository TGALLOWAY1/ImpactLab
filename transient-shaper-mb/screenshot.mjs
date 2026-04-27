import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Synthesize a short drum loop (kicks on 1&3, snares on 2&4, hats on 8ths).
// Saved to a temp WAV so we can upload it via Playwright's setInputFiles
// instead of relying on outbound network access.
function generateDrumLoopWav() {
  const sampleRate = 44100;
  const bpm = 120;
  const beatsPerBar = 4;
  const numBars = 2;
  const totalBeats = beatsPerBar * numBars;
  const beatDur = 60 / bpm;
  const numSamples = Math.floor(sampleRate * totalBeats * beatDur);
  const samples = new Float32Array(numSamples);

  const kick = (start) => {
    const len = Math.floor(0.22 * sampleRate);
    for (let i = 0; i < len && start + i < numSamples; i++) {
      const t = i / sampleRate;
      const freq = 150 * Math.exp(-30 * t) + 45;
      const env = Math.exp(-12 * t);
      samples[start + i] += Math.sin(2 * Math.PI * freq * t) * env * 0.95;
    }
  };

  const snare = (start) => {
    const len = Math.floor(0.18 * sampleRate);
    for (let i = 0; i < len && start + i < numSamples; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-18 * t);
      const noise = (Math.random() * 2 - 1) * 0.6;
      const tone = Math.sin(2 * Math.PI * 220 * t) * 0.25;
      samples[start + i] += (noise + tone) * env * 0.7;
    }
  };

  const hihat = (start, accent = false) => {
    const len = Math.floor(0.05 * sampleRate);
    let prev = 0;
    for (let i = 0; i < len && start + i < numSamples; i++) {
      const t = i / sampleRate;
      const env = Math.exp(-90 * t);
      const noise = Math.random() * 2 - 1;
      const hp = noise - prev * 0.6;
      prev = noise;
      samples[start + i] += hp * env * (accent ? 0.35 : 0.18);
    }
  };

  const beatSample = (b) => Math.floor(b * beatDur * sampleRate);
  for (let bar = 0; bar < numBars; bar++) {
    const base = bar * beatsPerBar;
    kick(beatSample(base + 0));
    kick(beatSample(base + 2));
    snare(beatSample(base + 1));
    snare(beatSample(base + 3));
    for (let i = 0; i < beatsPerBar * 2; i++) {
      hihat(beatSample(base + i / 2), i % 2 === 0);
    }
  }

  let peak = 0;
  for (let i = 0; i < numSamples; i++) {
    const a = Math.abs(samples[i]);
    if (a > peak) peak = a;
  }
  const gain = peak > 0 ? 0.95 / peak : 1;

  const numChannels = 1;
  const bitDepth = 16;
  const dataSize = numSamples * numChannels * (bitDepth / 8);
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * numChannels * (bitDepth / 8), 28);
  buf.writeUInt16LE(numChannels * (bitDepth / 8), 32);
  buf.writeUInt16LE(bitDepth, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] * gain));
    const intSample = s < 0 ? s * 0x8000 : s * 0x7FFF;
    buf.writeInt16LE(intSample, 44 + i * 2);
  }
  return buf;
}

const drumLoopPath = join(tmpdir(), 'impactlab-drum-loop.wav');
writeFileSync(drumLoopPath, generateDrumLoopWav());
console.log(`Generated drum loop at ${drumLoopPath}`);

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

// Launch headless Chromium with autoplay enabled so AudioContext can start
// from a programmatic click without a real user gesture.
const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('PAGE ERR:', msg.text());
});
await page.setViewportSize({ width: 1160, height: 800 });
await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle' });

// The dev page centers the 1160x800 plugin chrome inside a flex body, which
// causes the chrome to overflow viewport edges if a scrollbar gets reserved.
// Pin the chrome to the top-left so screenshots line up cleanly.
await page.addStyleTag({
  content: `body { display: block !important; margin: 0 !important; padding: 0 !important; min-height: 0 !important; overflow: hidden !important; }`,
});

// Initialize the audio engine. The plugin chrome is centered via
// flex on body which Playwright's viewport check sometimes refuses to
// click through, so dispatch the click via evaluate.
await page.locator('button[title="Initialize audio engine"]').evaluate((el) => el.click());
await page.locator('button[title="Audio engine running"]').waitFor({ timeout: 8000 });

// Upload the synthesized drum loop directly into the hidden file input
await page.locator('input[type="file"][accept="audio/*"]').setInputFiles(drumLoopPath);

// Wait for the file to decode and the Play button to appear
await page.locator('button:has-text("Play")').waitFor({ timeout: 8000 });

// Start playback
await page.locator('button:has-text("Play")').evaluate((el) => el.click());
await page.locator('button:has-text("Stop")').waitFor({ timeout: 4000 });

// Let the worklet run long enough to populate per-band waveforms
await sleep(3000);

// Capture screenshot
await page.screenshot({
  path: '/home/user/ImpactLab/transient-shaper-mb/screenshot.png',
  fullPage: false,
});

console.log('Screenshot saved to screenshot.png');

await browser.close();
server.kill();
process.exit(0);
