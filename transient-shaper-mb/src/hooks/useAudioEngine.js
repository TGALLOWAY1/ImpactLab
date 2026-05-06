import { useRef, useState, useCallback, useEffect } from 'react';

const VIZ_SAMPLES_PER_BAND = 1024; // Downsampled peaks, not raw samples
const NUM_BANDS = 5;
// Per band: 1024 peaks + 1 write position + 1 reserved = 1026 floats
const FLOATS_PER_BAND = VIZ_SAMPLES_PER_BAND + 2;
const TOTAL_VIZ_FLOATS = NUM_BANDS * FLOATS_PER_BAND;

const INITIAL_METERS = {
  inPeakL: 0, inPeakR: 0, inRmsL: 0, inRmsR: 0,
  outPeakL: 0, outPeakR: 0, outRmsL: 0, outRmsR: 0,
  grDb: 0,
  bandGrDb: [0, 0, 0, 0, 0],
};

function serializeState(state) {
  return {
    inputGain: state.global.inputGain,
    outputGain: state.global.outputGain,
    mix: state.global.mix,
    detectionSpeed: state.global.detectionSpeed,
    softClip: state.global.softClip,
    lookahead: state.global.lookahead,
    delta: state.global.delta,
    globalBypass: state.global.globalBypass,
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
  const metersRef = useRef({ ...INITIAL_METERS, bandGrDb: [...INITIAL_METERS.bandGrDb] });
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

    // Listen for viz + meter updates from worklet (mutate refs; consumers rAF-poll)
    workletNode.port.onmessage = (e) => {
      const d = e.data;
      if (d.type === 'vizUpdate') {
        vizWritePositionsRef.current = d.writePositions;
      } else if (d.type === 'meters') {
        const m = metersRef.current;
        m.inPeakL = d.inPeakL; m.inPeakR = d.inPeakR;
        m.inRmsL = d.inRmsL; m.inRmsR = d.inRmsR;
        m.outPeakL = d.outPeakL; m.outPeakR = d.outPeakR;
        m.outRmsL = d.outRmsL; m.outRmsR = d.outRmsR;
        m.grDb = d.grDb;
        // d.bandGrDb is a plain array; copy in place to keep ref stable
        for (let i = 0; i < 5; i++) m.bandGrDb[i] = d.bandGrDb[i];
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
    metersRef,
    audioCtxRef,
  };
}
