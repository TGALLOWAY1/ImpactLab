import React, { useId } from 'react';
import useParameterControl from '../../hooks/useParameterControl';
import styles from './RotaryKnob.module.css';

const DIAMETERS = { sm: 28, md: 36, lg: 48 };

// 270-degree sweep, from 7 o'clock round to 5 o'clock.
const START_ANGLE = 135;
const END_ANGLE = 405;
const TOTAL_ARC = END_ANGLE - START_ANGLE;

export default function RotaryKnob({
  value,
  min,
  max,
  label,
  size = 'md',
  onChange,
  defaultValue,
  step = 1,
  largeStep = 10,
  fineStep = 0.1,
  format,
  ariaLabel,
  showValue = true,
}) {
  const gradId = useId();
  const d = DIAMETERS[size] ?? DIAMETERS.md;
  const r = d / 2;
  const strokeWidth = 2;
  const arcRadius = r - strokeWidth - 2;
  const cx = r;
  const cy = r;

  const isBipolar = min < 0 && max > 0;
  const normalized = (value - min) / (max - min);
  const valueAngle = START_ANGLE + normalized * TOTAL_ARC;
  const centerNormalized = isBipolar ? (0 - min) / (max - min) : 0;
  const centerAngle = START_ANGLE + centerNormalized * TOTAL_ARC;

  const resolvedDefault =
    defaultValue !== undefined ? defaultValue : isBipolar ? 0 : (min + max) / 2;

  const { rootProps, formatted } = useParameterControl({
    value,
    min,
    max,
    step,
    largeStep,
    fineStep,
    defaultValue: resolvedDefault,
    orientation: 'vertical',
    mode: 'delta',
    sensitivity: size === 'lg' ? 0.3 : 0.5,
    label: ariaLabel || label,
    format: format || ((v) => String(Math.round(v))),
    onChange,
  });

  function polarToCartesian(angle, radius) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function describeArc(start, end) {
    if (Math.abs(end - start) < 0.5) return '';
    const s = polarToCartesian(start, arcRadius);
    const e = polarToCartesian(end, arcRadius);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${arcRadius} ${arcRadius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  }

  const trackPath = describeArc(START_ANGLE, END_ANGLE);
  const valuePath = isBipolar
    ? value >= 0
      ? describeArc(centerAngle, valueAngle)
      : describeArc(valueAngle, centerAngle)
    : describeArc(START_ANGLE, valueAngle);

  const pointerEnd = polarToCartesian(valueAngle, arcRadius - 4);

  return (
    // rootProps go on the wrapper, not the <svg>: outline behaviour on SVG is
    // inconsistent across browsers, and the wrapper gives a larger hit target.
    <div className={styles.knob} {...rootProps}>
      <svg width={d} height={d} aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={gradId} cx="40%" cy="35%">
            <stop offset="0%" stopColor="var(--control-bg-raised)" />
            <stop offset="100%" stopColor="var(--control-bg)" />
          </radialGradient>
        </defs>

        <circle cx={cx} cy={cy} r={r - 2} fill={`url(#${gradId})`} />

        {/* The range track. Previously #333 at 1.4:1 — technically drawn, but
            invisible, so the knob showed its fill with no reference for where
            that sat within the range. */}
        <path
          className={styles.track}
          d={trackPath}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {valuePath && (
          <path
            className={styles.valueArc}
            d={valuePath}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}

        <line
          className={styles.pointer}
          x1={cx}
          y1={cy}
          x2={pointerEnd.x}
          y2={pointerEnd.y}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <circle className={styles.hub} cx={cx} cy={cy} r={1.5} />

        {/* Circular stand-in for the rectangular focus outline. */}
        <circle
          className={styles.focusRing}
          cx={cx}
          cy={cy}
          r={r - 1}
          fill="none"
          stroke="var(--focus-ring)"
          strokeWidth={2}
        />
      </svg>

      {label && <span className={styles.label}>{label}</span>}
      {showValue && <span className={styles.value}>{formatted}</span>}
    </div>
  );
}
