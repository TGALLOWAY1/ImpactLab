import { useCallback, useRef } from 'react';

/**
 * Roving-tabindex keyboard handling for a radio group.
 *
 * SpeedSelector and DetectionMethodSelector are mutually-exclusive choices that
 * were rendered as loose <button>s: no group semantics, no arrow-key
 * navigation, and selection conveyed by colour plus a 2px underline or a "▸"
 * character. This gives both the real radiogroup pattern.
 *
 * Roving tabindex means the group is a single tab stop — Tab moves past it,
 * arrows move within it — which is what WAI-ARIA specifies for radios.
 */
export default function useRadioGroup({ values, value, onChange, orientation = 'horizontal' }) {
  const refs = useRef([]);

  const select = useCallback(
    (index) => {
      const wrapped = (index + values.length) % values.length;
      onChange(values[wrapped]);
      refs.current[wrapped]?.focus();
    },
    [values, onChange],
  );

  const onKeyDown = useCallback(
    (e) => {
      const current = values.indexOf(value);
      const forward = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
      const back = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';

      switch (e.key) {
        // Both axes are accepted: users press whichever matches the visual
        // layout, and the APG allows it.
        case forward:
        case (orientation === 'vertical' ? 'ArrowRight' : 'ArrowDown'):
          e.preventDefault();
          select(current + 1);
          break;
        case back:
        case (orientation === 'vertical' ? 'ArrowLeft' : 'ArrowUp'):
          e.preventDefault();
          select(current - 1);
          break;
        case 'Home':
          e.preventDefault();
          select(0);
          break;
        case 'End':
          e.preventDefault();
          select(values.length - 1);
          break;
        default:
      }
    },
    [values, value, orientation, select],
  );

  const getRadioProps = useCallback(
    (optionValue, index) => ({
      role: 'radio',
      'aria-checked': optionValue === value,
      // Only the selected option is tabbable — the group is one tab stop.
      tabIndex: optionValue === value ? 0 : -1,
      ref: (el) => { refs.current[index] = el; },
      onClick: () => onChange(optionValue),
      onKeyDown,
    }),
    [value, onChange, onKeyDown],
  );

  return { getRadioProps };
}
