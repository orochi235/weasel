import { act, renderHook } from '@testing-library/react';
import { LabContext, type LabContextValue } from '@weasel-js/labkit';
import type { ReactNode } from 'react';
import { createLensScene, lensesOf, MAX_LENSES } from '@weasel-js/labkit/loupe';
import { describe, expect, it, vi } from 'vitest';
import type { ForgeComparison } from './conditions';
import { createApi, useLensFocus, useRemeasure } from './ForgeLoupe';
import type { LiveSource } from './liveSource';

function setup() {
  const scene = createLensScene<ForgeComparison>();
  const { result } = renderHook(() => useLensFocus(scene));
  const body = document.createElement('div');
  const api = createApi(scene, {
    body: { current: body },
    pointer: { current: null },
    focus: result.current.focus,
    sources: { current: {} },
  });
  return { scene, api, onFocusLens: result.current.onFocusLens };
}

describe('the workshop’s lens API', () => {
  it('acts on the lens a chrome toggle focuses, then on whichever lens the canvas selects, the same one again included', () => {
    const { scene, api, onFocusLens } = setup();
    const [a, b] = [api.add(), api.add()];
    expect(api.current()).toBe(b);
    // The chrome calls this before it triggers, and the action reads it straight away.
    onFocusLens(a);
    expect(api.current()).toBe(a);
    act(() => scene.setSelection([`${b}:body` as never]));
    expect(api.current()).toBe(b);
    onFocusLens(a);
    act(() => scene.setSelection([`${b}:body` as never]));
    expect(api.current()).toBe(b);
  });

  it('falls back to the latest lens once the focused one has closed', () => {
    const { scene, api, onFocusLens } = setup();
    const [a, b] = [api.add(), api.add()];
    onFocusLens(b);
    act(() => scene.history.undo());
    expect(lensesOf(scene).map((l) => l.lensId)).toEqual([a]);
    expect(api.current()).toBe(a);
  });

  it('adds no lens past the cap', () => {
    const { scene, api } = setup();
    for (let i = 0; i < MAX_LENSES; i++) api.add();
    expect(api.add()).toBeNull();
    expect(lensesOf(scene)).toHaveLength(MAX_LENSES);
  });
});

describe('the workshop’s re-measuring', () => {
  it('looks again when a pane’s camera moves, which writes the trial’s view', () => {
    // A proxy: jsdom lays nothing out, so this asserts the re-measure a zoom or pan triggers, not what the lens then
    // shows. Panning or zooming a pane writes the trial's `view` into its record (labkit's `updateTrialView`).
    const live = { remeasure: vi.fn() } as unknown as LiveSource;
    const remeasure = live.remeasure as ReturnType<typeof vi.fn>;
    let trials = [{ id: 't1', view: { zoom: 1, pan: { x: 0, y: 0 } } }];
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LabContext.Provider value={{ trials, mode: 'light' } as unknown as LabContextValue}>{children}</LabContext.Provider>
    );
    const { rerender } = renderHook(() => useRemeasure(live, null, () => {}), { wrapper });
    const before = remeasure.mock.calls.length;
    trials = [{ id: 't1', view: { zoom: 2, pan: { x: 40, y: 0 } } }];
    rerender();
    expect(remeasure.mock.calls.length).toBe(before + 1);
  });
});
