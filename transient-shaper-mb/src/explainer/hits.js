// Hit detection from the worklet's per-sample attack signal. Used by row 2
// (triangle marker positions + strengths) and row 3 (attack / sustain coloring
// windows).

export function detectHits(attackArr, { threshold = 0.3, minGapMs = 70, sampleRate = 44100 } = {}) {
  const minGap = Math.max(1, Math.round((minGapMs / 1000) * sampleRate));
  const hits = [];
  const n = attackArr.length;

  let i = 0;
  while (i < n) {
    if (attackArr[i] > threshold) {
      let peakI = i;
      let peakV = attackArr[i];
      const halfGate = threshold * 0.5;
      while (i < n && attackArr[i] > halfGate) {
        if (attackArr[i] > peakV) { peakV = attackArr[i]; peakI = i; }
        i++;
      }
      if (hits.length === 0 || peakI - hits[hits.length - 1].index >= minGap) {
        hits.push({ index: peakI, strength: peakV });
      }
    } else {
      i++;
    }
  }
  return hits;
}

// For each hit, compute attack-window end (where attackSignal falls below
// half its peak) and sustain-window end (min of next-hit start or 300ms cap).
// These windows drive the green/yellow tinting in row 3.
export function computeHitWindows(hits, attackArr, sampleRate) {
  const sustainCapSamples = Math.round(0.3 * sampleRate);
  return hits.map((hit, i) => {
    const next = i + 1 < hits.length ? hits[i + 1].index : attackArr.length;
    const halfPeak = hit.strength * 0.5;
    let attackEnd = hit.index;
    for (let j = hit.index; j < next; j++) {
      attackEnd = j;
      if (attackArr[j] < halfPeak) break;
    }
    const sustainEnd = Math.min(next, hit.index + sustainCapSamples);
    return {
      index: hit.index,
      strength: hit.strength,
      attackStart: hit.index,
      attackEnd,
      sustainEnd,
    };
  });
}

// Max-pool a Float32Array down to `bucketCount` peaks. Used for all waveform
// drawing so row 1 / row 2 / row 3 stay in lockstep.
export function downsamplePeaks(arr, bucketCount) {
  const out = new Float32Array(bucketCount);
  if (arr.length === 0) return out;
  const step = arr.length / bucketCount;
  for (let i = 0; i < bucketCount; i++) {
    const start = Math.floor(i * step);
    const end = Math.min(arr.length, Math.floor((i + 1) * step));
    let peak = 0;
    for (let j = start; j < end; j++) {
      const v = Math.abs(arr[j]);
      if (v > peak) peak = v;
    }
    out[i] = peak;
  }
  return out;
}
