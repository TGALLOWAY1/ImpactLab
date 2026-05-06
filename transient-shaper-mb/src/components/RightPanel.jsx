import React from 'react';
import RotaryKnob from './ui/RotaryKnob';
import ToggleButton from './ui/ToggleButton';
import useMeters, { linearToMeterHeight, grDbToHeight } from '../hooks/useMeters';

export default function RightPanel({ state, setGlobalParam, metersRef, isRunning }) {
  const meters = useMeters(metersRef, isRunning);

  // Stereo bars use max(L, R) of peak with RMS underlay. When idle, height = 0.
  const inH = meters
    ? linearToMeterHeight(Math.max(meters.inPeakL, meters.inPeakR))
    : 0;
  const outH = meters
    ? linearToMeterHeight(Math.max(meters.outPeakL, meters.outPeakR))
    : 0;
  const grH = meters ? grDbToHeight(meters.grDb) : 0;

  const meterStyle = () => ({
    width: 14,
    height: 250,
    borderRadius: 3,
    border: '1px solid #2a3348',
    background: '#0a1020',
    overflow: 'hidden',
    position: 'relative',
    boxShadow: 'inset 0 0 10px rgba(0,0,0,0.55)',
  });

  const heights = [inH, outH, grH];

  return (
    <aside
      style={{
        width: 170,
        borderLeft: '1px solid #23304a',
        background: 'linear-gradient(180deg, #0f1829, #0a1121)',
        padding: '14px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-evenly', gap: 8 }}>
        {['IN', 'OUT', 'GR'].map((label, idx) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#98a6c0', marginBottom: 8, letterSpacing: 1 }}>{label}</div>
            <div style={meterStyle()}>
              <div
                style={{
                  position: 'absolute',
                  left: 1,
                  right: 1,
                  bottom: 1,
                  height: `${Math.round(heights[idx] * 100)}%`,
                  background: idx === 2
                    ? 'linear-gradient(180deg, #ff5a5a 0%, #f6b84f 60%, #f6b84f 100%)'
                    : 'linear-gradient(180deg, #ff5a5a 0%, #f6b84f 20%, #60d86d 45%, #2ab552 100%)',
                  transition: 'height 50ms linear',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: '1px solid #263247', paddingTop: 12 }}>
        <div style={{ fontSize: 11, color: '#95a4bf', letterSpacing: 1.2, marginBottom: 6 }}>GLOBAL</div>
        <RotaryKnob
          value={state.outputGain}
          min={-30}
          max={12}
          label="Output"
          color="#ffffff"
          defaultValue={0}
          onChange={(v) => setGlobalParam('outputGain', v)}
        />
      </div>

      <ToggleButton
        active={state.softClip}
        label="Clip Guard"
        color="#9f78ff"
        onClick={() => setGlobalParam('softClip', !state.softClip)}
      />

      <div style={{ marginTop: 6 }}>
        <RotaryKnob
          value={state.mix}
          min={0}
          max={100}
          label="Soften"
          color="#ccccff"
          defaultValue={100}
          onChange={(v) => setGlobalParam('mix', v)}
        />
      </div>
    </aside>
  );
}
