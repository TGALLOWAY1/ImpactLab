import { useEffect, useState, useRef } from 'react';

/**
 * Polls a metersRef populated by useAudioEngine at ~30 Hz and returns the
 * latest snapshot. The worklet posts meter messages every ~32 ms; we throttle
 * React updates to a similar cadence to avoid wasted renders.
 *
 * Returns null when the ref is not yet ready.
 */
export default function useMeters(metersRef, active = true) {
  const [snapshot, setSnapshot] = useState(null);
  const rafRef = useRef(null);
  const lastTickRef = useRef(0);

  useEffect(() => {
    if (!active || !metersRef) {
      setSnapshot(null);
      return;
    }

    const tick = (t) => {
      // Throttle to ~30 Hz
      if (t - lastTickRef.current >= 33) {
        lastTickRef.current = t;
        const m = metersRef.current;
        if (m) {
          // Shallow snapshot — band array copied so React notices changes
          setSnapshot({
            inPeakL: m.inPeakL, inPeakR: m.inPeakR,
            inRmsL: m.inRmsL, inRmsR: m.inRmsR,
            outPeakL: m.outPeakL, outPeakR: m.outPeakR,
            outRmsL: m.outRmsL, outRmsR: m.outRmsR,
            gainDb: m.gainDb,
            bandGainDb: m.bandGainDb.slice(),
          });
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [metersRef, active]);

  return snapshot;
}

// Helpers for meter rendering
export function linearToMeterHeight(linear, floorDb = -60) {
  if (!Number.isFinite(linear) || linear <= 0) return 0;
  const db = 20 * Math.log10(linear);
  if (db <= floorDb) return 0;
  if (db >= 0) return 1;
  return (db - floorDb) / -floorDb;
}

// Magnitude of the shaper's gain change, normalized to 0..1 for meter height.
// Signed either way: a transient shaper boosting attack is doing just as much
// work as one cutting sustain, and both should read on the meter.
export function gainDbToHeight(gainDb, rangeDb = 12) {
  if (!Number.isFinite(gainDb)) return 0;
  const magnitude = Math.abs(gainDb);
  if (magnitude >= rangeDb) return 1;
  return magnitude / rangeDb;
}
