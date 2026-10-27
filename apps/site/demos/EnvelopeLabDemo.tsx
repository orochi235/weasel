import { asNodeId, createScene, PathBuilder, type PolygonPath, type RectPose, starPath, useSelection } from '@weasel-js/core';
import { useEnvelopeTool, warpPreset } from '@weasel-js/path-tools';
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
  rows: f.number(3).range(1, 8).step(1).label('Rows'),
  cols: f.number(3).range(1, 8).step(1).label('Columns'),
  mapping: f.enum('bicubic', [
    { value: 'bicubic', label: 'Bicubic' },
    { value: 'coons', label: 'Coons' },
  ]).radio().label('Mapping'),
  tolerance: f.number(0.5).range(0.05, 5).step(0.05).suffix('px').label('Refit tolerance'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

/** Five horizontal bars as one path: straight lines that show every bend. */
function stripes(x: number, y: number, width: number, height: number): PolygonPath {
  const b = new PathBuilder();
  const band = height / 9;
  for (let i = 0; i < 5; i++) {
    const top = y + 2 * i * band;
    b.moveTo(x, top).lineTo(x + width, top).lineTo(x + width, top + band).lineTo(x, top + band).close();
  }
  return b.build();
}

const createLabScene = () =>
  createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      pathLeaf('banner', stripes(100, 100, 300, 180), '#5b7fa8'),
      pathLeaf('star', starPath({ x: 520, y: 190 }, 70, 5, 30, -Math.PI / 2), '#d4a574'),
    ],
  });

const SELECTED = [asNodeId('banner')];

function EnvelopeTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const selection = useSelection({ mode: 'multi', initial: SELECTED });
  const { rows, cols, mapping, tolerance } = ctx.config;
  const settings = useMemo(() => ({ rows, cols, mapping, tolerance }), [rows, cols, mapping, tolerance]);
  useWarpLabActions(ctx.trial.id, 'envelope', settings);
  const envelope = useEnvelopeTool(settings);
  return (
    <TrialSceneCanvas
      features={FEATURES}
      scene={scene}
      selection={selection}
      trial={ctx.trial}
      tools={{ envelope }}
    />
  );
}

const envelopeInstrument = defineInstrument<State, Config>({
  name: 'Envelope',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' },
      { id: 'envelope', label: 'Envelope', icon: icon('path-tools:envelope'), shortcut: 'M' },
    ],
    initial: 'envelope',
  },
  chrome: [expandWarpCommand],
  render: (ctx) => <EnvelopeTrial ctx={ctx} />,
});

export function EnvelopeLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Envelope mesh" instruments={[envelopeInstrument]} defaultInstrument="Envelope" />
    </div>
  );
}
