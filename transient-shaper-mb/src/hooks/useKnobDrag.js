import { useCallback, useRef } from 'react';

// Shared drag interaction logic for rotary knobs and sliders
export default function useKnobDrag({ value, min, max, onChange, sensitivity = 0.5 }) {
  const startY = useRef(null);
  const startValue = useRef(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const onMouseDown = useCallback(
    (e) => {
      // Prevent the browser from initiating a text selection on adjacent
      // labels while the user drags the knob.
      e.preventDefault();

      startY.current = e.clientY;
      startValue.current = valueRef.current;

      const prevUserSelect = document.body.style.userSelect;
      const prevCursor = document.body.style.cursor;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ns-resize';

      const onMouseMove = (e) => {
        const delta = (startY.current - e.clientY) * sensitivity;
        const newValue = Math.max(min, Math.min(max, startValue.current + delta));
        onChange(newValue);
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.userSelect = prevUserSelect;
        document.body.style.cursor = prevCursor;
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [min, max, onChange, sensitivity],
  );

  // Double-click-to-default lives in the individual controls: the midpoint of
  // the range is the wrong answer for most parameters here (Output Gain runs
  // -30..+6, so its midpoint is -12 dB, not 0 dB), and each control already
  // knows its own neutral value.
  return { onMouseDown };
}
