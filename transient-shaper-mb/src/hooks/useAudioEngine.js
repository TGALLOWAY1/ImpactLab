import { useRef, useState, useCallback, useEffect } from 'react';

const VIZ_SAMPLES_PER_BAND = 512;
const NUM_BANDS = 5;
// Per band: 512 samples + 1 write position + 1 reserved = 514 floats
const FLOATS_PER_BAND = VIZ_SAMPLES_PER_BAND + 2;
const TOTAL_VIZ_FLOATS = NUM_BANDS * FLOATS_PER_BAND;

function serializeState(state) {
  return {
    inputGain: state.global.inputGain,
    outputGain: state.global.outputGain,
    mix: state.global.mix,
    detectionSpeed: state.global.detectionSpeed,
    transientMode: state.global.transientMode,
    softClip: state.global.softClip,
    lookahead: state.global.lookahead,
    delta: state.global.delta,
    crossoverFreqs: state.global.crossoverFreqs,
    detectionMethod: state.global.detectionMethod || 'dual-envelope',
    bands: state.bands,
  };
}

export default function useAudioEngine(state) {
  const audioCtxRef = useRef(null);
  const workletNodeRef = useRef(null);
  const vizSabRef = useRef(null);
  const vizViewRef = useRef(null);
  const vizWritePositionsRef = useRef(new Array(NUM_BANDS).fill(0));
  const sourceNodeRef = useRef(null);

  const [isRunning, setIsRunning] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize AudioContext and worklet
  const initialize = useCallback(async () => {
    if (audioCtxRef.current) return audioCtxRef.current;

    const ctx = new AudioContext({ sampleRate: 44100 });

    // Try SharedArrayBuffer, fall back gracefully
    let vizSab = null;
    try {
      vizSab = new SharedArrayBuffer(TOTAL_VIZ_FLOATS * 4);
      vizSabRef.current = vizSab;
      vizViewRef.current = new Float32Array(vizSab);
    } catch {
      // SharedArrayBuffer not available (missing COOP/COEP headers)
      // Viz will work via postMessage fallback
      vizSabRef.current = null;
      vizViewRef.current = null;
    }

    await ctx.audioWorklet.addModule('/dsp/transient-shaper-worklet.js');

    const workletNode = new AudioWorkletNode(ctx, 'transient-shaper-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: {
        initialParams: serializeState(state),
        vizSharedBuffer: vizSab,
      },
    });

    workletNode.connect(ctx.destination);

    // Listen for viz updates from worklet
    workletNode.port.onmessage = (e) => {
      if (e.data.type === 'vizUpdate') {
        vizWritePositionsRef.current = e.data.writePositions;
      }
    };

    audioCtxRef.current = ctx;
    workletNodeRef.current = workletNode;
    setIsInitialized(true);

    return ctx;
  }, []); // intentionally stable — only called once

  // Connect an audio source node to the worklet
  const connectSource = useCallback((sourceNode) => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch {}
    }
    if (workletNodeRef.current && sourceNode) {
      sourceNode.connect(workletNodeRef.current);
      sourceNodeRef.current = sourceNode;
      setIsRunning(true);
    }
  }, []);

  // Disconnect current source
  const disconnectSource = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch {}
      sourceNodeRef.current = null;
      setIsRunning(false);
    }
  }, []);

  // Post parameter updates to worklet on state change
  useEffect(() => {
    if (!workletNodeRef.current) return;
    workletNodeRef.current.port.postMessage({
      type: 'SET_PARAMS',
      params: serializeState(state),
    });
  }, [state]);

  // Get viz data for a specific band (called from useRealtimeWaveform)
  const getVizData = useCallback((bandIndex) => {
    if (!vizViewRef.current) return null;
    const offset = bandIndex * FLOATS_PER_BAND;
    // Return a copy of the band's viz samples
    return vizViewRef.current.slice(offset, offset + VIZ_SAMPLES_PER_BAND);
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.disconnect(); } catch {}
      }
      if (workletNodeRef.current) {
        try { workletNodeRef.current.disconnect(); } catch {}
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
    };
  }, []);

  return {
    initialize,
    isRunning,
    isInitialized,
    connectSource,
    disconnectSource,
    getVizData,
    vizWritePositionsRef,
    audioCtxRef,
  };
}
