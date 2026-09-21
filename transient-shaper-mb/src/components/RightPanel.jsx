import React from 'react';
import useMeters, { linearToMeterHeight, grDbToHeight } from '../hooks/useMeters';
import styles from './RightPanel.module.css';

const METERS = [
  { id: 'in', label: 'IN', fill: styles.levelFill },
  { id: 'out', label: 'OUT', fill: styles.levelFill },
  { id: 'gr', label: 'GR', fill: styles.grFill },
];

/**
 * Master metering rail.
 *
 * This used to also carry a "Soften" knob and a "Clip Guard" toggle, which were
 * second controls bound to the same `mix` and `softClip` state as the global
 * bar's "Mix" and "Soft Clip" — two names for one parameter, moving in lockstep
 * with no explanation. Both are gone; the global bar holds the canonical
 * controls. The global Output knob moved there too, next to Input.
 */
export default function RightPanel({ metersRef, isRunning }) {
  const meters = useMeters(metersRef, isRunning);

  const heights = {
    in: meters ? linearToMeterHeight(Math.max(meters.inPeakL, meters.inPeakR)) : 0,
    out: meters ? linearToMeterHeight(Math.max(meters.outPeakL, meters.outPeakR)) : 0,
    gr: meters ? grDbToHeight(meters.grDb) : 0,
  };

  return (
    <aside className={styles.rail} aria-label="Master metering">
      {/* Live at ~30 Hz. Announcing these continuously would flood a screen
          reader, so the rail is exposed as a landmark but its bars are not. */}
      <div className={styles.meters} aria-hidden="true">
        {METERS.map((meter) => (
          <div key={meter.id} className={styles.meterCell}>
            <div className={styles.meterLabel}>{meter.label}</div>
            <div className={styles.meter}>
              <div
                data-meter-fill
                className={`${styles.meterFill} ${meter.fill}`}
                style={{ '--meter-top': `${(1 - heights[meter.id]) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className={styles.caption} aria-hidden="true">
        Input, output and gain reduction. Top of scale is 0&nbsp;dBFS.
      </div>
    </aside>
  );
}
