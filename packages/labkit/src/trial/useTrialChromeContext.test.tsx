import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/types';
import type { LabCommands } from '../lab/LabContext';
import { createLabStore } from '../state/store';
import { useTrialChromeContext } from './useTrialChromeContext';

const plain: Instrument = { name: 'Plain', initialState: () => ({}), render: () => null };

function chromeOver(cameraKind: 'canvas' | null) {
  const store = createLabStore({ instruments: [plain] });
  store
    .getState()
    .addTrial({ id: 't', instrumentName: 'Plain', config: {}, state: {}, view: null });
  const record = store.getState().trials[0];
  if (!record) throw new Error('no trial');
  const props = {
    trialId: 't',
    record,
    cameraKind,
    lab: { savedSnapshots: [] } as unknown as LabCommands,
    store,
    title: 'Plain',
    isLastTrial: true,
    undoBindings: undefined,
    loupe: undefined,
    toolSlot: { activeToolId: null },
    actions: undefined,
    configSchema: undefined,
    auto: {},
    reported: undefined,
    setConfig: () => undefined,
    draftConfig: () => undefined,
  } as unknown as Parameters<typeof useTrialChromeContext>[0];
  const { result } = renderHook(() => useTrialChromeContext(props));
  return { ctx: result.current, view: () => store.getState().trials[0]?.view };
}

describe("a trial chrome's zoom over an unplaced view", () => {
  it('reads as the default zoom on a 2D camera', () => {
    expect(chromeOver('canvas').ctx.zoom).toBe(1);
  });

  it('is absent, and writes no view, when the instrument declares no camera', () => {
    const { ctx, view } = chromeOver(null);
    expect(ctx.zoom).toBeNull();
    act(() => ctx.setZoom(2));
    expect(view()).toBeNull();
  });
});
