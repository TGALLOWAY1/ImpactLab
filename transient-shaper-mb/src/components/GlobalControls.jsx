import React from 'react';
import { sizes } from '../styles/theme';
import { SET_GLOBAL_PARAM } from '../App';
import RotaryKnob from './ui/RotaryKnob';
import SpeedSelector from './ui/SpeedSelector';
import ToggleButton from './ui/ToggleButton';
import CrossoverEditor from './CrossoverEditor';
import DetectionMethodSelector from './DetectionMethodSelector';
import { BANDS } from '../constants/bands';

export default function GlobalControls({ state, dispatch }) {
  const setParam = (param, value) => dispatch({ type: SET_GLOBAL_PARAM, param, value });

  return (
    <div
      style={{
        height: sizes.globalBarHeight,
        background: 'linear-gradient(180deg, #101a2d, #0c1424)',
        borderTop: '1px solid #243148',
        borderBottom: '1px solid #243148',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        flexShrink: 0,
        gap: 10,
      }}
    >
      <RotaryKnob value={state.inputGain} min={-30} max={12} label="Input" color="#fff" size="sm" defaultValue={0} onChange={(v) => setParam('inputGain', v)} />
      <RotaryKnob value={state.outputGain} min={-30} max={12} label="Output" color="#fff" size="sm" defaultValue={0} onChange={(v) => setParam('outputGain', v)} />

      <SpeedSelector value={state.detectionSpeed} onChange={(v) => setParam('detectionSpeed', v)} />
      <DetectionMethodSelector value={state.detectionMethod || 'dual-envelope'} onChange={(v) => setParam('detectionMethod', v)} />

      <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, textTransform: 'uppercase', color: state.multibandLink ? '#fff' : '#7d8ca8', cursor: 'pointer', letterSpacing: '1px', whiteSpace: 'nowrap' }}>
        Multiband Link
        <input type="checkbox" checked={state.multibandLink} onChange={() => setParam('multibandLink', !state.multibandLink)} style={{ accentColor: '#5ECA89', cursor: 'pointer' }} />
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 8, color: '#7d8ca8', textTransform: 'uppercase' }}>Dry</span>
        <RotaryKnob value={state.mix} min={0} max={100} label="Mix" color="#fff" size="lg" defaultValue={100} onChange={(v) => setParam('mix', v)} />
        <span style={{ fontSize: 8, color: '#7d8ca8', textTransform: 'uppercase' }}>Wet</span>
      </div>

      <div style={{ flex: 1, maxWidth: 250, minWidth: 140 }}>
        <CrossoverEditor freqs={state.crossoverFreqs} bands={BANDS} onChange={(freqs) => setParam('crossoverFreqs', freqs)} />
      </div>

      <ToggleButton active={state.delta} label="Delta" color="#9a6dff" onClick={() => setParam('delta', !state.delta)} />
      <ToggleButton active={state.softClip} label="Soft Clip" color="#5ECA89" onClick={() => setParam('softClip', !state.softClip)} />
      <ToggleButton active={state.lookahead} label="Lookahead" color="#5BC0EB" onClick={() => setParam('lookahead', !state.lookahead)} />
    </div>
  );
}
