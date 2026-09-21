import React from 'react';
import { SET_BAND_PARAM, TOGGLE_SOLO, TOGGLE_BYPASS, RESET_BAND } from '../App';
import { formatBandRange } from '../constants/bands';
import { effectiveTimeMs, formatMs } from '../constants/dspMapping';
import RotaryKnob from './ui/RotaryKnob';
import VerticalSlider from './ui/VerticalSlider';
import ToggleButton from './ui/ToggleButton';
import WaveformCanvas from './WaveformCanvas';
import useMeters, { gainDbToHeight } from '../hooks/useMeters';
import styles from './BandStrip.module.css';

const fmtSigned = (v) => `${v > 0 ? '+' : ''}${Math.round(v)}%`;
const fmtPercent = (v) => `${Math.round(v)}%`;

/** Amount knob plus its time modifier, under a shared heading. */
function ShaperGroup({ label, bandLabel, amount, time, timeMs, onAmountChange, onTimeChange }) {
  return (
    <div className={styles.group}>
      <span className={styles.groupLabel}>{label}</span>
      <div className={styles.groupKnobs}>
        <RotaryKnob
          value={amount}
          min={-100}
          max={100}
          size="md"
          defaultValue={0}
          format={fmtSigned}
          ariaLabel={`${bandLabel} band ${label} amount`}
          onChange={onAmountChange}
        />
        <RotaryKnob
          value={time}
          min={0}
          max={100}
          size="sm"
          defaultValue={50}
          // aria-valuenow stays the raw 0-100 scalar; aria-valuetext reports the
          // milliseconds it actually produces.
          format={() => formatMs(timeMs)}
          ariaLabel={`${bandLabel} band ${label} time`}
          onChange={onTimeChange}
        />
      </div>
    </div>
  );
}

export default function BandStrip({
  band, bandIndex, bandState, isDimmed, dispatch, getVizData, vizWritePositionsRef,
  metersRef, isRunning, waveformData, getPlaybackPosition, isPlaying, crossoverFreqs,
  showDelta, detectionSpeed,
}) {
  const setBandParam = (param, value) =>
    dispatch({ type: SET_BAND_PARAM, bandId: band.id, param, value });

  const meters = useMeters(metersRef, isRunning);
  // Gain CHANGE, not gain reduction: a band boosting its attack is working as
  // hard as one cutting its sustain, and the indicator should light for both.
  const gainDb = meters && meters.bandGainDb ? meters.bandGainDb[bandIndex] : 0;
  const gainIntensity = gainDbToHeight(gainDb, 6);   // full at +/-6 dB
  const range = formatBandRange(bandIndex, crossoverFreqs);

  const attackMs = effectiveTimeMs(band.id, 'attack', bandState.attackTime ?? 50, detectionSpeed);
  const sustainMs = effectiveTimeMs(band.id, 'sustain', bandState.sustainTime ?? 50, detectionSpeed);

  const stateLabel = bandState.bypass ? ', bypassed' : isDimmed ? ', dimmed by solo' : '';

  return (
    // Without the group label every band's Attack knob announces identically.
    <section
      className={styles.strip}
      aria-label={`${band.label} band, ${range}${stateLabel}`}
      data-active={!bandState.bypass && !isDimmed}
      style={{
        // Published once here; every descendant reads it from the cascade, so
        // no `color` prop has to be threaded through the primitives.
        '--band-accent': band.color,
        '--band-accent-dim': band.colorDim,
        '--band-opacity': bandState.bypass ? 0.45 : isDimmed ? 0.65 : 1,
      }}
    >
      <div className={styles.controls}>
        <div className={styles.identity}>
          <div className={styles.bandName}>{band.label.toUpperCase()}</div>
          <div className={styles.bandRange}>{range}</div>
        </div>

        <ShaperGroup
          label="Attack"
          bandLabel={band.label}
          amount={bandState.attack}
          time={bandState.attackTime ?? 50}
          timeMs={attackMs}
          onAmountChange={(v) => setBandParam('attack', v)}
          onTimeChange={(v) => setBandParam('attackTime', v)}
        />

        <ShaperGroup
          label="Sustain"
          bandLabel={band.label}
          amount={bandState.sustain}
          time={bandState.sustainTime ?? 50}
          timeMs={sustainMs}
          onAmountChange={(v) => setBandParam('sustain', v)}
          onTimeChange={(v) => setBandParam('sustainTime', v)}
        />

        <div className={styles.group}>
          <span className={styles.groupLabel}>Mix</span>
          <div className={styles.groupKnobs}>
            <RotaryKnob
              value={bandState.mix ?? 100}
              min={0}
              max={100}
              size="md"
              defaultValue={100}
              format={fmtPercent}
              ariaLabel={`${band.label} band mix`}
              onChange={(v) => setBandParam('mix', v)}
            />
          </div>
        </div>

        <div className={styles.gainColumn}>
          {/* Live at ~30 Hz, so it is hidden from assistive tech rather than
              announced continuously. The title serves sighted mouse users. */}
          <div
            aria-hidden="true"
            title={`Gain change: ${gainDb > 0 ? '+' : ''}${gainDb.toFixed(1)} dB`}
            className={styles.grDot}
            style={{
              opacity: 0.15 + gainIntensity * 0.85,
              boxShadow: gainIntensity > 0.05 ? '0 0 6px var(--band-accent)' : 'none',
            }}
          />
          <VerticalSlider
            value={bandState.outputGain}
            min={-30}
            max={6}
            label="Gain"
            ariaLabel={`${band.label} band output gain`}
            onChange={(v) => setBandParam('outputGain', v)}
          />
        </div>

        <div className={styles.toggles}>
          <ToggleButton
            active={bandState.solo}
            label="S"
            ariaLabel={`Solo ${band.label} band`}
            size="sm"
            onClick={() => dispatch({ type: TOGGLE_SOLO, bandId: band.id })}
          />
          <ToggleButton
            active={bandState.bypass}
            label="BYP"
            ariaLabel={`Bypass ${band.label} band`}
            size="sm"
            style={{ '--toggle-accent': 'var(--text-label)' }}
            onClick={() => dispatch({ type: TOGGLE_BYPASS, bandId: band.id })}
          />
        </div>
      </div>

      <button
        type="button"
        className={styles.reset}
        aria-label={`Reset ${band.label} band to defaults`}
        onClick={() => dispatch({ type: RESET_BAND, bandId: band.id })}
      >
        Reset
      </button>

      <div className={styles.waveform}>
        <WaveformCanvas
          band={band}
          bandIndex={bandIndex}
          bandState={bandState}
          getVizData={getVizData}
          vizWritePositionsRef={vizWritePositionsRef}
          isRunning={isRunning}
          waveformData={waveformData}
          getPlaybackPosition={getPlaybackPosition}
          isPlaying={isPlaying}
          showDelta={showDelta}
        />
      </div>
    </section>
  );
}
