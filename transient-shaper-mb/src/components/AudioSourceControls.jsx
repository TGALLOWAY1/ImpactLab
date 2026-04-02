import React, { useRef } from 'react';
import { colors, typography } from '../styles/theme';

// Phase D5 — Audio source toolbar: power, file upload, play/stop transport
export default function AudioSourceControls({
  isInitialized,
  isPlaying,
  isLoaded,
  fileName,
  onInitialize,
  onLoadFile,
  onPlay,
  onStop,
}) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onLoadFile(file);
    // Reset so same file can be re-selected
    e.target.value = '';
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
      {/* Power / Initialize button */}
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

      {/* File upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
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

      {/* File name display */}
      {fileName && (
        <span
          style={{
            color: colors.textLabel,
            fontSize: 10,
            maxWidth: 160,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {fileName}
        </span>
      )}

      {/* Transport controls */}
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
        </>
      )}

      {/* Status indicator */}
      <span style={{ marginLeft: 'auto', color: colors.textInactive, fontSize: 9, letterSpacing: '0.5px' }}>
        {!isInitialized
          ? 'Click power to start'
          : !isLoaded
          ? 'Load an audio file'
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
