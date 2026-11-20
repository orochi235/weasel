import { act, renderHook } from '@testing-library/react';
import { createScene, type RectPose } from '@weasel-js/core';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { type SceneTrialState, useTrialScene } from './useTrialScene';

type State = SceneTrialState<{ n: number }, 'main', RectPose>;
const POSE: RectPose = { x: 0, y: 0, width: 10, height: 10 };
const create = () =>
  createScene<{ n: number }, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    initial: [{ kind: 'mark', layer: 'main', data: { n: 0 }, pose: POSE }],
  });

function useHarness() {
  const [state, setState] = useState<State>({ scene: null });
  const scene = useTrialScene({ state, setState }, create);
  return { state, setState, scene };
}

describe('useTrialScene', () => {
  it('leaves state.scene null when a Reset clears a scene that has history', () => {
    const { result } = renderHook(useHarness);
    act(() => {
      result.current.scene.add({ kind: 'mark', layer: 'main', data: { n: 1 }, pose: POSE });
    });
    expect(result.current.state.scene).not.toBeNull();
    act(() => result.current.setState({ scene: null }));
    expect(result.current.scene.nodes.size).toBe(1);
    expect(result.current.state.scene).toBeNull();
  });

  it('keeps an outside write as written, with its nodes, over a scene that has history', () => {
    const { result } = renderHook(useHarness);
    const other = create();
    other.add({ kind: 'mark', layer: 'main', data: { n: 1 }, pose: POSE });
    other.add({ kind: 'mark', layer: 'main', data: { n: 2 }, pose: POSE });
    const outside = other.toJSON();
    act(() => {
      result.current.scene.add({ kind: 'mark', layer: 'main', data: { n: 9 }, pose: POSE });
    });
    act(() => result.current.setState({ scene: outside }));
    expect(result.current.scene.nodes.size).toBe(3);
    expect(result.current.state.scene).toBe(outside);
  });
});
