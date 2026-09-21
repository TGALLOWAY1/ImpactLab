import React, { useRef, useCallback } from 'react';
import { BANDS } from '../constants/bands';
import CrossoverHandle from './CrossoverHandle';
import styles from './CrossoverEditor.module.css';

const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const MIN_OCTAVE_SPACING = 0.5;          // adjacent points stay half an octave apart
const MIN_RATIO = Math.pow(2, MIN_OCTAVE_SPACING);

const LOG_MIN = Math.log10(MIN_FREQ);
const LOG_SPAN = Math.log10(MAX_FREQ) - LOG_MIN;

// Percent of the bar, not pixels.
//
// This replaces the old measure-with-ResizeObserver-then-position-in-px
// approach, which needed a `barWidth` state seeded at a guessed 200 (so the
// regions and handles were wrong until the first re-render). Percentages are
// resolved by the browser against the element's own box, which is both correct
// on the first paint and automatically right under PluginShell's transform.
const freqToPct = (hz) => ((Math.log10(hz) - LOG_MIN) / LOG_SPAN) * 100;

export default function CrossoverEditor({ freqs, onChange }) {
  const barRef = useRef(null);
  // Read inside the change handler so a drag never clamps against the
  // frequencies as they were when the drag started.
  const freqsRef = useRef(freqs);
  freqsRef.current = freqs;

  const handleChange = useCallback(
    (idx, hz) => {
      const next = [...freqsRef.current];
      next[idx] = hz;
      onChange(next);
    },
    [onChange],
  );

  return (
    <div className={styles.root}>
      <span className={styles.heading}>Crossover Frequency</span>

      <div
        ref={barRef}
        className={styles.bar}
        role="group"
        aria-label="Crossover frequencies"
      >
        {BANDS.map((band, i) => {
          const leftFreq = i === 0 ? MIN_FREQ : freqs[i - 1];
          const rightFreq = i === freqs.length ? MAX_FREQ : freqs[i];
          const left = freqToPct(leftFreq);
          return (
            <div
              key={band.id}
              className={styles.region}
              style={{
                left: `${left}%`,
                width: `${Math.max(0, freqToPct(rightFreq) - left)}%`,
                backgroundColor: band.color,
              }}
            />
          );
        })}

        {freqs.map((freq, idx) => (
          <CrossoverHandle
            key={idx}
            index={idx}
            freq={freq}
            lowerBound={idx > 0 ? freqs[idx - 1] * MIN_RATIO : MIN_FREQ * MIN_RATIO}
            upperBound={
              idx < freqs.length - 1 ? freqs[idx + 1] / MIN_RATIO : MAX_FREQ / MIN_RATIO
            }
            // The point separates band idx and idx+1; use the upper band's colour.
            accent={BANDS[idx + 1]?.color || BANDS[idx]?.color || 'var(--accent-default)'}
            trackRef={barRef}
            onChange={(hz) => handleChange(idx, hz)}
          />
        ))}
      </div>
    </div>
  );
}
