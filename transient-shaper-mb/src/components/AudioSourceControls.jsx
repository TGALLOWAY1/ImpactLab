import React, { useRef, useState } from 'react';
import { colors, typography } from '../styles/theme';

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
      const demoFile = new File([blob], 'drum-loop-carrai-pass.wav', { type: blob.type || 'audio/wav' });
      onLoadFile(demoFile);
    } catch (err) {
      // eslint-disable-next-line no-alert
      window.alert(`Failed to load demo loop: ${err.message}`);
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 16px',
        backgroundColor: colors.globalBarBg,
        borderBottom: `1px solid ${colors.headerBorder}`,
        fontFamily: typography.fontFamily,
        fontSize: 11,
        color: colors.textPrimary,
        minHeight: 32,
      }}
    >
      <button
        onClick={onInitialize}
        style={{
          ...btnBase,
          backgroundColor: isInitialized ? '#2a5a2a' : '#444',
          color: isInitialized ? '#6fcf6f' : '#aaa',
          minWidth: 28,
          fontSize: 14,
        }}
        title={isInitialized ? 'Audio engine running' : 'Initialize audio engine'}
      >
        {isInitialized ? '\u25C9' : '\u2B58'}
      </button>

      <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileChange} style={{ display: 'none' }} />
      <button
        onClick={() => {
          if (!isInitialized) onInitialize().then(() => fileInputRef.current?.click());
          else fileInputRef.current?.click();
        }}
        style={{ ...btnBase, backgroundColor: '#333', color: '#ccc' }}
        title="Load audio file"
      >
        Load File
      </button>

      <button
        onClick={handleLoadDemo}
        disabled={loadingDemo}
        style={{ ...btnBase, backgroundColor: '#2f3e5e', color: '#b8cbf2', opacity: loadingDemo ? 0.7 : 1 }}
        title="Load open-source demo loop by Pannage (CC BY-SA 3.0)"
      >
        {loadingDemo ? 'Loading Demo…' : 'Load Demo Loop'}
      </button>

      {fileName && (
        <span
          style={{
            color: colors.textLabel,
            fontSize: 10,
            maxWidth: 240,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {fileName}
        </span>
      )}

      {isLoaded && (
        <>
          <button
            onClick={isPlaying ? onStop : onPlay}
            style={{
              ...btnBase,
              backgroundColor: isPlaying ? '#5a2a2a' : '#2a3a5a',
              color: isPlaying ? '#e85d5d' : '#5bc0eb',
              minWidth: 54,
            }}
          >
            {isPlaying ? '\u25A0 Stop' : '\u25B6 Play'}
          </button>
          <button
            onClick={onExport}
            disabled={isExporting}
            style={{
              ...btnBase,
              backgroundColor: isExporting ? '#333' : '#3a4a3a',
              color: isExporting ? '#666' : '#8fdf8f',
              minWidth: 54,
              opacity: isExporting ? 0.6 : 1,
              cursor: isExporting ? 'wait' : 'pointer',
            }}
            title="Export processed audio as WAV"
          >
            {isExporting ? 'Saving...' : '\u2B07 Save'}
          </button>
        </>
      )}

      <span style={{ marginLeft: 'auto', color: colors.textInactive, fontSize: 9, letterSpacing: '0.5px' }}>
        {!isInitialized
          ? 'Click power to start'
          : !isLoaded
          ? 'Load an audio file (or demo loop)'
          : isPlaying
          ? 'Playing (looped)'
          : 'Ready'}
      </span>
    </div>
  );
}

const btnBase = {
  border: 'none',
  borderRadius: 4,
  padding: '4px 10px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.5px',
};
