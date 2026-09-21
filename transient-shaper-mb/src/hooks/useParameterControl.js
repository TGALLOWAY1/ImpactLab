import { useCallback, useRef, useState } from 'react';

/**
 * Shared interaction + accessibility layer for every continuous parameter:
 * rotary knobs, vertical faders, and crossover handles.
 *
 * Replaces useKnobDrag, which was mouse-only, keyboard-inoperable and invisible
 * to assistive tech.
 *
 * Three things make this work for all three consumers:
 *
 * 1. ALL internal maths happen in normalized 0..1 space, via toNormalized /
 *    fromNormalized. That is what makes the hook correct for the log-frequency
 *    crossover as well as the linear knobs, and it maps 1:1 onto JUCE's
 *    NormalisableRange for the eventual native port.
 *
 * 2. `mode` separates delta mapping from absolute mapping. This matters because
 *    PluginShell scales the whole plugin with transform: scale():
 *      - scale breaks ABSOLUTE mapping  -> always derive the ratio from a single
 *        getBoundingClientRect() call, never from a layout width.
 *      - scale never breaks DELTA mapping -> raw clientX/Y deltas are already in
 *        visual pixels, so drag feel follows the physical mouse at any scale.
 *        Dividing by the scale factor would make a small window need a
 *        proportionally huge drag, which is strictly worse.
 *
 * 3. Pointer events + setPointerCapture, so touch and pen work, and so the
 *    move/up handlers stay plain React props. The old document.addEventListener
 *    approach leaked a listener whenever a control unmounted mid-drag.
 */

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Ratio of a client coordinate within an element, in VISUAL pixels.
 *
 * Both terms come from the same getBoundingClientRect(), so the ratio is
 * scale-invariant. Never substitute a layout width (e.g. a ResizeObserver's
 * contentRect) for the denominator — that silently breaks at any scale != 1.
 */
export function localRatio(el, clientCoord, axis = 'x') {
  const r = el.getBoundingClientRect();
  return axis === 'x'
    ? (clientCoord - r.left) / r.width
    : (clientCoord - r.top) / r.height;
}

