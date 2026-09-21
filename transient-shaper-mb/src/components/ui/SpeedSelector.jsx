import React from 'react';
import useRadioGroup from '../../hooks/useRadioGroup';
import styles from './SpeedSelector.module.css';

const OPTIONS = [
  { id: 'slow', label: 'Slow', icon: '∿' },
  { id: 'medium', label: 'Medium', icon: '∿∿' },
  { id: 'fast', label: 'Fast', icon: '∿∿∿' },
];

const VALUES = OPTIONS.map((o) => o.id);

export default function SpeedSelector({ value, onChange }) {
  const { getRadioProps } = useRadioGroup({ values: VALUES, value, onChange });

  return (
    <div className={styles.root}>
      <span className={styles.heading} id="speed-selector-label">
        Transient Detection Speed
      </span>
      <div className={styles.options} role="radiogroup" aria-labelledby="speed-selector-label">
        {OPTIONS.map((opt, i) => (
          <button
            key={opt.id}
            type="button"
            className={styles.option}
            {...getRadioProps(opt.id, i)}
          >
            {/* Decorative — the visible text label carries the meaning. */}
            <span className={styles.icon} aria-hidden="true">{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
