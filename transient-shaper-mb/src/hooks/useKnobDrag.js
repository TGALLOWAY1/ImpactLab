import { useCallback, useRef } from 'react';

// Shared drag interaction logic for rotary knobs and sliders
export default function useKnobDrag({ value, min, max, onChange, sensitivity = 0.5 }) {
  const startY = useRef(null);
  const startValue = useRef(null);

  const onMouseDown = useCallback(
    (e) => {
      startY.current = e.clientY;
      startValue.current = value;

      const onMouseMove = (e) => {
        const delta = (startY.current - e.clientY) * sensitivity;
        const newValue = Math.max(min, Math.min(max, startValue.current + delta));
        onChange(newValue);
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [value, min, max, onChange, sensitivity],
  );

  const onDoubleClick = useCallback(() => {
    const defaultValue = (min + max) / 2;
    onChange(defaultValue);
  }, [min, max, onChange]);

  return { onMouseDown, onDoubleClick };
}
