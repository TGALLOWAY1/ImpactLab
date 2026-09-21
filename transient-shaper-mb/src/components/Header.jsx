import React, { useRef, useState, useEffect } from 'react';
import { PRESETS } from '../constants/presets';
import {
  LOAD_PRESET,
  SWITCH_AB_SLOT,
  COPY_AB_SLOT,
  RESET_ALL,
  UNSOLO_ALL,
  SET_GLOBAL_PARAM,
} from '../App';
import styles from './Header.module.css';

export default function Header({ presetName, abSlot, anySoloed, globalBypass, dispatch }) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <div className={styles.mark} aria-hidden="true">{'◔'}</div>
        <h1 className={styles.wordmark}>
          <strong>TRANSIENT</strong> SHAPER MB
        </h1>
      </div>

      <div className={styles.presets}>
        <PresetPicker
          presetName={presetName}
          onSelect={(name) => dispatch({ type: LOAD_PRESET, name })}
        />
        <ABCompare
          abSlot={abSlot}
          onSwitch={() => dispatch({ type: SWITCH_AB_SLOT })}
          onCopy={() => dispatch({ type: COPY_AB_SLOT })}
        />
        {anySoloed && (
          <ActionButton label="Unsolo" onClick={() => dispatch({ type: UNSOLO_ALL })} />
        )}
        <ActionButton
          label="Reset"
          ariaLabel="Reset all bands and global controls"
          onClick={() => {
            if (window.confirm('Reset all bands and global controls to defaults?')) {
              dispatch({ type: RESET_ALL });
            }
          }}
        />
      </div>

      <div className={styles.actions}>
        <ToggleAction
          label="Bypass"
          ariaLabel="Bypass the whole plugin"
          active={globalBypass}
          onClick={() =>
            dispatch({ type: SET_GLOBAL_PARAM, param: 'globalBypass', value: !globalBypass })
          }
        />
      </div>
    </header>
  );
}

function PresetPicker({ presetName, onSelect }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const itemRefs = useRef([]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Move focus into the list when it opens so it is usable without a mouse.
  useEffect(() => {
    if (!open) return;
    const index = Math.max(0, PRESETS.findIndex((p) => p.name === presetName));
    itemRefs.current[index]?.focus();
  }, [open, presetName]);

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  const onMenuKeyDown = (e, index) => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'ArrowDown':
        e.preventDefault();
        itemRefs.current[(index + 1) % PRESETS.length]?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        itemRefs.current[(index - 1 + PRESETS.length) % PRESETS.length]?.focus();
        break;
      case 'Home':
        e.preventDefault();
        itemRefs.current[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        itemRefs.current[PRESETS.length - 1]?.focus();
        break;
      default:
    }
  };

  // The reducer nulls presetName on any edit (markDirty). Previously this fell
  // back to the literal string 'Punch and Clarity', so touching one knob made
  // the header claim a preset the user had never loaded.
  const isDirty = presetName == null;
  const label = isDirty ? 'Custom' : presetName;

  return (
    <div ref={wrapRef} className={styles.menuWrap}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.button} ${styles.presetTrigger}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Preset: ${label}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className={isDirty ? styles.dirty : undefined}>{label}</span>
      </button>

      {open && (
        <div className={styles.menu} role="listbox" aria-label="Presets">
          {PRESETS.map((preset, i) => (
            <button
              key={preset.name}
              ref={(el) => { itemRefs.current[i] = el; }}
              type="button"
              role="option"
              aria-selected={preset.name === presetName}
              className={styles.menuItem}
              onKeyDown={(e) => onMenuKeyDown(e, i)}
              onClick={() => {
                onSelect(preset.name);
                close();
              }}
            >
              {preset.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ABCompare({ abSlot, onSwitch, onCopy }) {
  const other = abSlot === 'A' ? 'B' : 'A';
  return (
    <div className={styles.presets} role="group" aria-label="A/B comparison">
      <button
        type="button"
        className={styles.button}
        aria-label={`Slot ${abSlot} active. Switch to slot ${other}`}
        onClick={onSwitch}
      >
        {abSlot}
      </button>
      <button
        type="button"
        className={styles.button}
        aria-label={`Copy slot ${abSlot} settings to slot ${other}`}
        title={`Copy ${abSlot} to ${other}`}
        onClick={onCopy}
      >
        {`${abSlot} > ${other}`}
      </button>
    </div>
  );
}

/** A one-shot command. Deliberately has no aria-pressed — it is not a toggle. */
function ActionButton({ label, ariaLabel, onClick }) {
  return (
    <button type="button" className={styles.button} aria-label={ariaLabel} onClick={onClick}>
      {label}
    </button>
  );
}

/** A real two-state control, so aria-pressed is meaningful here. */
function ToggleAction({ label, ariaLabel, active, onClick }) {
  return (
    <button
      type="button"
      className={styles.button}
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
