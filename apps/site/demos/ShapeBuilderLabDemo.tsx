import {
  asNodeId, createScene, ellipsePath, type Path, type RectPose, solid, useLatest, useSelection,
} from '@weasel-js/core';
import { useShapeBuilderTool } from '@weasel-js/path-tools';
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
import { useEffect, useMemo } from 'react';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const config = f.schema({
  mode: f.enum('merge', [
    { value: 'merge', label: 'Merge' },
    { value: 'delete', label: 'Delete' },
  ]).toggle().label('A plain drag'),
});
type Config = ConfigOf<typeof config>;
type Data = { path: Path; fill: { paint: ReturnType<typeof solid> } };
type State = SceneTrialState<Data, 'default', RectPose>;

const UNIT_CIRCLE = ellipsePath({ x: 0, y: 0, width: 1, height: 1 });
const R = 90;
const circle = (id: string, cx: number, cy: number, color: string) => ({
  id: asNodeId(id),
  kind: 'mark' as const,
  layer: 'default' as const,
  pose: { x: cx - R, y: cy - R, width: R * 2, height: R * 2 },
  data: { path: UNIT_CIRCLE, fill: { paint: solid(color) } },
});

const SEED = [
  circle('left', 200, 170, '#7fb069'),
  circle('right', 300, 170, '#d4a574'),
  circle('bottom', 250, 255, '#a48bd4'),
];
const SEED_IDS = SEED.map((n) => n.id);

const createLabScene = () =>
  createScene<Data, 'default', RectPose>({ systemLayers: [{ id: 'default' }], initial: SEED });

function ShapeBuilderTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const selection = useSelection({ scene, mode: 'multi', initial: SEED_IDS });
  const shapeBuilder = useShapeBuilderTool({ mode: ctx.config.mode });
  const tools = useMemo(() => ({ shapeBuilder }), [shapeBuilder]);

  // A fresh or reset trial opens on the three circles, selected.
  const fresh = ctx.state.scene === null;
  const latest = useLatest(selection);
  useEffect(() => {
    if (fresh) latest.current.set(SEED_IDS);
  }, [fresh, latest]);

  return (
    <TrialSceneCanvas
      features={['draw']}
      defaultTools={[]}
      tools={tools}
      scene={scene}
      selection={selection}
      trial={ctx.trial}
    />
  );
}

const shapeBuilderInstrument = defineInstrument<State, Config>({
  name: 'Shape builder',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    initial: 'shapeBuilder',
    tools: [
      { id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' },
      { id: 'shapeBuilder', label: 'Shape Builder', icon: icon('core:union'), shortcut: 'Shift+M' },
    ],
  },
  render: (ctx) => <ShapeBuilderTrial ctx={ctx} />,
});

export function ShapeBuilderLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Shape builder" instruments={[shapeBuilderInstrument]} defaultInstrument="Shape builder" />
    </div>
  );
}
