import React from 'react';
import { SET_GLOBAL_PARAM } from '../App';
import RotaryKnob from './ui/RotaryKnob';
import SpeedSelector from './ui/SpeedSelector';
import ToggleButton from './ui/ToggleButton';
import CrossoverEditor from './CrossoverEditor';
import DetectionMethodSelector from './DetectionMethodSelector';
import styles from './GlobalControls.module.css';

const fmtDb = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;
const fmtPercent = (v) => `${Math.round(v)}%`;

export default function GlobalControls({ state, dispatch }) {
  const setParam = (param, value) => dispatch({ type: SET_GLOBAL_PARAM, param, value });

  return (
    <div className={styles.bar}>
      <div className={styles.gainPair} role="group" aria-label="Gain staging">
        <RotaryKnob
          value={state.inputGain}
          min={-30}
          max={12}
          label="Input"
          ariaLabel="Input gain"
          size="sm"
          defaultValue={0}
          step={0.5}
          largeStep={6}
          format={fmtDb}
          onChange={(v) => setParam('inputGain', v)}
        />
        <RotaryKnob
          value={state.outputGain}
          min={-30}
          max={12}
          label="Output"
          ariaLabel="Output gain"
          size="sm"
          defaultValue={0}
          step={0.5}
          largeStep={6}
          format={fmtDb}
          onChange={(v) => setParam('outputGain', v)}
        />
      </div>

      <SpeedSelector value={state.detectionSpeed} onChange={(v) => setParam('detectionSpeed', v)} />
      <DetectionMethodSelector
        value={state.detectionMethod || 'dual-envelope'}
        onChange={(v) => setParam('detectionMethod', v)}
      />

      <label className={styles.link}>
        Multiband Link
        <input
          type="checkbox"
          checked={state.multibandLink}
          onChange={() => setParam('multibandLink', !state.multibandLink)}
        />
      </label>

      <div className={styles.mixGroup}>
        <span className={styles.mixEdge} aria-hidden="true">Dry</span>
        <RotaryKnob
          value={state.mix}
          min={0}
          max={100}
          label="Mix"
          ariaLabel="Dry/wet mix"
          size="lg"
          defaultValue={100}
          format={fmtPercent}
          onChange={(v) => setParam('mix', v)}
        />
        <span className={styles.mixEdge} aria-hidden="true">Wet</span>
      </div>

      <div className={styles.crossover}>
        <CrossoverEditor
          freqs={state.crossoverFreqs}
          onChange={(freqs) => setParam('crossoverFreqs', freqs)}
        />
      </div>

      <div className={styles.toggles}>
        <ToggleButton
          active={state.delta}
          label="Delta"
          ariaLabel="Delta — hear only the processed difference"
          style={{ '--toggle-accent': 'var(--accent-delta)' }}
          onClick={() => setParam('delta', !state.delta)}
        />
        <ToggleButton
          active={state.softClip}
          label="Soft Clip"
          style={{ '--toggle-accent': 'var(--accent-clip)' }}
          onClick={() => setParam('softClip', !state.softClip)}
        />
        <ToggleButton
          active={state.lookahead}
          label="Lookahead"
          style={{ '--toggle-accent': 'var(--accent-lookahead)' }}
          onClick={() => setParam('lookahead', !state.lookahead)}
        />
      </div>
    </div>
  );
}
