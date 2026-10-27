import { asNodeId, createScene, ellipsePath, PathBuilder, type PolygonPath, type RectPose, useSelection } from '@weasel-js/core';
import { useDistortTool, warpPreset } from '@weasel-js/path-tools';
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
import { useMemo } from 'react';
import { expandWarpCommand, pathLeaf, useWarpLabActions } from './warpLab';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const FEATURES = ['draw', warpPreset] as const;

const config = f.schema({
  mode: f.enum('perspective', [
    { value: 'free', label: 'Free' },
    { value: 'perspective', label: 'Perspective' },
  ]).radio().label('Mode'),
  tolerance: f.number(0.5).range(0.05, 5).step(0.05).suffix('px').label('Refit tolerance'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

/** A 6 × 4 checkerboard as one even-odd path, so straight lines show what each mode keeps. */
function checkerboard(x: number, y: number, cell: number): PolygonPath {
  const b = new PathBuilder();
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      if ((r + c) % 2) continue;
      const cx = x + c * cell;
      const cy = y + r * cell;
      b.moveTo(cx, cy).lineTo(cx + cell, cy).lineTo(cx + cell, cy + cell).lineTo(cx, cy + cell).close();
    }
  }
  return { ...b.build(), fillRule: 'evenodd' };
}

const createLabScene = () =>
  createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      pathLeaf('board', checkerboard(80, 80, 40), '#5b7fa8'),
      pathLeaf('disc', ellipsePath({ x: 340, y: 100, width: 120, height: 120 }) as PolygonPath, '#d4a574'),
    ],
  });

const SELECTED = [asNodeId('board'), asNodeId('disc')];

function DistortTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const selection = useSelection({ mode: 'multi', initial: SELECTED });
  const { mode, tolerance } = ctx.config;
  const settings = useMemo(() => ({ mode, tolerance }), [mode, tolerance]);
  useWarpLabActions(ctx.trial.id, 'distort', settings);
  const distort = useDistortTool(settings);
  return (
    <TrialSceneCanvas
      features={FEATURES}
      scene={scene}
      selection={selection}
      trial={ctx.trial}
      tools={{ distort }}
    />
  );
}

const distortInstrument = defineInstrument<State, Config>({
  name: 'Distort',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' },
      { id: 'distort', label: 'Distort', icon: icon('path-tools:distort'), shortcut: 'F' },
    ],
    initial: 'distort',
  },
  chrome: [expandWarpCommand],
  render: (ctx) => <DistortTrial ctx={ctx} />,
});

export function DistortLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Perspective and free distort" instruments={[distortInstrument]} defaultInstrument="Distort" />
    </div>
  );
}
