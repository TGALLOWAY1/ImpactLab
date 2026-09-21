import React, { useRef, useState } from 'react';
import styles from './AudioSourceControls.module.css';

const DEMO_LOOP_URL = 'https://upload.wikimedia.org/wikipedia/commons/2/21/Drum_loop_%28Carrai_Pass%29.wav';

// Phase D5 — Audio source toolbar: power, file upload, play/stop transport, export
export default function AudioSourceControls({
  isInitialized,
  isPlaying,
  isLoaded,
  isExporting,
  fileName,
  onInitialize,
  onLoadFile,
  onPlay,
  onStop,
  onExport,
}) {
  const fileInputRef = useRef(null);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onLoadFile(file);
    e.target.value = '';
  };

  const handleLoadDemo = async () => {
    try {
      if (!isInitialized) await onInitialize();
      setLoadingDemo(true);
      const response = await fetch(DEMO_LOOP_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const demoFile = new File([blob], 'drum-loop-carrai-pass.wav', {
        type: blob.type || 'audio/wav',
      });
      onLoadFile(demoFile);
    } catch (err) {
      // eslint-disable-next-line no-alert
      window.alert(`Failed to load demo loop: ${err.message}`);
    } finally {
      setLoadingDemo(false);
    }
  };

  const status = !isInitialized
    ? 'Click power to start'
    : !isLoaded
    ? 'Load an audio file (or demo loop)'
    : isPlaying
    ? 'Playing (looped)'
    : 'Ready';

  return (
    <div className={styles.bar} role="toolbar" aria-label="Audio source and transport">
      <button
        type="button"
        onClick={onInitialize}
        className={`${styles.btn} ${styles.power}`}
        aria-pressed={isInitialized}
        // The glyph is the whole button content, so it needs a real name.
        aria-label={isInitialized ? 'Audio engine running' : 'Start the audio engine'}
        title={isInitialized ? 'Audio engine running' : 'Initialize audio engine'}
      >
        <span aria-hidden="true">{isInitialized ? '◉' : '⭘'}</span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        className={styles.hiddenInput}
        tabIndex={-1}
        aria-hidden="true"
      />
      <button
        type="button"
        className={styles.btn}
        onClick={() => {
          if (!isInitialized) onInitialize().then(() => fileInputRef.current?.click());
          else fileInputRef.current?.click();
        }}
      >
        Load File
      </button>

      <button
        type="button"
        className={styles.btn}
        onClick={handleLoadDemo}
        disabled={loadingDemo}
        title="Load open-source demo loop by Pannage (CC BY-SA 3.0)"
      >
        {loadingDemo ? 'Loading Demo…' : 'Load Demo Loop'}
      </button>

      {fileName && <span className={styles.fileName}>{fileName}</span>}

      {isLoaded && (
        <>
          <button
            type="button"
            className={`${styles.btn} ${styles.transport}`}
            data-playing={isPlaying}
            onClick={isPlaying ? onStop : onPlay}
          >
            <span aria-hidden="true">{isPlaying ? '■' : '▶'}</span>
            {isPlaying ? ' Stop' : ' Play'}
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={onExport}
            disabled={isExporting}
            title="Export processed audio as WAV"
          >
            <span aria-hidden="true">{'⬇'}</span>
            {isExporting ? ' Saving…' : ' Save'}
          </button>
        </>
      )}

      {/* Announced when it changes, so the engine's state is not purely visual. */}
      <span className={styles.status} role="status">{status}</span>
    </div>
  );
}
