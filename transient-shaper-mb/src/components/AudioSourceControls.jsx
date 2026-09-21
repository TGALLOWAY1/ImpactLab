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
  error,
  onDismissError,
  onInitialize,
  onLoadFile,
  onPlay,
  onStop,
  onExport,
}) {
  const fileInputRef = useRef(null);
  const [loadingDemo, setLoadingDemo] = useState(false);
  // The demo fetch is the one failure path useAudioSource does not own, so it
  // keeps its own message — rendered through the same surface rather than a
  // second, unstyleable mechanism.
  const [demoError, setDemoError] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onLoadFile(file);
    e.target.value = '';
  };

  const handleLoadDemo = async () => {
    try {
      if (!isInitialized) await onInitialize();
      setLoadingDemo(true);
      setDemoError(null);
      const response = await fetch(DEMO_LOOP_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const demoFile = new File([blob], 'drum-loop-carrai-pass.wav', {
        type: blob.type || 'audio/wav',
      });
      onLoadFile(demoFile);
    } catch (err) {
      console.error('Demo loop fetch failed:', err);
      setDemoError(`Could not load the demo loop (${err.message}). Check your connection, or use Load File.`);
    } finally {
      setLoadingDemo(false);
    }
  };

  const shownError = error || demoError;

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
        // NOT aria-pressed. `initialize()` is one-way — it returns the existing
        // context and never sets isInitialized back to false — so announcing a
        // toggle would promise a stop action that does not exist. Once running,
        // the control has done its job and becomes a status indicator.
        disabled={isInitialized}
        data-running={isInitialized}
        // The glyph is the whole button content, so it needs a real name.
        aria-label={isInitialized ? 'Audio engine is running' : 'Start the audio engine'}
        title={isInitialized ? 'Audio engine is running' : 'Initialize audio engine'}
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

      {shownError && (
        <button
          type="button"
          className={styles.error}
          onClick={() => { setDemoError(null); onDismissError?.(); }}
          title="Dismiss"
          aria-label={`Dismiss error: ${shownError}`}
        >
          {/* Live region, so the failure is announced rather than only seen. */}
          <span role="alert">{shownError}</span>
        </button>
      )}

      {/* Announced when it changes, so the engine's state is not purely visual. */}
      <span className={styles.status} role="status">{status}</span>
    </div>
  );
}
