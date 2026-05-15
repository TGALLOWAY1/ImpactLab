import React from 'react';
import { colors, sizes } from '../styles/theme';
import { SET_BAND_PARAM, TOGGLE_SOLO, TOGGLE_BYPASS, RESET_BAND } from '../App';
import { formatBandRange } from '../constants/bands';
import RotaryKnob from './ui/RotaryKnob';
import VerticalSlider from './ui/VerticalSlider';
import ToggleButton from './ui/ToggleButton';
import WaveformCanvas from './WaveformCanvas';
import useMeters, { grDbToHeight } from '../hooks/useMeters';

export default function BandStrip({ band, bandIndex, bandState, isDimmed, dispatch, getVizData, vizWritePositionsRef, metersRef, isRunning, waveformData, getPlaybackPosition, isPlaying, crossoverFreqs, showDelta }) {
  const setBandParam = (param, value) => dispatch({ type: SET_BAND_PARAM, bandId: band.id, param, value });
  const meters = useMeters(metersRef, isRunning);
  const grDb = meters && meters.bandGrDb ? meters.bandGrDb[bandIndex] : 0;
  const grIntensity = grDbToHeight(grDb, -6); // 0..1, full at -6 dB
  const range = formatBandRange(bandIndex, crossoverFreqs);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        borderBottom: `1px solid ${band.colorDim}`,
        opacity: bandState.bypass ? 0.45 : isDimmed ? 0.65 : 1,
        position: 'relative',
        transition: 'opacity 0.2s ease',
        background: 'linear-gradient(180deg, #0f1628, #0a1221)',
        boxShadow: !bandState.bypass && !isDimmed ? `inset 0 0 14px ${band.color}20` : 'none',
      }}
    >
      <div style={{ width: sizes.controlsPanelWidth, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '8px 10px', gap: 10, borderRight: `1px solid ${band.colorDim}` }}>
        <div style={{ width: 120 }}>
          <div style={{ color: band.color, fontSize: 30, lineHeight: 1, fontWeight: 600 }}>{band.label.toUpperCase()}</div>
          <div style={{ color: '#7e8ead', fontSize: 13, marginTop: 2 }}>{range}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <RotaryKnob value={bandState.attack} min={-100} max={100} label="Attack" color={band.color} size="md" defaultValue={0} onChange={(v) => setBandParam('attack', v)} />
          <span style={valueStyle}>{fmtSigned(bandState.attack)}%</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <RotaryKnob value={bandState.sustain} min={-100} max={100} label="Sustain" color={band.color} size="md" defaultValue={0} onChange={(v) => setBandParam('sustain', v)} />
          <span style={valueStyle}>{fmtSigned(bandState.sustain)}%</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <RotaryKnob value={bandState.mix ?? 100} min={0} max={100} label="Mix" color={band.color} size="md" defaultValue={100} onChange={(v) => setBandParam('mix', v)} />
          <span style={valueStyle}>{Math.round(bandState.mix ?? 100)}%</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div
            title={`GR: ${grDb.toFixed(1)} dB`}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: band.color,
              opacity: 0.15 + grIntensity * 0.85,
              boxShadow: grIntensity > 0.05 ? `0 0 6px ${band.color}` : 'none',
              transition: 'opacity 50ms linear',
            }}
          />
          <VerticalSlider value={bandState.outputGain} min={-30} max={6} label="Gain" color={band.color} onChange={(v) => setBandParam('outputGain', v)} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <ToggleButton active={bandState.solo} label="S" color={band.color} onClick={() => dispatch({ type: TOGGLE_SOLO, bandId: band.id })} style={{ fontSize: 10, padding: '3px 8px' }} />
          <ToggleButton active={bandState.bypass} label="BYP" color="#9096ad" onClick={() => dispatch({ type: TOGGLE_BYPASS, bandId: band.id })} style={{ fontSize: 8, padding: '4px 6px' }} />
        </div>
      </div>

      <button
        onClick={() => dispatch({ type: RESET_BAND, bandId: band.id })}
        style={{ position: 'absolute', top: 8, right: 8, background: 'transparent', border: `1px solid ${band.colorDim}`, borderRadius: 3, color: '#7c8eaf', fontSize: 9, letterSpacing: '1px', textTransform: 'uppercase', padding: '2px 8px', cursor: 'pointer', zIndex: 1, fontFamily: 'inherit' }}
      >
        Reset
      </button>

      <div style={{ flex: 1, backgroundColor: colors.waveformBg }}>
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
    </div>
  );
}

const valueStyle = { fontSize: 11, color: '#afbdd8', marginTop: 1 };
const fmtSigned = (v) => (v > 0 ? `+${Math.round(v)}` : `${Math.round(v)}`);
