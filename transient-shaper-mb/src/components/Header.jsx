import React, { useRef, useState, useEffect } from 'react';
import { colors, sizes, typography } from '../styles/theme';
import { PRESETS } from '../constants/presets';
import {
  LOAD_PRESET,
  SWITCH_AB_SLOT,
  COPY_AB_SLOT,
  RESET_ALL,
  UNSOLO_ALL,
} from '../App';

export default function Header({ presetName, abSlot, anySoloed, dispatch }) {
  return (
    <div
      style={{
        height: sizes.headerHeight,
        background: 'linear-gradient(180deg, #0d1424, #0b1220)',
        borderBottom: '1px solid #22304a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        flexShrink: 0,
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid #394c72', display: 'grid', placeItems: 'center', color: '#8ca4d4' }}>◔</div>
        <span style={{ fontSize: 30, letterSpacing: typography.titleLetterSpacing, color: '#f0f4ff', fontWeight: 300 }}>
          <span style={{ fontWeight: 700 }}>TRANSIENT</span> SHAPER MB
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <PresetPicker presetName={presetName} onSelect={(name) => dispatch({ type: LOAD_PRESET, name })} />
        <ABCompare abSlot={abSlot} onSwitch={() => dispatch({ type: SWITCH_AB_SLOT })} onCopy={() => dispatch({ type: COPY_AB_SLOT })} />
        {anySoloed && <SmallButton label="Unsolo" onClick={() => dispatch({ type: UNSOLO_ALL })} />}
        <SmallButton
          label="Reset"
          onClick={() => {
            if (window.confirm('Reset all bands and global controls to defaults?')) dispatch({ type: RESET_ALL });
          }}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <SmallButton label="Bypass" />
        <div style={{ color: '#8ea0c0', fontSize: 18 }}>⚙</div>
      </div>
    </div>
  );
}

function PresetPicker({ presetName, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const label = presetName || 'Punch and Clarity';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} style={{ ...pickerBase, minWidth: 260, justifyContent: 'center', display: 'flex' }}>
        {label}
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#121b2f', border: '1px solid #33476e', borderRadius: 4, minWidth: 260, zIndex: 50, boxShadow: '0 4px 16px rgba(0,0,0,0.6)', padding: 4 }}>
          {PRESETS.map((preset) => {
            const active = preset.name === presetName;
            return (
              <button
                key={preset.name}
                onClick={() => {
                  onSelect(preset.name);
                  setOpen(false);
                }}
                style={{ display: 'block', width: '100%', textAlign: 'left', background: active ? '#293a5e' : 'transparent', border: 'none', color: active ? '#fff' : '#c5d0e6', padding: '6px 10px', borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {preset.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ABCompare({ abSlot, onSwitch, onCopy }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button onClick={onSwitch} style={{ ...pickerBase, minWidth: 40 }}>{abSlot}</button>
      <button onClick={onCopy} style={{ ...pickerBase, minWidth: 54, color: '#9ba9c2' }}>{abSlot === 'A' ? 'A > B' : 'B > A'}</button>
    </div>
  );
}

function SmallButton({ label, onClick }) {
  return <button onClick={onClick} style={pickerBase}>{label}</button>;
}

const pickerBase = {
  background: '#111c31',
  color: colors.textPrimary,
  border: '1px solid #34486f',
  borderRadius: 4,
  padding: '7px 12px',
  fontSize: 11,
  letterSpacing: '0.8px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
};
