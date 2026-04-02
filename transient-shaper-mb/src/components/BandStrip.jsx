import React from 'react';
import { colors, sizes } from '../styles/theme';
import { SET_BAND_PARAM, TOGGLE_SOLO, TOGGLE_BYPASS } from '../App';
import RotaryKnob from './ui/RotaryKnob';
import VerticalSlider from './ui/VerticalSlider';
import ToggleButton from './ui/ToggleButton';
import WaveformCanvas from './WaveformCanvas';
import { PlaceholderWrap } from './ui/PlaceholderBadge';

// Phase 3 — Single band row: controls panel + waveform display
export default function BandStrip({ band, bandIndex, bandState, isDimmed, dispatch, getVizData, vizWritePositionsRef }) {
  const setBandParam = (param, value) =>
    dispatch({ type: SET_BAND_PARAM, bandId: band.id, param, value });

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        border: `1px solid ${band.colorDim}`,
        opacity: bandState.bypass ? 0.4 : isDimmed ? 0.6 : 1,
        position: 'relative',
        transition: 'opacity 0.2s ease',
        boxShadow: !bandState.bypass && !isDimmed ? `inset 0 0 12px ${band.color}15` : 'none',
      }}
    >
      {/* Band label badge */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          backgroundColor: band.color,
          color: '#000',
          fontSize: 10,
          fontWeight: 'bold',
          textTransform: 'uppercase',
          padding: '2px 8px',
          zIndex: 1,
        }}
      >
        {band.label}
      </div>

      {/* Controls panel */}
      <div
        style={{
          width: sizes.controlsPanelWidth,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '16px 12px 8px 12px',
          gap: 8,
        }}
      >
        {/* 4 knobs in 2x2 grid: Attack pair (top), Sustain pair (bottom) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Attack group */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={knobGroupLabel}>Attack</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <RotaryKnob
                  value={bandState.attack}
                  min={-100}
                  max={100}
                  label=""
                  color={band.color}
                  size="md"
                  defaultValue={0}
                  onChange={(v) => setBandParam('attack', v)}
                />
                <span style={knobSubLabel}>Amount</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <RotaryKnob
                  value={bandState.attackTime ?? 50}
                  min={0}
                  max={100}
                  label=""
                  color={band.color}
                  size="md"
                  defaultValue={50}
                  onChange={(v) => setBandParam('attackTime', v)}
                />
                <span style={knobSubLabel}>Time</span>
              </div>
            </div>
          </div>
          {/* Sustain group */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={knobGroupLabel}>Sustain</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <RotaryKnob
                  value={bandState.sustain}
                  min={-100}
                  max={100}
                  label=""
                  color={band.color}
                  size="md"
                  defaultValue={0}
                  onChange={(v) => setBandParam('sustain', v)}
                />
                <span style={knobSubLabel}>Amount</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <RotaryKnob
                  value={bandState.sustainTime ?? 50}
                  min={0}
                  max={100}
                  label=""
                  color={band.color}
                  size="md"
                  defaultValue={50}
                  onChange={(v) => setBandParam('sustainTime', v)}
                />
                <span style={knobSubLabel}>Time</span>
              </div>
            </div>
          </div>
        </div>

        {/* Output Gain section */}
        <PlaceholderWrap reason="NO DSP" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}>
          <VerticalSlider
            value={bandState.outputGain}
            min={-30}
            max={6}
            label="Output Gain"
            color={band.color}
            onChange={(v) => setBandParam('outputGain', v)}
          />
        </PlaceholderWrap>

        {/* Solo / Bypass buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 4 }}>
          <ToggleButton
            active={bandState.solo}
            label="Solo"
            color={band.color}
            onClick={() => dispatch({ type: TOGGLE_SOLO, bandId: band.id })}
            style={{ fontSize: 8, padding: '3px 8px' }}
          />
          <ToggleButton
            active={bandState.bypass}
            label="Bypass"
            color="#888"
            onClick={() => dispatch({ type: TOGGLE_BYPASS, bandId: band.id })}
            style={{ fontSize: 8, padding: '3px 8px' }}
          />
        </div>
      </div>

      {/* Waveform area */}
      <div style={{ flex: 1, backgroundColor: colors.waveformBg }}>
        <WaveformCanvas
          band={band}
          bandIndex={bandIndex}
          bandState={bandState}
          getVizData={getVizData}
          vizWritePositionsRef={vizWritePositionsRef}
        />
      </div>
    </div>
  );
}

const knobGroupLabel = {
  fontSize: 8,
  textTransform: 'uppercase',
  color: '#666',
  letterSpacing: '1px',
  textAlign: 'center',
};

const knobSubLabel = {
  fontSize: 7,
  textTransform: 'uppercase',
  color: '#555',
  letterSpacing: '0.5px',
  marginTop: 1,
};
