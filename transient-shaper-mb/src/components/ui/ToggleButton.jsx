import React from 'react';
import styles from './ToggleButton.module.css';

/**
 * Two-state button.
 *
 * The accent comes from CSS custom properties, not a `color` prop: inside a
 * band strip it inherits --band-accent automatically; elsewhere the caller
 * sets --toggle-accent.
 */
export default function ToggleButton({
  active,
  label,
  ariaLabel,
  size,
  onClick,
  style,
  className = '',
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      // The visible label is sometimes abbreviated ("S", "BYP"); the accessible
      // name should not be.
      aria-label={ariaLabel}
      className={`${styles.btn} ${size === 'sm' ? styles.sm : ''} ${className}`}
      style={style}
    >
      {label}
    </button>
  );
}
