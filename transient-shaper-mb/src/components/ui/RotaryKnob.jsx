import React, { useState } from 'react';
import useKnobDrag from '../../hooks/useKnobDrag';

// Phase 5.1 — SVG rotary knob with arc indicator, drag interaction, bipolar support
export default function RotaryKnob({ value, min, max, label, color = '#fff', size = 'md', onChange, defaultValue }) {
  const [hovering, setHovering] = useState(false);
  const diameters = { sm: 28, md: 36, lg: 48 };
  const d = diameters[size];
  const r = d / 2;
  const strokeWidth = 2;
  const arcRadius = r - strokeWidth - 2;
  const cx = r;
  const cy = r;

  // Arc spans 270 degrees: from 135deg (7 o'clock) to 405deg (5 o'clock)
  const startAngle = 135;
  const endAngle = 405;
  const totalArc = endAngle - startAngle; // 270

  const isBipolar = min < 0 && max > 0;
  const normalized = (value - min) / (max - min); // 0 to 1
  const valueAngle = startAngle + normalized * totalArc;

  // Center angle for bipolar (where 0 is)
  const centerNormalized = isBipolar ? (0 - min) / (max - min) : 0;
  const centerAngle = startAngle + centerNormalized * totalArc;

  function polarToCartesian(angle) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + arcRadius * Math.cos(rad),
      y: cy + arcRadius * Math.sin(rad),
    };
  }

  function describeArc(start, end) {
    if (Math.abs(end - start) < 0.5) return '';
    const s = polarToCartesian(start);
    const e = polarToCartesian(end);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${arcRadius} ${arcRadius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  }

  // Background track arc (full range)
  const trackPath = describeArc(startAngle, endAngle);

  // Value arc
  let valuePath;
  if (isBipolar) {
    if (value >= 0) {
      valuePath = describeArc(centerAngle, valueAngle);
    } else {
      valuePath = describeArc(valueAngle, centerAngle);
    }
  } else {
    valuePath = describeArc(startAngle, valueAngle);
  }

  // Pointer line from center toward value angle
  const pointerLength = arcRadius - 4;
  const pointerEnd = (() => {
    const rad = ((valueAngle - 90) * Math.PI) / 180;
    return {
      x: cx + pointerLength * Math.cos(rad),
      y: cy + pointerLength * Math.sin(rad),
    };
  })();

  const resetValue = defaultValue !== undefined ? defaultValue : (isBipolar ? 0 : (min + max) / 2);

  const { onMouseDown, onDoubleClick } = useKnobDrag({
    value,
    min,
    max,
    onChange,
    sensitivity: size === 'lg' ? 0.3 : 0.5,
  });

  // Override double-click to use proper default
  const handleDoubleClick = () => onChange(resetValue);

  // Format display value
  const displayValue = Number.isInteger(value) ? value : value.toFixed(1);

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, userSelect: 'none' }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <svg
        width={d}
        height={d}
        style={{ cursor: 'pointer', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}
        onMouseDown={onMouseDown}
        onDoubleClick={handleDoubleClick}
      >
        {/* Knob body with radial gradient */}
        <defs>
          <radialGradient id={`knob-grad-${label}`} cx="40%" cy="35%">
            <stop offset="0%" stopColor="#3A3A44" />
            <stop offset="100%" stopColor="#1E1E24" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r - 2} fill={`url(#knob-grad-${label})`} />

        {/* Track arc (background) */}
        <path d={trackPath} fill="none" stroke="#333" strokeWidth={strokeWidth} strokeLinecap="round" />

        {/* Value arc */}
        {valuePath && (
          <path d={valuePath} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
        )}

        {/* Pointer line */}
        <line
          x1={cx}
          y1={cy}
          x2={pointerEnd.x}
          y2={pointerEnd.y}
          stroke="#ddd"
          strokeWidth={1.5}
          strokeLinecap="round"
        />

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={1.5} fill="#666" />

        {/* Value text on hover */}
        {hovering && (
          <text
            x={cx}
            y={cy + r + 1}
            textAnchor="middle"
            fontSize={8}
            fill={color}
            fontFamily="sans-serif"
          >
            {displayValue}
          </text>
        )}
      </svg>
      {label && (
        <span style={{
          fontSize: 9,
          textTransform: 'uppercase',
          color: '#888',
          letterSpacing: '1px',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
      )}
    </div>
  );
}
