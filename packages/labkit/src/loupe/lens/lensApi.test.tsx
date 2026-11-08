import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LabContext, type LabContextValue } from '../../lab/LabContext';
import { MAX_LENSES } from './lensActionDefs';
import { createLensApi, useLensFocus } from './lensApi';
import { createLensScene, lensesOf, setAimOps } from './lensScene';
import { type Remeasurable, useLensRemeasure } from './useLensRemeasure';

function setup() {
  const scene = createLensScene<null>();
  const { result } = renderHook(() => useLensFocus());
  const body = document.createElement('div');
  const api = createLensApi(scene, {
    body: { current: body },
    pointer: { current: null },
    focus: result.current.focus,
    sources: { current: {} },
  });
  return { scene, api, onFocusLens: result.current.onFocusLens };
}

describe('a host’s lens API', () => {
  it('acts on the lens last reported focused, straight away', () => {
    const { api, onFocusLens } = setup();
    const [a, b] = [api.add(), api.add()];
    expect(api.current()).toBe(b);
    // The chrome reports its lens before it triggers, and the action reads it straight away.
    onFocusLens(a);
    expect(api.current()).toBe(a);
    // The overlay reports a selection of nothing, after which the latest lens is acted on.
    onFocusLens(null);
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

describe('a host’s Follow reticles', () => {
  function twoFollowing() {
    const { scene, api, onFocusLens } = setup();
    const [a, b] = [api.add()!, api.add()!];
    act(() => api.apply([...setAimOps(scene, a, 'follow'), ...setAimOps(scene, b, 'follow')]));
    onFocusLens(a);
    act(() => api.follow({ x: 40, y: 40 }));
    onFocusLens(b);
    act(() => api.follow({ x: 90, y: 90 }));
    const held = (lensId: string) => scene.overrides.has(`${lensId}:reticle` as never);
    return { scene, api, a, b, held };
  }

  it('keeps each lens’s held pose when the focus moves to another', () => {
    const { a, b, held } = twoFollowing();
    expect(held(a)).toBe(true);
    expect(held(b)).toBe(true);
  });

  it('lets go of one lens’s hold and leaves the other’s', () => {
    const { api, a, b, held } = twoFollowing();
    act(() => api.unfollow(a));
    expect(held(a)).toBe(false);
    expect(held(b)).toBe(true);
  });

  it('lets go of a lens’s hold when another aim takes it out of Follow', () => {
    const { scene, api, a, b, held } = twoFollowing();
    act(() => api.apply(setAimOps(scene, b, 'glass')));
    expect(held(a)).toBe(true);
    expect(held(b)).toBe(false);
  });

  it('lets go of the holds when an undo takes their lenses out of Follow', () => {
    const { scene, a, b, held } = twoFollowing();
    act(() => scene.history.undo());
    expect(held(a)).toBe(false);
    expect(held(b)).toBe(false);
  });
});

describe('a host’s re-measuring', () => {
  it('looks again when a pane’s camera moves, which writes the trial’s view', () => {
    // A proxy: jsdom lays nothing out, so this asserts the re-measure a zoom or pan triggers, not what the lens then
    // shows. Panning or zooming a pane writes the trial's `view` into its record (labkit's `updateTrialView`).
    const live = { remeasure: vi.fn() } as unknown as Remeasurable;
    const remeasure = live.remeasure as ReturnType<typeof vi.fn>;
    let trials = [{ id: 't1', view: { zoom: 1, pan: { x: 0, y: 0 } } }];
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LabContext.Provider value={{ trials, mode: 'light' } as unknown as LabContextValue}>
        {children}
      </LabContext.Provider>
    );
    const sources = [live];
    const { rerender } = renderHook(() => useLensRemeasure(sources, null, () => {}), { wrapper });
    const before = remeasure.mock.calls.length;
    trials = [{ id: 't1', view: { zoom: 2, pan: { x: 40, y: 0 } } }];
    rerender();
    expect(remeasure.mock.calls.length).toBe(before + 1);
  });

  it('looks again when a new story’s host stops being pending, which a hit test skips until then', async () => {
    const live = { remeasure: vi.fn() } as unknown as Remeasurable;
    const remeasure = live.remeasure as ReturnType<typeof vi.fn>;
    const body = document.body.appendChild(document.createElement('div'));
    const host = body.appendChild(document.createElement('div'));
    host.setAttribute('data-pending', '');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <LabContext.Provider value={{ trials: [], mode: 'light' } as unknown as LabContextValue}>
        {children}
      </LabContext.Provider>
    );
    const sources = [live];
    renderHook(() => useLensRemeasure(sources, body, () => {}), { wrapper });
    const before = remeasure.mock.calls.length;
    host.removeAttribute('data-pending');
    await act(async () => {});
    expect(remeasure.mock.calls.length).toBe(before + 1);
    body.remove();
  });
});
