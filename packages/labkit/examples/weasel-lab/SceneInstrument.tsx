import { createScene, solid } from '@weasel-js/core';
import type { AddNodeSpec, Fill, RectPose, UnitSystem } from '@weasel-js/core';
import { createGridLayer, gridSnapSource } from '@weasel-js/guides';
import { useMemo } from 'react';
import {
  type ConfigOf,
  defineInstrument,
  f,
  type RenderContext,
  type SceneTrialState,
  TrialSceneCanvas,
  useTrialScene,
} from '@weasel-js/labkit';

interface NodeData {
  fill: Fill;
}
type Pose = RectPose;
type LayerId = 'default';

type SceneState = SceneTrialState<NodeData, LayerId, Pose>;
/** Declared once: the values, their types, and the controls that edit them.
 *  `SceneConfig` is derived, so a renamed key cannot drift from the panel. */
const sceneConfig = f.schema({
  showGrid: f.boolean(true).label('Show grid'),
  cellSize: f.number(20).range(5, 80).step(5).label('Grid spacing'),
});
type SceneConfig = ConfigOf<typeof sceneConfig>;

const UNITS: UnitSystem = { base: 'px', units: { px: 1 } };

export const INITIAL_NODES: readonly AddNodeSpec<NodeData, LayerId, Pose>[] = [
  {
    kind: 'leaf',
    layer: 'default',
    pose: { x: 40, y: 40, width: 80, height: 60 },
    data: { fill: { paint: solid('#7fb069') } },
  },
  {
    kind: 'leaf',
    layer: 'default',
    pose: { x: 180, y: 120, width: 100, height: 80 },
    data: { fill: { paint: solid('#d4a574') } },
  },
  {
    kind: 'leaf',
    layer: 'default',
    pose: { x: 340, y: 60, width: 70, height: 70 },
    data: { fill: { paint: solid('#a48bd4') } },
  },
];

const SYSTEM_LAYERS = [{ id: 'default' as const }];

const createLabScene = () =>
  createScene<NodeData, LayerId, Pose>({ systemLayers: SYSTEM_LAYERS, initial: INITIAL_NODES });

function SceneBody({ ctx }: { ctx: RenderContext<SceneState, SceneConfig> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const { showGrid, cellSize } = ctx.config;

  const snap = useMemo(
    () => ({ sources: [gridSnapSource({ spacing: { value: cellSize, unit: 'px' }, unitSystem: UNITS })] }),
    [cellSize],
  );

  const layers = useMemo(
    () => ({
      grid: showGrid
        ? {
            layer: createGridLayer({
              spacing: { value: cellSize, unit: 'px' },
              unitSystem: UNITS,
              bounds: () => ({ x: 0, y: 0, width: 2000, height: 2000 }),
              accentEvery: 5,
            }),
          }
        : null,
    }),
    [showGrid, cellSize],
  );

  return (
    <TrialSceneCanvas
      features={['pick', 'move', 'transform']}
      scene={scene}
      trial={ctx.trial}
      snap={snap}
      layers={layers}
    />
  );
}

export const SceneInstrument = defineInstrument<SceneState, SceneConfig>({
  name: 'WeaselScene',
  config: sceneConfig,
  initialState: () => ({ scene: null }),
  undo: {},
  render: (ctx) => <SceneBody ctx={ctx} />,
});
