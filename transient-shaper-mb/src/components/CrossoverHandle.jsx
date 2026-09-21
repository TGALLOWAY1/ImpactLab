import React from 'react';
import useParameterControl from '../hooks/useParameterControl';
import styles from './CrossoverEditor.module.css';

const LOG_MIN = Math.log10(20);
const LOG_MAX = Math.log10(20000);
const LOG_SPAN = LOG_MAX - LOG_MIN;

// Keyboard steps expressed as a fraction of the whole bar. The bar spans
// log2(20000/20) = 9.966 octaves, so one semitone is 1/(12 * 9.966).
const OCTAVES = Math.log2(20000 / 20);
const SEMITONE_N = 1 / (12 * OCTAVES);

const barToFreq = (n) => Math.round(10 ** (LOG_MIN + n * LOG_SPAN));
const freqToBar = (hz) => (Math.log10(hz) - LOG_MIN) / LOG_SPAN;

function speakFrequency(hz) {
  // Screen readers mangle "kHz", so the units are spelled out.
  return hz >= 1000
    ? `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)} kilohertz`
    : `${Math.round(hz)} hertz`;
}

function displayFrequency(hz) {
  return hz >= 1000 ? `${(hz / 1000).toFixed(1)} kHz` : `${Math.round(hz)} Hz`;
}

/**
 * One draggable crossover point.
 *
 * Extracted from CrossoverEditor because hooks cannot be called inside
 * freqs.map() — each handle needs its own useParameterControl.
 *
 * Note the deliberate asymmetry: min/max are the live neighbour-clamped bounds
 * (so aria-valuemin/max tell the truth about where this handle may actually
 * go), while the normalized mapping spans the WHOLE bar (so absolute pointer
 * position maps correctly).
 */
export default function CrossoverHandle({ index, freq, lowerBound, upperBound, accent, trackRef, onChange }) {
  const { rootProps } = useParameterControl({
    value: freq,
    min: lowerBound,
    max: upperBound,
    stepNormalized: SEMITONE_N,
    largeStepNormalized: SEMITONE_N * 12,  // one octave
    fineStepNormalized: SEMITONE_N / 4,
    orientation: 'horizontal',
    mode: 'absolute',
    trackRef,
    toNormalized: freqToBar,
    fromNormalized: barToFreq,
    label: `Crossover ${index + 1}`,
    format: speakFrequency,
    onChange,
    style: {
      left: `${freqToBar(freq) * 100}%`,
      '--handle-accent': accent,
      zIndex: 2 + index,
    },
  });

  return (
    <div className={styles.handle} {...rootProps}>
      <span className={styles.dot} />
      <span className={styles.readout}>{displayFrequency(freq)}</span>
    </div>
  );
}
