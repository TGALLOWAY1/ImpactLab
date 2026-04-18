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

// Plugin header: title, preset picker, A/B compare, global session helpers.
export default function Header({ presetName, abSlot, anySoloed, dispatch }) {
  return (
    <div
      style={{
        height: sizes.headerHeight,
        backgroundColor: colors.headerBg,
        borderBottom: `1px solid ${colors.headerBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
        gap: 12,
      }}
    >
      {/* Left: Plugin title with bars icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 18 }}>
          {[10, 14, 18, 12].map((h, i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: h,
                backgroundColor: '#888',
                borderRadius: 1,
              }}
            />
          ))}
        </div>
        <span style={{
          fontSize: sizes.fontTitle,
          letterSpacing: typography.titleLetterSpacing,
          color: colors.textPrimary,
        }}>
          <span style={{ fontWeight: 'bold' }}>TRANSIENT</span>
          <span style={{ fontWeight: 300, marginLeft: 6 }}>SHAPER MB</span>
        </span>
      </div>

      {/* Center: preset picker + workflow helpers */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <PresetPicker
          presetName={presetName}
          onSelect={(name) => dispatch({ type: LOAD_PRESET, name })}
        />

        <Divider />

        <ABCompare
          abSlot={abSlot}
          onSwitch={() => dispatch({ type: SWITCH_AB_SLOT })}
          onCopy={() => dispatch({ type: COPY_AB_SLOT })}
        />

        <Divider />

        {anySoloed && (
          <SmallButton
            label="Unsolo"
            onClick={() => dispatch({ type: UNSOLO_ALL })}
            title="Clear all solo flags"
          />
        )}
        <SmallButton
          label="Reset"
          onClick={() => {
            if (window.confirm('Reset all bands and global controls to defaults?')) {
              dispatch({ type: RESET_ALL });
            }
          }}
          title="Reset all parameters to defaults"
        />
      </div>

      {/* Right: Sub-title */}
      <span style={{
        fontSize: 14,
        letterSpacing: typography.titleLetterSpacing,
        color: colors.textPrimary,
        fontWeight: 300,
      }}>
        TRANSIENT DESIGNER
      </span>
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

  const label = presetName || 'Custom';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          ...pickerBase,
          minWidth: 150,
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
        title="Load preset"
      >
        <span style={{ color: '#aaa', fontSize: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
          Preset
        </span>
        <span style={{ color: '#fff', flex: 1, marginLeft: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <span style={{ color: '#888', fontSize: 9 }}>{'\u25BE'}</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: '#1A1A22',
            border: '1px solid #333',
            borderRadius: 4,
            minWidth: 240,
            zIndex: 50,
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            padding: 4,
          }}
        >
          {PRESETS.map((preset) => {
            const active = preset.name === presetName;
            return (
              <button
                key={preset.name}
                onClick={() => {
                  onSelect(preset.name);
                  setOpen(false);
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: active ? '#2a3a5a' : 'transparent',
                  border: 'none',
                  color: active ? '#fff' : '#ccc',
                  padding: '6px 10px',
                  borderRadius: 3,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 600 }}>{preset.name}</div>
                <div style={{ fontSize: 9, color: '#888', marginTop: 1 }}>{preset.description}</div>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 8, color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
        A/B
      </span>
      <button
        onClick={onSwitch}
        style={{
          ...pickerBase,
          background: abSlot === 'A' ? '#2a3a5a' : '#333',
          color: abSlot === 'A' ? '#fff' : '#888',
          minWidth: 28,
          fontWeight: abSlot === 'A' ? 'bold' : 'normal',
        }}
        title="Toggle A/B — click to switch to the other slot"
      >
        {abSlot === 'A' ? 'A' : 'B'}
      </button>
      <button
        onClick={onCopy}
        style={{
          ...pickerBase,
          background: '#2A2A30',
          color: '#aaa',
          fontSize: 9,
          padding: '4px 6px',
        }}
        title={`Copy current settings to the ${abSlot === 'A' ? 'B' : 'A'} slot`}
      >
        {abSlot === 'A' ? 'A→B' : 'B→A'}
      </button>
    </div>
  );
}

function SmallButton({ label, onClick, title }) {
  return (
    <button onClick={onClick} title={title} style={pickerBase}>
      {label}
    </button>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 20, background: '#333' }} />;
}

const pickerBase = {
  background: '#2A2A30',
  color: '#ccc',
  border: '1px solid #3a3a44',
  borderRadius: 3,
  padding: '5px 10px',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontFamily: 'inherit',
  outline: 'none',
  whiteSpace: 'nowrap',
};
