import React from 'react';
import useParameterControl from '../../hooks/useParameterControl';
import styles from './VerticalSlider.module.css';

const TRACK_HEIGHT = 80;
const THUMB_HEIGHT = 6;

// Four ticks, not seven. At the 10px readable minimum, seven labels across an
// 80px track collide; the old 7px/#555 set was ~2.4:1 and unreadable anyway.
const TICKS = [0, -10, -20, -30];

export default function VerticalSlider({
  value,
  min = -30,
  max = 6,
  label,
  onChange,
  ariaLabel,
}) {
  const normalized = (value - min) / (max - min);
  const fillHeight = normalized * TRACK_HEIGHT;
  const thumbY = TRACK_HEIGHT - normalized * TRACK_HEIGHT - THUMB_HEIGHT / 2;

  const { rootProps } = useParameterControl({
    value,
    min,
    max,
    step: 0.5,
    largeStep: 6,
    fineStep: 0.1,
    defaultValue: 0,
    orientation: 'vertical',
    mode: 'delta',
    sensitivity: 0.3,
    label: ariaLabel || (label ? `${label} gain` : 'Gain'),
    format: (v) => `${v.toFixed(1)} dB`,
    onChange,
  });

  return (
    <div className={styles.root} style={{ '--track-h': `${TRACK_HEIGHT}px` }}>
      <div className={styles.trackArea}>
        <div className={styles.ticks} style={{ height: TRACK_HEIGHT }} aria-hidden="true">
          {TICKS.filter((t) => t >= min && t <= max).map((tick) => {
            const tickNorm = (tick - min) / (max - min);
            return (
              <span
                key={tick}
                className={styles.tick}
                style={{ top: TRACK_HEIGHT - tickNorm * TRACK_HEIGHT - 5 }}
              >
                {tick}
              </span>
            );
          })}
        </div>

        <div className={styles.hitArea} {...rootProps}>
          <div className={styles.track}>
            <div className={styles.fill} style={{ height: fillHeight }} />
            <div className={styles.thumb} style={{ top: thumbY }} />
          </div>
        </div>

        <span className={styles.unit} aria-hidden="true">dB</span>
      </div>

      {label && <span className={styles.label}>{label}</span>}
    </div>
  );
}
