import { type ActionTunings, editingAnchors, never, type RectPose } from '@weasel-js/core';
import { createCurvatureCombPreset, harmonizePreset } from '@weasel-js/path-tools';
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
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import { useMemo } from 'react';
import { createPathLabScene, useSeededPathEdit } from './pathEditLabSeed';
import s from './HarmonizeLabDemo.module.css';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const config = f.schema({
  comb: f.boolean(true).label('Show comb'),
  scale: f.number(4000).range(200, 12000).step(100).label('Comb scale'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

// A closed blob, smooth at every anchor, with each anchor's two handles of
// different lengths: the comb steps at all four.
const createLabScene = () =>
  createPathLabScene(
    'M200 100 C260 100 420 110 460 200 C480 245 470 330 380 340 C299 349 160 360 140 260 C125 185 160 100 200 100 Z',
  );

// The command has no key of its own; this canvas gives it one.
const tune: ActionTunings = { harmonizeAnchors: { bindings: [{ kind: 'key', key: 'h' }] } };

function HarmonizeTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const { selection, pathEdit, redrawOn } = useSeededPathEdit();
  const { comb, scale } = ctx.config;

  const chromeVisibility = useMemo(() => ({ 'path-edit.comb': comb ? editingAnchors : never }), [comb]);
  const features = useMemo(() => [
    'pick', 'move', 'paths', harmonizePreset, createCurvatureCombPreset(() => ({ scale })),
  ] as const, [scale]);

  return (
    <div className={s.trial}>
      <div className={s.bar}>
        <ActionBar group="anchors" />
      </div>
      <TrialSceneCanvas
        features={features}
        scene={scene}
        trial={ctx.trial}
        selection={selection}
        pathEdit={pathEdit}
        redrawOn={redrawOn}
        chromeVisibility={chromeVisibility}
        tune={tune}
      />
    </div>
  );
}

const harmonizeInstrument = defineInstrument<State, Config>({
  name: 'Harmonize',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: { tools: [{ id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' }] },
  render: (ctx) => <HarmonizeTrial ctx={ctx} />,
});

export function HarmonizeLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Harmonize curvature" instruments={[harmonizeInstrument]} defaultInstrument="Harmonize" />
    </div>
  );
}
