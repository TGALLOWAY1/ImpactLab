import React from 'react';
import RotaryKnob from './ui/RotaryKnob';
import useMeters, { linearToMeterHeight, gainDbToHeight } from '../hooks/useMeters';

export default function RightPanel({ state, setGlobalParam, metersRef, isRunning }) {
  const meters = useMeters(metersRef, isRunning);

  // Stereo bars use max(L, R) of peak with RMS underlay. When idle, height = 0.
  const inH = meters
    ? linearToMeterHeight(Math.max(meters.inPeakL, meters.inPeakR))
    : 0;
  const outH = meters
    ? linearToMeterHeight(Math.max(meters.outPeakL, meters.outPeakR))
    : 0;
  // Gain-change meter: how hard the shaper is working, boosting or cutting.
  const gainDb = meters ? meters.gainDb : 0;
  const gainH = gainDbToHeight(gainDb);
  const isBoost = gainDb > 0;

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

  const heights = [inH, outH, gainH];
  // Boost and cut are drawn in different colors so the direction of the
  // shaping is readable at a glance, not just its magnitude.
  const gainFill = isBoost
    ? 'linear-gradient(180deg, #7de08a 0%, #46c46a 100%)'
    : 'linear-gradient(180deg, #ff5a5a 0%, #f6b84f 60%, #f6b84f 100%)';

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
        {['IN', 'OUT', 'GAIN'].map((label, idx) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#98a6c0', marginBottom: 8, letterSpacing: 1 }}>{label}</div>
            <div
              style={meterStyle()}
              title={idx === 2 ? `Shaper gain change: ${gainDb > 0 ? '+' : ''}${gainDb.toFixed(1)} dB` : undefined}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 1,
                  right: 1,
                  bottom: 1,
                  height: `${Math.round(heights[idx] * 100)}%`,
                  background: idx === 2
                    ? gainFill
                    : 'linear-gradient(180deg, #ff5a5a 0%, #f6b84f 20%, #60d86d 45%, #2ab552 100%)',
                  transition: 'height 50ms linear',
                }}
              />
            </div>
            {idx === 2 && (
              <div style={{ fontSize: 9, color: isBoost ? '#7de08a' : '#f6b84f', marginTop: 4, letterSpacing: 0.5 }}>
                {gainDb > 0 ? '+' : ''}{gainDb.toFixed(1)}
              </div>
            )}
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

      {/* "Clip Guard" and "Soften" used to live here, but they wrote to the
          same softClip and mix parameters as the global bar's "Soft Clip" and
          "Mix" — two names for one control, moving in lockstep with no way to
          tell they were linked. The global bar owns both now. */}
    </aside>
  );
}
