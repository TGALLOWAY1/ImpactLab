import React, { createContext, useContext, useLayoutEffect, useMemo, useState } from 'react';
import styles from './PluginShell.module.css';

const ScaleContext = createContext(1);

/**
 * Current plugin scale factor. Use this when JS genuinely needs the scale —
 * never `getComputedStyle`, which forces a style recalc.
 *
 * Note that most code should NOT need it. See useParameterControl: scale breaks
 * *absolute* pointer mapping, never *delta* mapping.
 */
export const usePluginScale = () => useContext(ScaleContext);

export default function PluginShell({
  designWidth,
  designHeight,
  maxScale = 1,
  minScale = 0.5,
  children,
}) {
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const compute = () => {
      const fit = Math.min(
        window.innerWidth / designWidth,
        window.innerHeight / designHeight,
      );
      setScale(Math.max(minScale, Math.min(fit, maxScale)));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [designWidth, designHeight, maxScale, minScale]);

  const vars = useMemo(
    () => ({
      '--plugin-scale': scale,
      '--plugin-w': `${designWidth}px`,
      '--plugin-h': `${designHeight}px`,
    }),
    [scale, designWidth, designHeight],
  );

  return (
    <ScaleContext.Provider value={scale}>
      <div className={styles.viewport} style={vars}>
        <div className={styles.sizer}>
          <div className={styles.stage}>{children}</div>
        </div>
      </div>
    </ScaleContext.Provider>
  );
}
