import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Instrument } from '../instrument/types';
import { useTrialDragDrop } from './useTrialDragDrop';

const sources = (instrument: Instrument) => ({
  instrument,
  state: {},
  config: {},
  setState: () => {},
  snapshot: () => false,
  canvasLayers: [],
  canvasHost: { current: null },
});

describe('useTrialDragDrop', () => {
  afterEach(() => vi.restoreAllMocks());

  it('warns once per instrument that declares the unsupported pickUp', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const instrument: Instrument = {
      name: 'picker',
      initialState: () => ({}),
      render: () => null,
      dragDrop: { palette: [], onDrop: (_p, _i, s) => s, pickUp: () => null },
    };
    renderHook(() => useTrialDragDrop(sources(instrument)));
    renderHook(() => useTrialDragDrop(sources(instrument)));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('pickUp');
  });

  it('does not warn for an instrument without pickUp', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const instrument: Instrument = {
      name: 'plain',
      initialState: () => ({}),
      render: () => null,
      dragDrop: { palette: [], onDrop: (_p, _i, s) => s },
    };
    renderHook(() => useTrialDragDrop(sources(instrument)));
    expect(warn).not.toHaveBeenCalled();
  });
});
