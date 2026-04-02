import React from 'react';
import { colors, sizes } from '../styles/theme';
import { SET_GLOBAL_PARAM } from '../App';
import RotaryKnob from './ui/RotaryKnob';
import SpeedSelector from './ui/SpeedSelector';
import ToggleButton from './ui/ToggleButton';
import CrossoverEditor from './CrossoverEditor';
import DetectionMethodSelector from './DetectionMethodSelector';
import { BANDS } from '../constants/bands';

// Phase 2 — Global controls bar
export default function GlobalControls({ state, dispatch }) {
  const setParam = (param, value) => dispatch({ type: SET_GLOBAL_PARAM, param, value });

  return (
    <div
      style={{
        height: sizes.globalBarHeight,
        backgroundColor: colors.globalBarBg,
        borderTop: '1px solid #333',
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        flexShrink: 0,
        gap: 12,
      }}
    >
      {/* Input Gain */}
      <RotaryKnob
        value={state.inputGain}
        min={-30}
        max={12}
        label="Input Gain"
        color="#fff"
        size="sm"
        defaultValue={0}
        onChange={(v) => setParam('inputGain', v)}
      />

      {/* Detection Speed */}
      <SpeedSelector
        value={state.detectionSpeed}
        onChange={(v) => setParam('detectionSpeed', v)}
      />

      {/* Detection Method */}
      <DetectionMethodSelector
        value={state.detectionMethod || 'dual-envelope'}
        onChange={(v) => setParam('detectionMethod', v)}
      />

      {/* Multiband Link */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 9,
          textTransform: 'uppercase',
          color: state.multibandLink ? '#fff' : '#888',
          cursor: 'pointer',
          letterSpacing: '1px',
          whiteSpace: 'nowrap',
        }}
      >
        Multiband Link
        <input
          type="checkbox"
          checked={state.multibandLink}
          onChange={() => setParam('multibandLink', !state.multibandLink)}
          style={{ accentColor: '#5ECA89', cursor: 'pointer' }}
        />
      </label>

      {/* Mix knob (larger, centered) with Dry/Wet labels */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>Dry</span>
        <RotaryKnob
          value={state.mix}
          min={0}
          max={100}
          label="Mix"
          color="#fff"
          size="lg"
          defaultValue={100}
          onChange={(v) => setParam('mix', v)}
        />
        <span style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>Wet</span>
      </div>

      {/* Crossover Frequency Editor */}
      <div style={{ flex: 1, maxWidth: 200, minWidth: 120 }}>
        <CrossoverEditor
          freqs={state.crossoverFreqs}
          bands={BANDS}
          onChange={(freqs) => setParam('crossoverFreqs', freqs)}
        />
      </div>

      {/* Delta */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <span style={{ fontSize: 7, color: '#555', textAlign: 'center', lineHeight: 1.2 }}>
          (hear only<br />processed signal)
        </span>
        <ToggleButton
          active={state.delta}
          label="Delta"
          color="#D4A847"
          onClick={() => setParam('delta', !state.delta)}
        />
      </div>

      {/* Soft Clip */}
      <ToggleButton
        active={state.softClip}
        label="Soft Clip"
        color="#5ECA89"
        onClick={() => setParam('softClip', !state.softClip)}
      />

      {/* Lookahead */}
      <ToggleButton
        active={state.lookahead}
        label="Lookahead"
        color="#5BC0EB"
        onClick={() => setParam('lookahead', !state.lookahead)}
      />
    </div>
  );
}
