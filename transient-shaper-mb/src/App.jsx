import React, { useReducer } from 'react';
import { BANDS } from './constants/bands';
import { createInitialState } from './constants/defaults';
import { colors, sizes, typography } from './styles/theme';
import Header from './components/Header';
import GlobalControls from './components/GlobalControls';
import BandStripList from './components/BandStripList';

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
          [action.bandId]: { attack: 0, attackTime: 50, sustain: 0, sustainTime: 50, outputGain: 0, solo: false, bypass: false },
        },
      };
    default:
      return state;
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, null, createInitialState);

  const anySoloed = BANDS.some((b) => state.bands[b.id].solo);

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
      <Header />
      <GlobalControls state={state.global} dispatch={dispatch} />
      <BandStripList
        bands={BANDS}
        bandStates={state.bands}
        anySoloed={anySoloed}
        dispatch={dispatch}
      />
    </div>
  );
}
