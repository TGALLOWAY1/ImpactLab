import React, { useReducer } from 'react';
import { BANDS } from './constants/bands';
import { createInitialState, DEFAULT_BAND_STATE } from './constants/defaults';
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

function reducer(state, action) {
  switch (action.type) {
    case SET_BAND_PARAM: {
      const { bandId, param, value } = action;
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
        return { ...state, bands: updatedBands };
      }
      return {
        ...state,
        bands: {
          ...state.bands,
          [bandId]: { ...state.bands[bandId], [param]: value },
        },
      };
    }
    case SET_GLOBAL_PARAM:
      return {
        ...state,
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
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, null, createInitialState);

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
      <Header />
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
