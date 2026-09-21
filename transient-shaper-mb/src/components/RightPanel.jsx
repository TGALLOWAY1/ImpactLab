import React from 'react';
import useMeters, { linearToMeterHeight, gainDbToHeight } from '../hooks/useMeters';
import styles from './RightPanel.module.css';

/**
 * Master metering rail.
 *
 * This used to also carry a "Soften" knob and a "Clip Guard" toggle, which were
 * second controls bound to the same `mix` and `softClip` state as the global
 * bar's "Mix" and "Soft Clip" — two names for one parameter, moving in lockstep
 * with no explanation. Both are gone; the global bar holds the canonical
 * controls. The global Output knob moved there too, next to Input.
 *
 * The third meter reads the shaper's gain CHANGE, not gain reduction: a
 * transient shaper boosting an attack is working just as hard as one cutting a
 * sustain, and both should register. Direction is carried by colour, magnitude
 * by height.
 */
export default function RightPanel({ metersRef, isRunning }) {
  const meters = useMeters(metersRef, isRunning);

  const gainDb = meters ? meters.gainDb : 0;
  const isBoost = gainDb > 0;

  const levels = [
    {
      id: 'in',
      label: 'IN',
      height: meters ? linearToMeterHeight(Math.max(meters.inPeakL, meters.inPeakR)) : 0,
      fill: styles.levelFill,
    },
    {
      id: 'out',
      label: 'OUT',
      height: meters ? linearToMeterHeight(Math.max(meters.outPeakL, meters.outPeakR)) : 0,
      fill: styles.levelFill,
    },
    {
      id: 'gain',
      label: 'GAIN',
      height: gainDbToHeight(gainDb),
      fill: isBoost ? styles.boostFill : styles.cutFill,
    },
  ];

  return (
    <aside className={styles.rail} aria-label="Master metering">
      {/* Live at ~30 Hz. Announcing these continuously would flood a screen
          reader, so the rail is exposed as a landmark but its bars are not. */}
      <div className={styles.meters} aria-hidden="true">
        {levels.map((meter) => (
          <div key={meter.id} className={styles.meterCell}>
            <div className={styles.meterLabel}>{meter.label}</div>
            <div
              className={styles.meter}
              title={
                meter.id === 'gain'
                  ? `Shaper gain change: ${gainDb > 0 ? '+' : ''}${gainDb.toFixed(1)} dB`
                  : undefined
              }
            >
              <div
                data-meter-fill
                className={`${styles.meterFill} ${meter.fill}`}
                style={{ '--meter-top': `${(1 - meter.height) * 100}%` }}
              />
            </div>
            {meter.id === 'gain' && (
              <div className={`${styles.gainReadout} ${isBoost ? styles.boost : styles.cut}`}>
                {gainDb > 0 ? '+' : ''}{gainDb.toFixed(1)}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.caption} aria-hidden="true">
        Input and output peak, and how much gain the shaper is applying.
        Top of the level scale is 0&nbsp;dBFS.
      </div>
    </aside>
  );
}
