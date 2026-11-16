import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { asNodeId, createScene, type Scene } from '@weasel-js/core';
import { drawPreset } from '@weasel-js/editing';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import type { ConfigOf } from '../config/types';
import { defineInstrument } from '../instrument/defineInstrument';
import type { RenderContext } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { useTrialConfigChange } from '../trial/trialConfigChange';
import { TrialSceneCanvas } from './TrialSceneCanvas';
import { type SceneTrialState, useTrialScene } from './useTrialScene';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

type Pose = { x: number; y: number; width: number; height: number };
type Data = { size: number };
type State = SceneTrialState<Data, 'main', Pose>;
const config = f.schema({ size: f.number(1).range(0, 100).label('Size'), grid: f.boolean(false) });
type Config = ConfigOf<typeof config>;
const ID = asNodeId('box');

const create = () =>
  createScene<Data, 'main', Pose>({
    systemLayers: [{ id: 'main' }],
    initial: [
      {
        id: ID,
        kind: 'mark',
        layer: 'main',
        data: { size: 1 },
        pose: { x: 0, y: 0, width: 10, height: 10 },
      },
    ],
  });

let live: { scene: Scene<Data, 'main', Pose>; ctx: RenderContext<State, Config>; heard: number };

/** Writes the panel's size onto the box, as a style panel writes onto a selection. */
function Body({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, create);
  live.scene = scene;
  live.ctx = ctx;
  useTrialConfigChange<Config>((next, prev) => {
    live.heard += 1;
    if (next.size !== prev.size) scene.update(ID, { data: { size: next.size } });
  });
  return <TrialSceneCanvas features={[drawPreset]} scene={scene} trial={ctx.trial} />;
}

const instrument = defineInstrument<State, Config>({
  name: 'Scene',
  config,
  initialState: () => ({ scene: null }),
  render: (ctx) => <Body ctx={ctx} />,
});

async function mount() {
  live = { scene: null as never, ctx: null as never, heard: 0 };
  await renderSettled(<Lab instruments={[instrument]} />, { wrapper: withIcons });
}

const size = () => live.scene.get(ID)?.data?.size;
const shown = () =>
  Number((screen.getByRole('spinbutton', { name: /Size/ }) as HTMLInputElement).value);
const undo = () => userEvent.click(screen.getByRole('button', { name: 'Undo' }));
const redo = () => userEvent.click(screen.getByRole('button', { name: 'Redo' }));

describe('useTrialConfigChange', () => {
  it('writes the scene inside the settings entry: one Undo takes both back, one Redo makes both again', async () => {
    await mount();
    act(() => live.ctx.setConfig('size', 7));
    expect(size()).toBe(7);
    expect(live.scene.historyEntries().length).toBe(1);
    await undo();
    expect(size()).toBe(1);
    expect(shown()).toBe(1);
    expect(live.scene.canUndo()).toBe(false);
    await redo();
    expect(size()).toBe(7);
    expect(shown()).toBe(7);
  });

  it('makes a run of writes to one setting one step', async () => {
    await mount();
    act(() => {
      for (const n of [2, 3, 4, 5]) live.ctx.setConfig('size', n);
    });
    expect(size()).toBe(5);
    await undo();
    expect(size()).toBe(1);
    expect(shown()).toBe(1);
    expect(live.scene.canUndo()).toBe(false);
    await redo();
    expect(size()).toBe(5);
  });

  it('keeps writes to two settings two steps', async () => {
    await mount();
    act(() => live.ctx.setConfig('size', 4));
    act(() => live.ctx.setConfig('grid', true));
    await undo();
    expect(size()).toBe(4);
    expect(screen.getByLabelText('Grid')).not.toBeChecked();
    await undo();
    expect(size()).toBe(1);
  });

  it('is not run by an undo, which puts the scene back with the setting', async () => {
    await mount();
    act(() => live.ctx.setConfig('size', 9));
    const heard = live.heard;
    await undo();
    await redo();
    expect(live.heard).toBe(heard);
    expect(size()).toBe(9);
  });
});
