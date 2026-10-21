import { act, renderHook } from '@testing-library/react';
import { createLensScene, lensesOf, MAX_LENSES } from '@weasel-js/labkit/loupe';
import { describe, expect, it } from 'vitest';
import type { ForgeComparison } from './conditions';
import { createApi, useLensFocus } from './ForgeLoupe';

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
