// Canvas drawing primitives for the explainer. Everything is drawn onto a
// single 1280×720 canvas so MediaRecorder captures a single stream.

export const CANVAS_W = 1280;
export const CANVAS_H = 720;

const BG = '#0B0E14';
const PANEL_BG = '#11151D';
const GRID = 'rgba(255,255,255,0.04)';
const GRID_STRONG = 'rgba(255,255,255,0.08)';
const TEXT = '#E6EAF2';
const TEXT_DIM = 'rgba(230,234,242,0.55)';
const BLUE = '#5BC0EB';
const BLUE_DIM = 'rgba(91,192,235,0.35)';
const GREEN = '#5ECA89';
const YELLOW = '#F5C84B';

const PANEL_X = 24;
const PANEL_W = CANVAS_W - 48;
const HEADER_H = 64;
const ROW_GAP = 14;
const ROWS_TOP = HEADER_H + 16;
const HUD_H = 120;
const ROWS_AREA_H = CANVAS_H - ROWS_TOP - HUD_H - 16;
const ROW_H = (ROWS_AREA_H - ROW_GAP * 2) / 3;

export const LAYOUT = {
  canvasW: CANVAS_W,
  canvasH: CANVAS_H,
  panelX: PANEL_X,
  panelW: PANEL_W,
  rowsTop: ROWS_TOP,
  rowGap: ROW_GAP,
  rowH: ROW_H,
  hudTop: CANVAS_H - HUD_H,
  rowY: (n) => ROWS_TOP + (n - 1) * (ROW_H + ROW_GAP),
};

export function clearBackground(ctx) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

export function drawHeader(ctx, { title, subtitle }) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = TEXT;
  ctx.font = '700 28px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText('TRANSIENT SHAPER EXPLAINED', CANVAS_W / 2, 38);
  ctx.fillStyle = TEXT_DIM;
  ctx.font = '500 14px system-ui, -apple-system, "Segoe UI", sans-serif';
  if (subtitle) ctx.fillText(subtitle.toUpperCase(), CANVAS_W / 2, 58);
  if (title) {
    ctx.textAlign = 'left';
    ctx.fillStyle = TEXT;
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText(title, PANEL_X, 38);
  }
}

