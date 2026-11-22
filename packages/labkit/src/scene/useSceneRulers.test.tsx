import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrialGuidesContext, useTrialGuides } from '../rulers/trialGuides';
import { useSceneRulers } from './useSceneRulers';

function mount(option: boolean | undefined) {
  const outer = renderHook(() => useTrialGuides(() => true));
  const guides = () => outer.result.current;
  const inner = renderHook(() => useSceneRulers(option, { layers: { grid: null } }), {
    wrapper: ({ children }) => (
      <TrialGuidesContext.Provider value={guides()}>{children}</TrialGuidesContext.Provider>
    ),
  });
  return { guides, scene: () => inner.result.current, rerender: () => inner.rerender() };
}

describe('useSceneRulers', () => {
  it('passes the props through with no rulers asked for', () => {
    const { scene, guides } = mount(undefined);
    expect(scene().ambient).toBeUndefined();
    expect(scene().layers).toEqual({ grid: null });
    expect(guides().offered).toBe(false);
  });

  it('installs the rulers, draws the guides over the scene, and offers them to the trial', () => {
    const { scene, guides } = mount(true);
    expect(scene().ambient?.map((e) => e.id)).toEqual(['lk-rulers']);
    expect(Object.keys(scene().layers ?? {})).toEqual(['grid', 'lk-guides']);
    expect(guides().offered).toBe(true);
    expect(scene().chrome).toBeNull();
  });

  it('adds the guides to the snap sources only while the guides show and snap', () => {
    const { scene, guides, rerender } = mount(true);
    expect(scene().snap).toBeUndefined();
    act(() => guides().toggle('snap'));
    rerender();
    expect(scene().snap).toBeUndefined();
    act(() => guides().toggle('guides'));
    rerender();
    expect(scene().snap?.sources?.map((s) => s.id)).toEqual(['guides']);
  });
});
