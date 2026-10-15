import { createScene, ellipsePath, pathFromD, type PathSnapOptions } from '@weasel-js/core';
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
import { LineIcon, PenIcon, SelectIcon } from '@weasel-js/ui';
import { useMemo } from 'react';
import { strokeNode } from './labs/strokeNode';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';

const config = f.schema({
  kinds: f.group({
    intersection: f.boolean(true).label('Intersections'),
    tangent: f.boolean(true).label('Tangent points'),
    perpendicular: f.boolean(true).label('Perpendicular foot'),
    midpoint: f.boolean(true).label('Midpoints'),
    extremum: f.boolean(true).label('Curve extremes'),
    quadrant: f.boolean(true).label('Quadrant points'),
    nearest: f.boolean(true).label('Nearest on path'),
  }).section('Snap to'),
  radius: f.number(8).range(2, 24).step(1).suffix('px').label('Snap radius'),
  marker: f.boolean(true).label('Show marker'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', unknown>;

const createLabScene = () =>
  createScene<unknown, 'default', unknown>({
    systemLayers: [{ id: 'default' }],
    initial: [
      strokeNode('rise', pathFromD('M80 380 L520 50'), '#7fb069'),
      strokeNode('fall', pathFromD('M80 80 L560 440'), '#7fb069'),
      strokeNode('ring', ellipsePath({ x: 560, y: 140, width: 160, height: 160 }), '#a48bd4', true),
      strokeNode('wave', pathFromD('M80 470 C200 380 360 560 520 470'), '#d4a574'),
    ],
  });

function PathSnapTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const { kinds, radius, marker } = ctx.config;
  const toolOptions = useMemo(() => ({
    pathSnap: { kinds: { ...kinds }, radius, marker } satisfies PathSnapOptions,
  }), [kinds, radius, marker]);
  return (
    <TrialSceneCanvas
      features={['draw']}
      defaultTools={['line', 'pen']}
      scene={scene}
      trial={ctx.trial}
      toolOptions={toolOptions}
    />
  );
}

const snapInstrument = defineInstrument<State, Config>({
  name: 'Path snapping',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    initial: 'line',
    tools: [
      { id: 'line', label: 'Line', icon: LineIcon, shortcut: '\\' },
      { id: 'pen', label: 'Pen', icon: PenIcon, shortcut: 'P' },
      { id: 'select', label: 'Select', icon: SelectIcon, shortcut: 'V' },
    ],
  },
  render: (ctx) => <PathSnapTrial ctx={ctx} />,
});

export function PathSnapLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Path snapping" instruments={[snapInstrument]} defaultInstrument="Path snapping" />
    </div>
  );
}
