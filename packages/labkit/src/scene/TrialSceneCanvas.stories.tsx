import { asNodeId, createScene } from '@weasel-js/core';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { defineInstrument, Lab } from '@weasel-js/labkit';
import type { RenderContext } from '../instrument/types';
import { TrialSceneCanvas } from './TrialSceneCanvas';
import { type SceneTrialState, useTrialScene } from './useTrialScene';

type Pose = { x: number; y: number; width: number; height: number };
type State = SceneTrialState<{ kind: 'rect' }, 'main', Pose>;

const create = () =>
  createScene<{ kind: 'rect' }, 'main', Pose>({
    systemLayers: [{ id: 'main' }],
    initial: [
      {
        id: asNodeId('box'),
        kind: 'mark',
        layer: 'main',
        data: { kind: 'rect' },
        pose: { x: 40, y: 40, width: 120, height: 80 },
      },
    ],
  });

function Body({ ctx }: { ctx: RenderContext<State, Record<string, never>> }) {
  const scene = useTrialScene(ctx, create);
  return <TrialSceneCanvas scene={scene} trial={ctx.trial} />;
}

const sceneTrial = defineInstrument<State, Record<string, never>>({
  name: 'Scene',
  initialState: () => ({ scene: null }),
  undo: {},
  render: (ctx) => <Body ctx={ctx} />,
});

const meta: Meta<typeof Lab> = {
  title: 'labkit/Scene/TrialSceneCanvas',
  component: Lab,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof Lab>;

/** A trial drawing a scene: the trial's own scene, sized to its tile, under the lab's undo. */
export const Default: Story = {
  args: { instruments: [sceneTrial], opening: ['Scene'], title: 'Scene' },
};
