import { useRef, useState, useCallback, useEffect } from 'react';

const VIZ_SAMPLES_PER_BAND = 1024; // Downsampled peaks, not raw samples
const NUM_BANDS = 5;
// Per band: 1024 band peaks + 1024 delta peaks + 2 (writePos + reserved)
// Layout MUST stay in sync with the worklet (vizFloatsPerBand / vizDeltaOffset).
const FLOATS_PER_BAND = VIZ_SAMPLES_PER_BAND * 2 + 2;
const VIZ_DELTA_OFFSET = VIZ_SAMPLES_PER_BAND;
const TOTAL_VIZ_FLOATS = NUM_BANDS * FLOATS_PER_BAND;

const INITIAL_METERS = {
  inPeakL: 0, inPeakR: 0, inRmsL: 0, inRmsR: 0,
  outPeakL: 0, outPeakR: 0, outRmsL: 0, outRmsR: 0,
  // Signed peak gain change applied by the shaper: negative is reduction,
  // positive is a transient boost. Not "gain reduction" — a transient shaper
  // spends most of its time above unity.
  gainDb: 0,
  bandGainDb: [0, 0, 0, 0, 0],
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
  const metersRef = useRef({ ...INITIAL_METERS, bandGainDb: [...INITIAL_METERS.bandGainDb] });
  const sourceNodeRef = useRef(null);

  // `initialize` is deliberately stable (it must only ever build one context),
  // so it cannot close over `state` directly — it would capture the very first
  // render's value and ship defaults to the worklet no matter what the user had
  // already dialled in before pressing the power button.
  const stateRef = useRef(state);
  stateRef.current = state;

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
      // SharedArrayBuffer unavailable (COOP/COEP headers missing). There is no
      // postMessage fallback — the per-band waveforms simply stay blank and
      // WaveformCanvas falls back to file/synthetic drawing. Audio is
      // unaffected. See vite.config.js and vercel.json for the headers.
      vizSabRef.current = null;
      vizViewRef.current = null;
    }

    await ctx.audioWorklet.addModule('/dsp/transient-shaper-worklet.js');

    const workletNode = new AudioWorkletNode(ctx, 'transient-shaper-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: {
        initialParams: serializeState(stateRef.current),
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
        m.gainDb = d.gainDb;
        // d.bandGainDb is a plain array; copy in place to keep ref stable
        for (let i = 0; i < 5; i++) m.bandGainDb[i] = d.bandGainDb[i];
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

  // Get viz data for a specific band (called from useRealtimeWaveform).
  // Returns both the band peak ring and the per-band delta peak ring as
  // independent Float32Array copies.
  const getVizData = useCallback((bandIndex) => {
    if (!vizViewRef.current) return null;
    const offset = bandIndex * FLOATS_PER_BAND;
    return {
      samples: vizViewRef.current.slice(offset, offset + VIZ_SAMPLES_PER_BAND),
      delta: vizViewRef.current.slice(
        offset + VIZ_DELTA_OFFSET,
        offset + VIZ_DELTA_OFFSET + VIZ_SAMPLES_PER_BAND,
      ),
    };
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
