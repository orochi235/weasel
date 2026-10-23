import { createScene, solid } from '@weasel-js/core';
import type { AddNodeSpec, Fill, RectPose, UnitSystem } from '@weasel-js/core';
import { createGridLayer } from '@weasel-js/guides';
import { useMemo } from 'react';
import {
  defineInstrument,
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
type StubState = SceneTrialState<NodeData, LayerId, Pose>;
interface StubConfig {
  showGrid: boolean;
}

const UNITS: UnitSystem = { base: 'px', units: { px: 1 } };
const SYSTEM_LAYERS = [{ id: 'default' as const }];
export const INITIAL_NODES: readonly AddNodeSpec<NodeData, LayerId, Pose>[] = [
  {
    kind: 'mark',
    layer: 'default',
    pose: { x: 120, y: 80, width: 120, height: 80 },
    data: { fill: { paint: solid('#7fb069') } },
  },
];

const createStubScene = () =>
  createScene<NodeData, LayerId, Pose>({ systemLayers: SYSTEM_LAYERS, initial: INITIAL_NODES });

function Body({ ctx }: { ctx: RenderContext<StubState, StubConfig> }) {
  const scene = useTrialScene(ctx, createStubScene);
  const { showGrid } = ctx.config;
  const layers = useMemo(
    () => ({
      grid: showGrid
        ? {
            layer: createGridLayer({
              spacing: { value: 20, unit: 'px' },
              unitSystem: UNITS,
              bounds: () => ({ x: 0, y: 0, width: 2000, height: 2000 }),
              accentEvery: 5,
            }),
          }
        : null,
    }),
    [showGrid],
  );

  return (
    <TrialSceneCanvas
      features={['pick', 'move', 'transform']}
      scene={scene}
      trial={ctx.trial}
      layers={layers}
    />
  );
}

export const StubInstrument = defineInstrument<StubState, StubConfig>({
  name: 'Stub',
  defaultConfig: () => ({ showGrid: true }),
  initialState: () => ({ scene: null }),
  configSchema: () => [
    { key: 'showGrid', label: 'Show grid', type: 'checkbox', default: true },
  ],
  undo: {},
  render: (ctx) => <Body ctx={ctx} />,
});
