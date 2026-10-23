import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createScene, type Scene, type ToolsApi } from '@weasel-js/core';
import { giveKeys } from '@weasel-js/react/testing/giveKeys';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { icon } from '../icons.gen';
import { defineInstrument } from '../instrument/defineInstrument';
import type { RenderContext } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { TrialSceneCanvas } from './TrialSceneCanvas';
import { type SceneTrialState, useTrialScene } from './useTrialScene';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

type Pose = { x: number; y: number; width: number; height: number };
type State = SceneTrialState<{ kind: 'rect' }, 'main', Pose>;

const create = () =>
  createScene<{ kind: 'rect' }, 'main', Pose>({
    systemLayers: [{ id: 'main' }],
    initial: [
      {
        kind: 'mark',
        layer: 'main',
        data: { kind: 'rect' },
        pose: { x: 0, y: 0, width: 10, height: 10 },
      },
    ],
  });

let live: { scene: Scene<{ kind: 'rect' }, 'main', Pose>; tools: ToolsApi | null };

function Body({ ctx }: { ctx: RenderContext<State, Record<string, never>> }) {
  const scene = useTrialScene(ctx, create);
  live.scene = scene;
  return (
    <TrialSceneCanvas
      features={['draw']}
      defaultTools={['rect']}
      scene={scene}
      trial={ctx.trial}
      onToolsCreated={(tools) => {
        live.tools = tools;
      }}
    />
  );
}

const instrument = defineInstrument<State, Record<string, never>>({
  name: 'Scene',
  defaultConfig: () => ({}),
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: icon('core:select') },
      { id: 'rect', label: 'Rectangle', icon: icon('core:rect') },
    ],
  },
  render: (ctx) => <Body ctx={ctx} />,
});

async function mount(which = instrument) {
  live = { scene: null as never, tools: null };
  return renderSettled(<Lab instruments={[which]} defaultInstrument="Scene" />, {
    wrapper: withIcons,
  });
}

const addOne = () =>
  act(() => {
    live.scene.add({
      kind: 'mark',
      layer: 'main',
      data: { kind: 'rect' },
      pose: { x: 20, y: 0, width: 10, height: 10 },
    });
  });

const modZ = () =>
  act(() => {
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }),
    );
  });

describe('<TrialSceneCanvas>', () => {
  it("names its canvas after the trial's title, which is what devtools lists it by", async () => {
    await mount();
    expect(window.__weaselDevtools__?.roots().map((r) => r.label)).toContain('Scene');
  });

  it("steps the scene's history from the trial's Undo and Redo", async () => {
    await mount();
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toBeDisabled();
    addOne();
    expect(live.scene.nodes.size).toBe(2);
    expect(undo).not.toBeDisabled();
    await userEvent.click(undo);
    expect(live.scene.nodes.size).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(live.scene.nodes.size).toBe(2);
  });

  it('undoes one step per Mod+Z with the canvas holding the keys as well', async () => {
    const { container } = await mount();
    giveKeys(container.querySelector('.lk-trial-scene canvas'));
    addOne();
    addOne();
    modZ();
    expect(live.scene.nodes.size).toBe(2);
  });

  it("leaves Mod+Z to the scene's own keys when the instrument declares no undo", async () => {
    const { undo: _undo, ...bare } = instrument;
    const { container } = await mount(bare);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    giveKeys(container.querySelector('.lk-trial-scene canvas'));
    addOne();
    modZ();
    expect(live.scene.nodes.size).toBe(1);
  });

  it("keeps the trial's tool slot and the canvas's active tool one value", async () => {
    await mount();
    expect(live.tools?.active).toBe('select');
    await userEvent.click(screen.getByRole('button', { name: 'Rectangle' }));
    expect(live.tools?.active).toBe('rect');
    act(() => live.tools?.setActive('select'));
    expect(screen.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Rectangle' })).not.toHaveAttribute('aria-current');
  });

  it('loads the scene a fresh trial opens on when Reset clears the state', async () => {
    await mount();
    const scene = live.scene;
    addOne();
    await userEvent.click(screen.getByRole('button', { name: 'Reset trial' }));
    expect(live.scene).toBe(scene);
    expect(live.scene.nodes.size).toBe(1);
  });
});
