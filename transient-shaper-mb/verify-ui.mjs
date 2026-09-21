import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const ROOT = dirname(fileURLToPath(import.meta.url));


const server = spawn('npx', ['vite', '--port', '5174'], { cwd: ROOT, stdio: ['ignore','pipe','pipe'] });
const port = await new Promise((r) => {
  server.stdout.on('data', (d) => { const m = d.toString().match(/localhost:(\d+)/); if (m) r(m[1]); });
  setTimeout(() => r('5174'), 8000);
});

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle' });
await sleep(1200);

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${detail}`); }
};

console.log('\n=== 1. Cross-origin isolation (SharedArrayBuffer path) ===');
check('crossOriginIsolated', await page.evaluate(() => window.crossOriginIsolated));
check('SharedArrayBuffer available', await page.evaluate(() => typeof SharedAheadCheck === 'undefined' && typeof SharedArrayBuffer === 'function'));

console.log('\n=== 2. ARIA coverage ===');
const aria = await page.evaluate(() => {
  const sliders = [...document.querySelectorAll('[role="slider"]')];
  return {
    sliders: sliders.length,
    allLabelled: sliders.every((s) => s.getAttribute('aria-label')),
    allValueText: sliders.every((s) => s.getAttribute('aria-valuetext')),
    allTabbable: sliders.every((s) => s.tabIndex === 0),
    allOriented: sliders.every((s) => s.getAttribute('aria-orientation')),
    radiogroups: document.querySelectorAll('[role="radiogroup"]').length,
    radios: document.querySelectorAll('[role="radio"]').length,
    canvasesLabelled: [...document.querySelectorAll('canvas')].every((c) => c.getAttribute('aria-label')),
    canvases: document.querySelectorAll('canvas').length,
    sections: document.querySelectorAll('section[aria-label]').length,
    inlineOutlineNone: document.body.innerHTML.includes('outline: none'),
  };
});
// 5 bands x (attack, attackTime, sustain, sustainTime, mix, gain) = 30, + 4 crossover, + input/output/mix = 37
check(`37 slider controls exposed (found ${aria.sliders})`, aria.sliders === 37);
check('every slider has aria-label', aria.allLabelled);
check('every slider has aria-valuetext', aria.allValueText);
check('every slider is tabbable', aria.allTabbable);
check('every slider states aria-orientation', aria.allOriented);
check(`2 radiogroups, 7 radios (found ${aria.radiogroups}/${aria.radios})`, aria.radiogroups === 2 && aria.radios === 7);
check(`all ${aria.canvases} canvases labelled`, aria.canvasesLabelled && aria.canvases === 5);
check(`5 band landmarks (found ${aria.sections})`, aria.sections >= 5);

console.log('\n=== 3. Keyboard contract on a band Attack knob ===');
const knob = page.locator('[aria-label="Sub band Attack amount"]');
await knob.focus();
const read = () => knob.evaluate((el) => ({ now: +el.getAttribute('aria-valuenow'), text: el.getAttribute('aria-valuetext') }));
check('focused', await knob.evaluate((el) => el === document.activeElement));
check('focus ring visible', await knob.evaluate((el) => el.matches(':focus-visible')));

await page.keyboard.press('ArrowUp');
let v = await read(); check(`ArrowUp steps +1 (${v.now})`, v.now === 1);
await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
v = await read(); check(`ArrowDown steps -1 (${v.now})`, v.now === -1);
await page.keyboard.press('PageUp');
v = await read(); check(`PageUp steps +10 (${v.now})`, v.now === 9);
await page.keyboard.press('End');
v = await read(); check(`End -> max (${v.now}, "${v.text}")`, v.now === 100 && v.text === '+100%');
await page.keyboard.press('Home');
v = await read(); check(`Home -> min (${v.now}, "${v.text}")`, v.now === -100 && v.text === '-100%');
await page.keyboard.press('Backspace');
v = await read(); check(`Backspace -> default (${v.now})`, v.now === 0);
await page.keyboard.down('Shift'); await page.keyboard.press('ArrowUp'); await page.keyboard.up('Shift');
v = await read(); check(`Shift+Arrow fine-steps (${v.now})`, v.now > 0 && v.now < 1);
await page.keyboard.press('Backspace');

const scrollY = await page.evaluate(() => window.scrollY);
check('arrow keys did not scroll the page', scrollY === 0);

console.log('\n=== 4. aria-valuetext reports milliseconds, not the raw 0-100 scalar ===');
const timeKnob = page.locator('[aria-label="Sub band Attack time"]');
let t = await timeKnob.evaluate((el) => ({ now: +el.getAttribute('aria-valuenow'), text: el.getAttribute('aria-valuetext') }));
check(`Sub attack time: valuenow=${t.now}, valuetext="${t.text}"`, t.now === 50 && t.text === '5.00 ms');
const highTime = page.locator('[aria-label="High band Attack time"]');
t = await highTime.evaluate((el) => el.getAttribute('aria-valuetext'));
check(`High band base attack time differs ("${t}")`, t === '0.20 ms');
await timeKnob.focus(); await page.keyboard.press('End');
t = await timeKnob.evaluate((el) => el.getAttribute('aria-valuetext'));
check(`max attackTime = 4x base ("${t}")`, t === '20.0 ms');
await page.keyboard.press('Backspace');

console.log('\n=== 5. Multiband link + key repeat: no float drift ===');
await page.locator('input[type="checkbox"]').check();
const attack = page.locator('[aria-label="Low band Attack amount"]');
await attack.focus();
for (let i = 0; i < 25; i++) await page.keyboard.press('ArrowUp');
const linked = await page.evaluate(() => [...document.querySelectorAll('[aria-label$="band Attack amount"]')]
  .map((el) => +el.getAttribute('aria-valuenow')));
check(`all 5 bands tracked in lockstep: [${linked}]`, linked.every((n) => n === 25));
check('no float dust', linked.every((n) => Number.isInteger(n)));

// Merged from the DSP-correctness branch: link fans a change out to the OTHER
// bands, so the band you are actually holding must follow the knob even when it
// is bypassed. Bypass mutes a band's processing; it should not freeze its UI.
await page.locator('[aria-label="High band Attack amount"]').focus();
await page.keyboard.press('Backspace');
await page.locator('button[aria-label="Bypass High band"]').click();
const highKnob = page.locator('[aria-label="High band Attack amount"]');
await highKnob.focus();
for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowUp');
const highVal = await highKnob.evaluate((el) => +el.getAttribute('aria-valuenow'));
check(`a bypassed band still follows its own knob under link (${highVal})`, highVal === 5);
await page.locator('button[aria-label="Bypass High band"]').click();

await page.locator('input[type="checkbox"]').uncheck();
await attack.focus(); await page.keyboard.press('Backspace');

console.log('\n=== 6. Crossover handle: log mapping + truthful neighbour bounds ===');
const xo = page.locator('[aria-label="Crossover 1"]');
let x = await xo.evaluate((el) => ({
  now: +el.getAttribute('aria-valuenow'),
  text: el.getAttribute('aria-valuetext'),
  min: +el.getAttribute('aria-valuemin'),
  max: +el.getAttribute('aria-valuemax'),
}));
check(`starts at 80 Hz, spoken as "${x.text}"`, x.now === 80 && x.text === '80 hertz');
check(`upper bound clamped below neighbour (max ${Math.round(x.max)} < 500)`, x.max < 500 && x.max > 300);
await xo.focus(); await page.keyboard.press('ArrowRight');
const after = await xo.evaluate((el) => +el.getAttribute('aria-valuenow'));
check(`semitone step is proportional, not 1 Hz (80 -> ${after})`, after > 80 && after <= 86);
await page.keyboard.press('End');
x = await xo.evaluate((el) => +el.getAttribute('aria-valuenow'));
check(`End clamps to legal max (${x}), never crossing the next point`, x < 500);

console.log('\n=== 7. Pointer drag (the path touch devices use) ===');
await page.reload({ waitUntil: 'networkidle' }); await sleep(800);
const mixKnob = page.locator('[aria-label="Sub band mix"]');
const box = await mixKnob.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 40, { steps: 8 });
await page.mouse.up();
const mixAfter = await mixKnob.evaluate((el) => +el.getAttribute('aria-valuenow'));
check(`dragging down lowered mix (100 -> ${mixAfter})`, mixAfter < 100);

console.log('\n=== 8. Preset picker keyboard + dirty state ===');
const trigger = page.locator('button[aria-haspopup="listbox"]');
check('collapsed by default', (await trigger.getAttribute('aria-expanded')) === 'false');
check('label shows Custom after edits', (await trigger.getAttribute('aria-label')) === 'Preset: Custom');
await trigger.focus(); await page.keyboard.press('ArrowDown');
check('ArrowDown opens the listbox', (await trigger.getAttribute('aria-expanded')) === 'true');
check('focus moved into the list', await page.evaluate(() => document.activeElement?.getAttribute('role') === 'option'));
await page.keyboard.press('Escape');
check('Escape closes it', (await trigger.getAttribute('aria-expanded')) === 'false');
check('focus returned to the trigger', await page.evaluate(() => document.activeElement?.getAttribute('aria-haspopup') === 'listbox'));

console.log('\n=== 9. Meter gradient is anchored to the scale, not the fill ===');
const meter = await page.evaluate(() => {
  const el = document.querySelector('[data-meter-fill]');
  const cs = getComputedStyle(el);
  return { clip: cs.clipPath, bg: cs.backgroundImage.slice(0, 60), height: el.getBoundingClientRect().height };
});
check(`fill is clipped, not resized (clip-path: ${meter.clip})`, meter.clip.includes('inset'));
check(`gradient spans the full bar (${Math.round(meter.height)}px tall)`, meter.height > 100);

console.log('\n=== 10. Contrast of the former offenders ===');
const contrast = await page.evaluate(() => {
  const lum = (hex) => {
    const [r, g, b] = hex.match(/\d+/g).map(Number).map((c) => {
      const s = c / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (fg, bg) => {
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return (a + 0.05) / (b + 0.05);
  };
  const stripBg = 'rgb(15, 22, 40)';
  const out = {};
  const tick = [...document.querySelectorAll('[class*="tick"]')].find((el) => el.children.length === 0 && el.textContent.trim());
  if (tick) out.faderTick = { ratio: ratio(getComputedStyle(tick).color, stripBg), size: getComputedStyle(tick).fontSize };
  const det = document.querySelector('[role="radio"][aria-checked="false"]');
  if (det) out.inactiveRadio = { ratio: ratio(getComputedStyle(det).color, 'rgb(16, 26, 45)'), size: getComputedStyle(det).fontSize };
  const head = document.querySelector('[class*="heading"]');
  if (head) out.heading = { ratio: ratio(getComputedStyle(head).color, 'rgb(16, 26, 45)'), size: getComputedStyle(head).fontSize };
  const track = document.querySelector('[class*="track"][class*="RotaryKnob"]') || document.querySelector('svg path');
  if (track) out.knobTrack = { ratio: ratio(getComputedStyle(track).stroke, stripBg) };
  return out;
});
for (const [k, v] of Object.entries(contrast)) {
  const need = k === 'knobTrack' ? 3 : 4.5;
  check(`${k}: ${v.ratio.toFixed(2)}:1 (>= ${need}) ${v.size ? `at ${v.size}` : ''}`, v.ratio >= need);
}
const minFont = await page.evaluate(() => Math.min(...[...document.querySelectorAll('*')]
  .filter((el) => el.children.length === 0 && el.textContent.trim())
  .map((el) => parseFloat(getComputedStyle(el).fontSize))));
check(`smallest rendered text is ${minFont}px (>= 10)`, minFont >= 10);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
await browser.close(); server.kill();
process.exit(fail > 0 ? 1 : 0);