export default function useParameterControl({
  value,
  min,
  max,
  step,
  largeStep,
  fineStep,
  // Escape hatch for non-linear ranges (the crossover), where a step expressed
  // in value units is musically meaningless. Takes precedence when provided.
  stepNormalized,
  largeStepNormalized,
  fineStepNormalized,
  defaultValue,
  orientation = 'vertical',
  mode = 'delta',
  trackRef,
  sensitivity = 0.5,     // value units per physical pixel, delta mode only
  fineDragFactor = 0.2,  // multiplier while Shift is held during a drag
  toNormalized,
  fromNormalized,
  label,
  format,
  onChange,
  onCommit,
  disabled = false,
  // Merged into rootProps.style. Callers MUST pass positioning/theming styles
  // here rather than setting their own `style` prop alongside {...rootProps} —
  // a second style prop would silently overwrite touchAction and break touch
  // dragging (and, for absolutely positioned handles, their position).
  style: callerStyle,
}) {
  const span = max - min;

  const toNorm = toNormalized || ((v) => (v - min) / span);
  const fromNorm = fromNormalized || ((n) => min + n * span);

  const resolvedStep = step ?? span / 100;
  const stepN = stepNormalized ?? resolvedStep / span;
  const largeStepN = largeStepNormalized ?? (largeStep ?? span / 10) / span;
  const fineStepN = fineStepNormalized ?? (fineStep ?? resolvedStep / 10) / span;

  /**
   * Snap to the value grid and trim float dust.
   *
   * LOAD-BEARING, not cosmetic: the multiband-link branch of SET_BAND_PARAM
   * computes `delta = value - previous` and adds it to every non-bypassed band.
   * Unquantized keyboard repeat would accumulate float error across five bands.
   *
   * The grid is the FINEST step the control can produce, not the arrow step.
   * Snapping to the arrow step would round every Shift+Arrow fine adjustment
   * straight back to where it started, making fine mode a no-op.
   */
  const grid = step == null ? null : Math.min(step, fineStep ?? step);

  const quantize = useCallback(
    (v) => {
      const clamped = Math.max(min, Math.min(max, v));
      // Only snap when a value-unit grid was actually specified. Non-linear
      // ranges do their own rounding inside fromNormalized.
      if (grid == null) return Number(clamped.toFixed(6));
      const snapped = Math.round(clamped / grid) * grid;
      return Number(Math.max(min, Math.min(max, snapped)).toFixed(6));
    },
    [min, max, grid],
  );

  const valueRef = useRef(value);
  valueRef.current = value;

  const [isDragging, setDragging] = useState(false);
  const activePointer = useRef(null);
  const lastPos = useRef(null);
  // Unquantized drag position, so repeated quantization cannot cause drift.
  const accNorm = useRef(0);

  const axisProp = orientation === 'horizontal' ? 'clientX' : 'clientY';
  const ratioAxis = orientation === 'horizontal' ? 'x' : 'y';
  // Up and right increase; clientY grows downward, hence the sign flip.
  const sign = orientation === 'horizontal' ? 1 : -1;
  const pxToNorm = sensitivity / span;

  const commitNorm = useCallback(
    (n) => onChange(quantize(fromNorm(clamp01(n)))),
    [onChange, quantize, fromNorm],
  );

  const applyAbsolute = useCallback(
    (clientCoord) => {
      if (!trackRef?.current) return;
      commitNorm(localRatio(trackRef.current, clientCoord, ratioAxis));
    },
    [trackRef, ratioAxis, commitNorm],
  );

  const onPointerDown = useCallback(
    (e) => {
      if (disabled) return;
      if (e.button !== 0) return;                 // ignore right / middle
      if (activePointer.current !== null) return; // one pointer per control

      e.preventDefault();
      // preventDefault does not reliably move focus across browsers, and
      // "click the knob, then arrow-key it" is exactly what users expect.
      e.currentTarget.focus({ preventScroll: true });

      // Touch has no dblclick, so Alt+press is the portable reset gesture.
      if (e.altKey && defaultValue !== undefined) {
        onChange(quantize(defaultValue));
        return;
      }

      e.currentTarget.setPointerCapture(e.pointerId);
      activePointer.current = e.pointerId;
      lastPos.current = e[axisProp];
      accNorm.current = clamp01(toNorm(valueRef.current));
      setDragging(true);

      if (mode === 'absolute') applyAbsolute(e[axisProp]);
    },
    [disabled, defaultValue, onChange, quantize, axisProp, toNorm, mode, applyAbsolute],
  );

  const onPointerMove = useCallback(
    (e) => {
      // pointermove also fires on plain hover; this guard short-circuits it.
      if (e.pointerId !== activePointer.current) return;

      if (mode === 'absolute') {
        applyAbsolute(e[axisProp]);
        return;
      }

      // Accumulate incrementally so toggling Shift mid-drag affects only the
      // movement made while it is held.
      const deltaPx = (e[axisProp] - lastPos.current) * sign;
      lastPos.current = e[axisProp];
      const gain = pxToNorm * (e.shiftKey ? fineDragFactor : 1);
      accNorm.current = clamp01(accNorm.current + deltaPx * gain);
      commitNorm(accNorm.current);
    },
    [mode, applyAbsolute, axisProp, sign, pxToNorm, fineDragFactor, commitNorm],
  );

  const endDrag = useCallback(
    (e) => {
      if (e.pointerId !== activePointer.current) return;
      activePointer.current = null;
      lastPos.current = null;
      setDragging(false);
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      onCommit?.(valueRef.current);
    },
    [onCommit],
  );

  const onKeyDown = useCallback(
    (e) => {
      if (disabled) return;
      if (e.metaKey || e.ctrlKey) return;

      const current = clamp01(toNorm(valueRef.current));
      const small = e.shiftKey ? fineStepN : stepN;
      let next = null;

      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowRight':
          next = current + small;
          break;
        case 'ArrowDown':
        case 'ArrowLeft':
          next = current - small;
          break;
        case 'PageUp':
          next = current + largeStepN;
          break;
        case 'PageDown':
          next = current - largeStepN;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = 1;
          break;
        case 'Backspace':
        case 'Delete':
          // DAW convention for "reset to default". ARIA reserves Home/End for
          // min/max, so the default needs its own key.
          if (defaultValue === undefined) return;
          e.preventDefault();
          onChange(quantize(defaultValue));
          onCommit?.(defaultValue);
          return;
        default:
          return;
      }

      // Without this the page scrolls on ArrowDown/PageDown and jumps on End.
      e.preventDefault();
      commitNorm(next);
      onCommit?.(valueRef.current);
    },
    [
      disabled, toNorm, fineStepN, stepN, largeStepN, defaultValue,
      onChange, quantize, onCommit, commitNorm,
    ],
  );

  const onDoubleClick = useCallback(() => {
    if (disabled || defaultValue === undefined) return;
    onChange(quantize(defaultValue));
    onCommit?.(defaultValue);
  }, [disabled, defaultValue, onChange, quantize, onCommit]);

  const formatted = format ? format(value) : String(value);

  const rootProps = {
    role: 'slider',
    tabIndex: disabled ? -1 : 0,
    'aria-label': label,
    'aria-valuemin': min,
    'aria-valuemax': max,
    'aria-valuenow': quantize(value),
    // Raw numbers are meaningless for dB, Hz and ms parameters.
    'aria-valuetext': formatted,
    // 'vertical' is NOT the implicit default — it must be stated.
    'aria-orientation': orientation,
    'aria-disabled': disabled || undefined,
    onKeyDown,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    // Browsers release capture on some page-level interruptions; without this
    // isDragging would stick forever.
    onLostPointerCapture: endDrag,
    onDoubleClick,
    // Also set in CSS. Without it Chrome starts a scroll on touch, fires
    // pointercancel mid-drag, and the drag "randomly stops".
    style: { touchAction: 'none', ...callerStyle },
    'data-dragging': isDragging ? '' : undefined,
    'data-orientation': orientation,
  };

  return { rootProps, isDragging, formatted };
}
