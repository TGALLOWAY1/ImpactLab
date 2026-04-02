import { useRef, useState, useCallback } from 'react';

export default function useAudioSource(audioCtxRef, connectSource, disconnectSource) {
  const sourceNodeRef = useRef(null);
  const audioBufferRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load an audio file from a File object
  const loadFile = useCallback(async (file) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    audioBufferRef.current = audioBuffer;
    setFileName(file.name);
    setIsLoaded(true);

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
    source.start(0);
    setIsPlaying(true);
  }, [audioCtxRef, connectSource, disconnectSource]);

  // Stop playback
  const stop = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch {}
      disconnectSource();
      sourceNodeRef.current = null;
    }
    setIsPlaying(false);
  }, [disconnectSource]);

  return {
    loadFile,
    play,
    stop,
    isPlaying,
    isLoaded,
    fileName,
  };
}