function drawPanel(ctx, x, y, w, h, label, centerLabel) {
  ctx.fillStyle = PANEL_BG;
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();

  // Vertical grid
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  const cols = 8;
  for (let i = 1; i < cols; i++) {
    const gx = x + (w / cols) * i;
    ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke();
  }
  // Horizontal center line
  ctx.strokeStyle = GRID_STRONG;
  const midY = y + h / 2;
  ctx.beginPath(); ctx.moveTo(x, midY); ctx.lineTo(x + w, midY); ctx.stroke();

  // Row label (top-left, outside the panel)
  if (label) {
    ctx.fillStyle = TEXT_DIM;
    ctx.font = '500 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(label, x + 4, y - 6);
  }
  if (centerLabel) {
    ctx.fillStyle = TEXT_DIM;
    ctx.font = '500 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(centerLabel, x + w / 2, y + 20);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function drawTimestamps(ctx, x, y, w, h, loopSeconds, playheadNorm) {
  ctx.fillStyle = TEXT_DIM;
  ctx.font = '500 10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const ticks = 8;
  for (let i = 0; i < ticks; i++) {
    const tx = x + (w / ticks) * i + 4;
    const t = (i / ticks) * loopSeconds;
    const mm = Math.floor(t / 60).toString();
    const ss = Math.floor(t % 60).toString().padStart(2, '0');
    ctx.fillText(`${mm}:${ss}`, tx, y + h - 4);
  }
}

// Draws a mirrored (stereo-style) waveform from a peak buffer. The optional
// colorAt(i)→{r,g,b,a} callback lets row 3 tint per-bucket.
function drawWaveformPeaks(ctx, peaks, x, y, w, h, {
  color = BLUE,
  opacity = 1.0,
  colorAt = null,
} = {}) {
  const mid = y + h / 2;
  const half = h * 0.46;
  const n = peaks.length;
  const step = w / n;

  if (colorAt) {
    // Per-bucket colored bars. Slightly slower but still cheap at 2000 buckets.
    for (let i = 0; i < n; i++) {
      const px = x + i * step;
      const amp = Math.min(1, peaks[i]) * half;
      const c = colorAt(i);
      ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
      ctx.fillRect(px, mid - amp, Math.max(1, step), amp * 2);
    }
    return;
  }

  ctx.fillStyle = color;
  ctx.globalAlpha = opacity;
  ctx.beginPath();
  ctx.moveTo(x, mid);
  for (let i = 0; i < n; i++) {
    const amp = Math.min(1, peaks[i]) * half;
    ctx.lineTo(x + i * step, mid - amp);
  }
  for (let i = n - 1; i >= 0; i--) {
    const amp = Math.min(1, peaks[i]) * half;
    ctx.lineTo(x + i * step, mid + amp);
  }
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

function drawPlayhead(ctx, x, y, w, h, playheadNorm) {
  const px = x + w * playheadNorm;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y + h); ctx.stroke();
}

export function drawInputRow(ctx, { peaks, loopSeconds, playheadNorm, revealAlpha = 1 }) {
  const y = LAYOUT.rowY(1);
  drawPanel(ctx, PANEL_X, y, PANEL_W, LAYOUT.rowH,
    'Row One — Input Drum Loop Waveform', 'Input Drum Loop Waveform');
  ctx.save();
  ctx.globalAlpha = revealAlpha;
  drawWaveformPeaks(ctx, peaks, PANEL_X, y, PANEL_W, LAYOUT.rowH, { color: BLUE, opacity: 0.9 });
  drawTimestamps(ctx, PANEL_X, y, PANEL_W, LAYOUT.rowH, loopSeconds, playheadNorm);
  drawPlayhead(ctx, PANEL_X, y, PANEL_W, LAYOUT.rowH, playheadNorm);
  ctx.restore();
}

export function drawDetectorRow(ctx, { peaks, hits, playheadNorm, revealAlpha = 1, loopSeconds }) {
  const y = LAYOUT.rowY(2);
  drawPanel(ctx, PANEL_X, y, PANEL_W, LAYOUT.rowH,
    'Row Two — Detected Transients', 'Detected Transients (Detection Phase)');
  ctx.save();
  ctx.globalAlpha = revealAlpha;
  // Dimmed background waveform (reuses input peaks — detector shape not literal)
  drawWaveformPeaks(ctx, peaks, PANEL_X, y, PANEL_W, LAYOUT.rowH,
    { color: BLUE_DIM, opacity: 0.7 });

  // Green downward triangles per detected hit
  const bucketCount = peaks.length;
  for (const h of hits) {
    const tx = PANEL_X + (h.center / bucketCount) * PANEL_W;
    const strength = Math.max(0.15, Math.min(1, h.strength));
    const triH = 10 + strength * 18;
    const triW = 10 + strength * 14;
    const topY = y + 6;
    ctx.fillStyle = GREEN;
    ctx.beginPath();
    ctx.moveTo(tx - triW / 2, topY);
    ctx.lineTo(tx + triW / 2, topY);
    ctx.lineTo(tx, topY + triH);
    ctx.closePath();
    ctx.fill();
    // Subtle downward "shadow" line to anchor the marker to the waveform
    ctx.strokeStyle = 'rgba(94,202,137,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tx, topY + triH);
    ctx.lineTo(tx, y + LAYOUT.rowH * 0.5);
    ctx.stroke();
  }
  drawTimestamps(ctx, PANEL_X, y, PANEL_W, LAYOUT.rowH, loopSeconds, playheadNorm);
  drawPlayhead(ctx, PANEL_X, y, PANEL_W, LAYOUT.rowH, playheadNorm);
  ctx.restore();
}

// Blend helpers. Attack tint = green; sustain tint = yellow. Intensity scales
// with parameter magnitude so a 0% setting leaves everything pure blue.
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
const BLUE_RGB = hexToRgb(BLUE);
const GREEN_RGB = hexToRgb(GREEN);
const YELLOW_RGB = hexToRgb(YELLOW);

function blend(a, b, f) { return Math.round(a + (b - a) * f); }

export function drawOutputRow(ctx, {
  peaks, hits, attack, sustain, playheadNorm, loopSeconds, revealAlpha = 1,
  title,
}) {
  const y = LAYOUT.rowY(3);
  drawPanel(ctx, PANEL_X, y, PANEL_W, LAYOUT.rowH,
    'Row Three — Output Signal with Parameter Changes',
    title || 'Output Signal');
  ctx.save();
  ctx.globalAlpha = revealAlpha;

  const bucketCount = peaks.length;
  const attackMag = Math.min(1, Math.abs(attack) / 80);
  const sustainMag = Math.min(1, Math.abs(sustain) / 80);

  // Precompute bucket → (inAttackWindow, inSustainWindow) lookup
  const inAttack = new Uint8Array(bucketCount);
  const inSustain = new Uint8Array(bucketCount);
  for (const h of hits) {
    for (let i = h.attackStart; i <= h.attackEnd && i < bucketCount; i++) inAttack[i] = 1;
    for (let i = h.attackEnd + 1; i <= h.sustainEnd && i < bucketCount; i++) inSustain[i] = 1;
  }

  drawWaveformPeaks(ctx, peaks, PANEL_X, y, PANEL_W, LAYOUT.rowH, {
    colorAt: (i) => {
      let r = BLUE_RGB.r, g = BLUE_RGB.g, b = BLUE_RGB.b;
      if (inAttack[i] && attackMag > 0.01) {
        r = blend(r, GREEN_RGB.r, attackMag);
        g = blend(g, GREEN_RGB.g, attackMag);
        b = blend(b, GREEN_RGB.b, attackMag);
      } else if (inSustain[i] && sustainMag > 0.01) {
        r = blend(r, YELLOW_RGB.r, sustainMag);
        g = blend(g, YELLOW_RGB.g, sustainMag);
        b = blend(b, YELLOW_RGB.b, sustainMag);
      }
      return { r, g, b, a: 0.92 };
    },
  });

  drawTimestamps(ctx, PANEL_X, y, PANEL_W, LAYOUT.rowH, loopSeconds, playheadNorm);
  drawPlayhead(ctx, PANEL_X, y, PANEL_W, LAYOUT.rowH, playheadNorm);
  ctx.restore();
}

// --- Knob HUD ---------------------------------------------------------------

function drawKnob(ctx, cx, cy, r, { value, label, unit, accent }) {
  // Outer track
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25, false);
  ctx.stroke();

  // Value arc: center-zero, sweeps left (negative) or right (positive)
  const norm = Math.max(-1, Math.min(1, value / 100));
  if (Math.abs(norm) > 0.001) {
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    const start = Math.PI * 1.5;
    const end = start + norm * Math.PI * 0.75;
    ctx.arc(cx, cy, r, Math.min(start, end), Math.max(start, end), false);
    ctx.stroke();
  }

  // Indicator dot
  const angle = Math.PI * 1.5 + norm * Math.PI * 0.75;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(cx + Math.cos(angle) * (r - 1), cy + Math.sin(angle) * (r - 1), 3, 0, Math.PI * 2);
  ctx.fill();

  // Label above, dB value below, "Gain" sublabel
  ctx.fillStyle = TEXT;
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(label, cx, cy - r - 14);
  ctx.fillStyle = accent;
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText(unit, cx, cy - r + 2);
  ctx.fillStyle = TEXT_DIM;
  ctx.font = '500 11px system-ui, sans-serif';
  ctx.fillText('Gain', cx, cy + r + 14);
}

