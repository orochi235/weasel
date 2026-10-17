import { editingAnchors, never, type RectPose } from '@weasel-js/core';
import { createCurvatureCombPreset } from '@weasel-js/path-tools';
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
import { createPathLabScene, useSeededPathEdit } from './pathEditLabSeed';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const config = f.schema({
  comb: f.boolean(true).label('Show comb'),
  scale: f.number(3000).range(200, 12000).step(100).label('Comb scale'),
  teeth: f.number(24).range(4, 64).step(1).label('Teeth per segment'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

// Smooth at both inner anchors, but each one's handles are lopsided, so the
// comb jumps there.
const createLabScene = () =>
  createPathLabScene('M80 300 C80 180 160 120 260 120 C300 120 440 140 460 260 C470 320 560 360 620 300');

function CombTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const { selection, pathEdit, redrawOn } = useSeededPathEdit();
  const { comb, scale, teeth } = ctx.config;

  const chromeVisibility = useMemo(() => ({ 'path-edit.comb': comb ? editingAnchors : never }), [comb]);
  const features = useMemo(() => [
    'pick', 'move', 'paths', createCurvatureCombPreset(() => ({ scale, samplesPerSegment: teeth })),
  ] as const, [scale, teeth]);

  return (
    <TrialSceneCanvas
      features={features}
      scene={scene}
      trial={ctx.trial}
      selection={selection}
      pathEdit={pathEdit}
      redrawOn={redrawOn}
      chromeVisibility={chromeVisibility}
    />
  );
}

const combInstrument = defineInstrument<State, Config>({
  name: 'Comb',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: { tools: [{ id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' }] },
  render: (ctx) => <CombTrial ctx={ctx} />,
});

export function CurvatureCombLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Curvature comb" instruments={[combInstrument]} defaultInstrument="Comb" />
    </div>
  );
}
