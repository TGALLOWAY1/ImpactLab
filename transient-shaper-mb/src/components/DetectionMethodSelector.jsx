import React from 'react';
import { DETECTION_METHODS, DETECTION_METHOD_LABELS } from '../constants/dspMapping';
import useRadioGroup from '../hooks/useRadioGroup';
import styles from './DetectionMethodSelector.module.css';

// Phase D7 — Detection method selector for comparing algorithms
export default function DetectionMethodSelector({ value, onChange }) {
  const { getRadioProps } = useRadioGroup({
    values: DETECTION_METHODS,
    value,
    onChange,
    orientation: 'vertical',
  });

  return (
    <div className={styles.root}>
      <span className={styles.heading} id="detection-method-label">Detection</span>
      <div
        className={styles.options}
        role="radiogroup"
        aria-labelledby="detection-method-label"
      >
        {DETECTION_METHODS.map((method, i) => (
          <button
            key={method}
            type="button"
            className={styles.option}
            {...getRadioProps(method, i)}
          >
            {DETECTION_METHOD_LABELS[method]}
          </button>
        ))}
      </div>
    </div>
  );
}