// Map -100..+100 "percent" to a dB readout. The band processor uses ±12 dB
// at ±100%; display the linearly-mapped dB so the HUD tracks the knob label.
function pctToDb(pct) {
  return (pct / 100) * 12;
}

export function drawKnobHUD(ctx, { attack, sustain }) {
  const y = LAYOUT.hudTop + 44;
  const knobR = 22;
  const spacing = 140;
  const cx1 = CANVAS_W / 2 - spacing / 2;
  const cx2 = CANVAS_W / 2 + spacing / 2;

  const aDb = pctToDb(attack);
  const sDb = pctToDb(sustain);
  drawKnob(ctx, cx1, y, knobR, {
    value: attack,
    label: 'ATTACK',
    unit: `${aDb >= 0 ? '+' : ''}${aDb.toFixed(1)} dB`,
    accent: GREEN,
  });
  drawKnob(ctx, cx2, y, knobR, {
    value: sustain,
    label: 'SUSTAIN',
    unit: `${sDb >= 0 ? '+' : ''}${sDb.toFixed(1)} dB`,
    accent: YELLOW,
  });
}

// --- Sparkle logo -----------------------------------------------------------

export function drawSparkle(ctx) {
  const cx = CANVAS_W - 32;
  const cy = CANVAS_H - 30;
  const r = 10;
  ctx.fillStyle = 'rgba(230,234,242,0.45)';
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.28, cy - r * 0.28);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx + r * 0.28, cy + r * 0.28);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r * 0.28, cy + r * 0.28);
  ctx.lineTo(cx - r, cy);
  ctx.lineTo(cx - r * 0.28, cy - r * 0.28);
  ctx.closePath();
  ctx.fill();
}
