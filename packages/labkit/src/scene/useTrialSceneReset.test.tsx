import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createScene, type Scene } from '@weasel-js/core';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import type { RenderContext } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { type SceneTrialState, useTrialScene } from './useTrialScene';
import { useTrialSceneReset } from './useTrialSceneReset';

type Pose = { x: number; y: number; width: number; height: number };
type State = SceneTrialState<unknown, 'main', Pose>;

const create = () => createScene<unknown, 'main', Pose>({ systemLayers: [{ id: 'main' }] });

describe('useTrialSceneReset', () => {
  it('calls back on Reset, after the fresh scene has loaded', async () => {
    let live: Scene<unknown, 'main', Pose> | null = null;
    const seen: number[] = [];
    function Body({ ctx }: { ctx: RenderContext<State, Record<string, never>> }) {
      const scene = useTrialScene(ctx, create);
      live = scene;
      useTrialSceneReset(scene, () => seen.push(scene.nodes.size));
      return null;
    }
    const instrument = defineInstrument<State, Record<string, never>>({
      name: 'Scene',
      initialState: () => ({ scene: null }),
      undo: {},
      render: (ctx) => <Body ctx={ctx} />,
    });
    await renderSettled(<Lab instruments={[instrument]} />, { wrapper: withIcons });
    act(() => {
      live!.add({
        kind: 'mark',
        layer: 'main',
        data: {},
        pose: { x: 0, y: 0, width: 10, height: 10 },
      });
    });
    expect(seen).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Reset trial' }));
    expect(seen).toEqual([0]);
  });
});
