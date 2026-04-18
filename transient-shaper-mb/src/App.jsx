import React, { useReducer } from 'react';
import { BANDS } from './constants/bands';
import { createInitialState, DEFAULT_BAND_STATE } from './constants/defaults';
import { PRESETS } from './constants/presets';
import { colors, sizes, typography } from './styles/theme';
import Header from './components/Header';
import GlobalControls from './components/GlobalControls';
import BandStripList from './components/BandStripList';
import AudioSourceControls from './components/AudioSourceControls';
import useAudioEngine from './hooks/useAudioEngine';
import useAudioSource from './hooks/useAudioSource';

// Action types
export const SET_BAND_PARAM = 'SET_BAND_PARAM';
export const SET_GLOBAL_PARAM = 'SET_GLOBAL_PARAM';
export const TOGGLE_SOLO = 'TOGGLE_SOLO';
export const TOGGLE_BYPASS = 'TOGGLE_BYPASS';
export const RESET_BAND = 'RESET_BAND';
export const RESET_ALL = 'RESET_ALL';
export const UNSOLO_ALL = 'UNSOLO_ALL';
export const LOAD_PRESET = 'LOAD_PRESET';
export const SWITCH_AB_SLOT = 'SWITCH_AB_SLOT';
export const COPY_AB_SLOT = 'COPY_AB_SLOT';

function snapshotFrom(state) {
  return { bands: state.bands, global: state.global, presetName: state.presetName };
}

// Mutating any parameter invalidates the "pristine preset" label.
function markDirty(state) {
  return state.presetName == null ? state : { ...state, presetName: null };
}

function reducer(state, action) {
  switch (action.type) {
    case SET_BAND_PARAM: {
      const { bandId, param, value } = action;
      const base = markDirty(state);
      if (state.global.multibandLink && (param === 'attack' || param === 'sustain')) {
        const delta = value - state.bands[bandId][param];
        const updatedBands = { ...state.bands };
        for (const band of BANDS) {
          if (!updatedBands[band.id].bypass) {
            updatedBands[band.id] = {
              ...updatedBands[band.id],
              [param]: Math.max(-100, Math.min(100, updatedBands[band.id][param] + delta)),
            };
          }
        }
        return { ...base, bands: updatedBands };
      }
      return {
        ...base,
        bands: {
          ...state.bands,
          [bandId]: { ...state.bands[bandId], [param]: value },
        },
      };
    }
    case SET_GLOBAL_PARAM:
      return {
        ...markDirty(state),
        global: { ...state.global, [action.param]: action.value },
      };
    case TOGGLE_SOLO:
      return {
        ...state,
        bands: {
          ...state.bands,
          [action.bandId]: {
            ...state.bands[action.bandId],
            solo: !state.bands[action.bandId].solo,
          },
        },
      };
    case TOGGLE_BYPASS:
      return {
        ...state,
        bands: {
          ...state.bands,
          [action.bandId]: {
            ...state.bands[action.bandId],
            bypass: !state.bands[action.bandId].bypass,
          },
        },
      };
    case RESET_BAND:
      return {
        ...state,
        bands: {
          ...state.bands,
          [action.bandId]: { ...DEFAULT_BAND_STATE },
        },
      };
    case RESET_ALL: {
      const fresh = createInitialState();
      return { ...state, bands: fresh.bands, global: fresh.global, presetName: null };
    }
    case UNSOLO_ALL: {
      const updatedBands = {};
      for (const band of BANDS) {
        updatedBands[band.id] = { ...state.bands[band.id], solo: false };
      }
      return { ...state, bands: updatedBands };
    }
    case LOAD_PRESET: {
      const preset = PRESETS.find((p) => p.name === action.name);
      if (!preset) return state;
      // Preserve ephemeral global flags that are not part of musical presets
      // (so loading a preset doesn't surprise the user by toggling delta, lookahead, etc.).
      const preserved = {
        delta: state.global.delta,
        lookahead: state.global.lookahead,
        softClip: preset.state.global.softClip ?? state.global.softClip,
        inputGain: state.global.inputGain,
        outputGain: state.global.outputGain,
        crossoverFreqs: state.global.crossoverFreqs,
        detectionMethod: state.global.detectionMethod,
      };
      return {
        ...state,
        bands: preset.state.bands,
        global: { ...state.global, ...preset.state.global, ...preserved },
        presetName: preset.name,
      };
    }
    case SWITCH_AB_SLOT: {
      const currentSnapshot = snapshotFrom(state);
      return {
        ...state,
        bands: state.abOther.bands,
        global: state.abOther.global,
        presetName: state.abOther.presetName ?? null,
        abOther: currentSnapshot,
        abSlot: state.abSlot === 'A' ? 'B' : 'A',
      };
    }
    case COPY_AB_SLOT:
      return { ...state, abOther: snapshotFrom(state) };
    default:
      return state;
  }
}

function initReducer() {
  const base = createInitialState();
  return {
    ...base,
    abSlot: 'A',
    abOther: snapshotFrom(base),
    presetName: 'Default',
  };
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, null, initReducer);

  const anySoloed = BANDS.some((b) => state.bands[b.id].solo);

  // Audio engine integration
  const engine = useAudioEngine(state);
  const getStateForExport = React.useCallback(() => state, [state]);
  const source = useAudioSource(engine.audioCtxRef, engine.connectSource, engine.disconnectSource, getStateForExport);

  return (
    <div
      style={{
        width: sizes.pluginWidth,
        height: sizes.pluginHeight,
        background: `linear-gradient(180deg, ${colors.pluginBg}, ${colors.pluginBgEnd})`,
        fontFamily: typography.fontFamily,
        color: colors.textPrimary,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <AudioSourceControls
        isInitialized={engine.isInitialized}
        isPlaying={source.isPlaying}
        isLoaded={source.isLoaded}
        isExporting={source.isExporting}
        fileName={source.fileName}
        onInitialize={engine.initialize}
        onLoadFile={source.loadFile}
        onPlay={source.play}
        onStop={source.stop}
        onExport={source.exportAudio}
      />
      <Header
        presetName={state.presetName}
        abSlot={state.abSlot}
        anySoloed={anySoloed}
        dispatch={dispatch}
      />
      <GlobalControls state={state.global} dispatch={dispatch} />
      <BandStripList
        bands={BANDS}
        bandStates={state.bands}
        anySoloed={anySoloed}
        dispatch={dispatch}
        getVizData={engine.isRunning ? engine.getVizData : null}
        vizWritePositionsRef={engine.vizWritePositionsRef}
        waveformData={source.waveformData}
        getPlaybackPosition={source.getPlaybackPosition}
        isPlaying={source.isPlaying}
      />
    </div>
  );
}
