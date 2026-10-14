import { createScene, type RectPose, solid } from '@weasel-js/core';
import { createGridLayer, gridSnapStrategy, roundToCell } from '@weasel-js/guides';
import {
  type ConfigOf,
  defineInstrument,
  f,
  Lab,
  type RenderContext,
  type SceneTrialState,
  TrialSceneCanvas,
  useTrialScene,
} from '@weasel-js/labkit';
import { PenIcon, RectIcon, SelectIcon } from '@weasel-js/ui';
import { useMemo } from 'react';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';

const config = f.schema({
  snap: f.boolean(true).label('Snap to grid'),
  spacing: f.number(20).range(5, 80).step(5).suffix('px').label('Grid spacing'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

const shape = (x: number, y: number, width: number, height: number, color: string) => ({
  kind: 'leaf' as const,
  layer: 'default' as const,
  pose: { x, y, width, height },
  data: { fill: { paint: solid(color) } },
});

const createLabScene = () =>
  createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      shape(60, 60, 120, 80, '#7fb069'),
      shape(240, 120, 100, 100, '#d4a574'),
      shape(400, 60, 80, 120, '#a48bd4'),
    ],
  });

function SceneTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const { snap, spacing } = ctx.config;

  const selectTool = useMemo(
    () => ({ snap: snap ? gridSnapStrategy<RectPose>(spacing) : undefined }),
    [snap, spacing],
  );
  const toolOptions = useMemo(
    () => ({
      snapPoint: snap
        ? (p: { x: number; y: number }) => ({ x: roundToCell(p.x, spacing), y: roundToCell(p.y, spacing) })
        : undefined,
    }),
    [snap, spacing],
  );
  const layers = useMemo(
    () => ({
      grid: {
        layer: createGridLayer({
          spacing,
          bounds: () => ({ x: -2000, y: -2000, width: 4000, height: 4000 }),
          accentEvery: 5,
        }),
      },
    }),
    [spacing],
  );

  return (
    <TrialSceneCanvas
      features={['draw']}
      defaultTools={['rect', 'pen']}
      scene={scene}
      trial={ctx.trial}
      selectTool={selectTool}
      toolOptions={toolOptions}
      layers={layers}
    />
  );
}

const sceneInstrument = defineInstrument<State, Config>({
  name: 'Scene',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: SelectIcon, shortcut: 'V' },
      { id: 'rect', label: 'Rectangle', icon: RectIcon, shortcut: 'R' },
      { id: 'pen', label: 'Pen', icon: PenIcon, shortcut: 'P' },
    ],
  },
  render: (ctx) => <SceneTrial ctx={ctx} />,
});

export function SceneLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Scene in a lab" instruments={[sceneInstrument]} defaultInstrument="Scene" />
    </div>
  );
}
