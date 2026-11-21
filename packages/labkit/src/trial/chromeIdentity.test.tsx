import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Instrument } from '../instrument/types';
import type { LabCommands } from '../lab/LabContext';
import { createLabStore } from '../state/store';
import { useLoupeSwitch } from './loupeSwitch';
import { useTrialChromeContext } from './useTrialChromeContext';
import { useTrialTool } from './useTrialTool';
import { useTrialUndo } from './useTrialUndo';

// The trial chrome's context is one memo over what the trial hands it: each source holds its identity across a
// render that changes nothing, so the memo holds and the chrome's regions do not re-render for it.

const counter: Instrument = {
  name: 'Counter',
  initialState: () => ({ n: 0 }),
  render: () => null,
};

function storeWithTrial() {
  const store = createLabStore({ instruments: [counter] });
  store.getState().addTrial({
    id: 't',
    instrumentName: 'Counter',
    config: {},
    state: { n: 0 },
    view: { zoom: 2, pan: { x: 5, y: 5 } },
  });
  return store;
}

const recordOf = (store: ReturnType<typeof storeWithTrial>) => {
  const record = store.getState().trials[0];
  if (!record) throw new Error('no trial');
  return record;
};

describe("a trial chrome's sources keep their identity across a render that changes nothing", () => {
  it('the chrome context, over a 2D view', () => {
    const store = storeWithTrial();
    const record = recordOf(store);
    const props = {
      trialId: 't',
      record,
      lab: { savedSnapshots: [] } as unknown as LabCommands,
      store,
      title: 'Counter',
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
    const { result, rerender } = renderHook(() => useTrialChromeContext(props));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    expect(first.zoom).toBe(2);
  });

  it('the tool slot', () => {
    const store = storeWithTrial();
    const record = recordOf(store);
    const { result, rerender } = renderHook(() => useTrialTool(store, counter, [counter], record));
    const first = result.current.slot.chrome;
    rerender();
    expect(result.current.slot.chrome).toBe(first);
  });

  it('the undo bindings', () => {
    const own = {
      canUndo: () => true,
      canRedo: () => false,
      undo: () => undefined,
      redo: () => undefined,
      subscribe: () => () => undefined,
      record: () => undefined,
    };
    const { result, rerender } = renderHook(() =>
      useTrialUndo({ declaresUndo: true, marks: null, own, snapshots: undefined }),
    );
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
    expect(first?.canUndo).toBe(true);
  });

  it('the loupe bindings, while a lens is mounted', () => {
    const { result, rerender } = renderHook(() => useLoupeSwitch());
    act(() => {
      result.current.loupeSwitch.mount();
    });
    const first = result.current.loupeBindings;
    expect(first).toBeDefined();
    rerender();
    expect(result.current.loupeBindings).toBe(first);
  });
});
