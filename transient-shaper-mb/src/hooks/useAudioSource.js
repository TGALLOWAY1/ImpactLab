import { useRef, useState, useCallback } from 'react';

function audioBufferToWav(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const numSamples = buffer.length;
  const dataSize = numSamples * blockAlign;
  const bufferSize = 44 + dataSize;
  
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);
  
  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  
  const channels = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }
  
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

// Analyze audio buffer to create downsampled peak waveform for visualization
function analyzeWaveform(audioBuffer, samplesPerPixel = 512) {
  const channelData = audioBuffer.getChannelData(0); // Use first channel
  const totalSamples = channelData.length;
  const numPeaks = Math.ceil(totalSamples / samplesPerPixel);
  const peaks = new Float32Array(numPeaks);
  
  for (let i = 0; i < numPeaks; i++) {
    const start = i * samplesPerPixel;
    const end = Math.min(start + samplesPerPixel, totalSamples);
    let peak = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > peak) peak = abs;
    }
    peaks[i] = peak;
  }
  
  return { peaks, samplesPerPixel, sampleRate: audioBuffer.sampleRate, duration: audioBuffer.duration };
}

export default function useAudioSource(audioCtxRef, connectSource, disconnectSource, getStateForExport) {
  const sourceNodeRef = useRef(null);
  const audioBufferRef = useRef(null);
  const playbackStartTimeRef = useRef(0); // AudioContext time when playback started
  const playbackOffsetRef = useRef(0); // Offset into the buffer when started

  const [isPlaying, setIsPlaying] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [waveformData, setWaveformData] = useState(null);

  // Load an audio file from a File object
  const loadFile = useCallback(async (file) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    audioBufferRef.current = audioBuffer;
    setFileName(file.name);
    setIsLoaded(true);
    
    // Analyze waveform for visualization
    const waveform = analyzeWaveform(audioBuffer);
    setWaveformData(waveform);

    // Stop any currently playing source
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch {}
      disconnectSource();
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  }, [audioCtxRef, disconnectSource]);

  // Start playback (looping)
  const play = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || !audioBufferRef.current) return;

    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') ctx.resume();

    // Stop existing source if any
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch {}
      disconnectSource();
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBufferRef.current;
    source.loop = true;
    source.onended = () => {
      // Only update state if this source is still the current one
      if (sourceNodeRef.current === source) {
        setIsPlaying(false);
      }
    };

    sourceNodeRef.current = source;
    connectSource(source);
    
    // Track playback start time for position calculation
    playbackStartTimeRef.current = ctx.currentTime;
    playbackOffsetRef.current = 0;
    
    source.start(0);
    setIsPlaying(true);
  }, [audioCtxRef, connectSource, disconnectSource]);
  
  // Get current playback position (0 to 1, normalized)
  const getPlaybackPosition = useCallback(() => {
    const ctx = audioCtxRef.current;
    const buffer = audioBufferRef.current;
    if (!ctx || !buffer || !isPlaying) return 0;
    
    const elapsed = ctx.currentTime - playbackStartTimeRef.current;
    const position = (playbackOffsetRef.current + elapsed) % buffer.duration;
    return position / buffer.duration;
  }, [audioCtxRef, isPlaying]);

  // Stop playback
  const stop = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch {}
      disconnectSource();
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  }, [disconnectSource]);

  // Export processed audio as WAV
  const exportAudio = useCallback(async () => {
    if (!audioBufferRef.current || !getStateForExport) return;
    
    setIsExporting(true);
    
    try {
      const inputBuffer = audioBufferRef.current;
      const offlineCtx = new OfflineAudioContext(
        inputBuffer.numberOfChannels,
        inputBuffer.length,
        inputBuffer.sampleRate
      );
      
      // Load the worklet into offline context
      await offlineCtx.audioWorklet.addModule('/dsp/transient-shaper-worklet.js');
      
      // Get current state for processing
      const state = getStateForExport();
      const params = {
        inputGain: state.global.inputGain,
        outputGain: state.global.outputGain,
        mix: state.global.mix,
        detectionSpeed: state.global.detectionSpeed,
        softClip: state.global.softClip,
        lookahead: state.global.lookahead,
        delta: state.global.delta,
        crossoverFreqs: state.global.crossoverFreqs,
        detectionMethod: state.global.detectionMethod || 'dual-envelope',
        bands: state.bands,
      };
      
      const workletNode = new AudioWorkletNode(offlineCtx, 'transient-shaper-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [inputBuffer.numberOfChannels],
        processorOptions: { initialParams: params },
      });
      
      const source = offlineCtx.createBufferSource();
      source.buffer = inputBuffer;
      source.connect(workletNode);
      workletNode.connect(offlineCtx.destination);
      source.start(0);
      
      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);
      
      // Download the file
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      const baseName = fileName ? fileName.replace(/\.[^.]+$/, '') : 'processed';
      a.href = url;
      a.download = `${baseName}_processed.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [getStateForExport, fileName]);

  return {
    loadFile,
    play,
    stop,
    exportAudio,
    getPlaybackPosition,
    isPlaying,
    isLoaded,
    isExporting,
    fileName,
    waveformData,
  };
}
