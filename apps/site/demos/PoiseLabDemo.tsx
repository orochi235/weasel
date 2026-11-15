import { editingAnchors, never, type RectPose, useSelection, movePreset, pathsPreset, pickPreset } from '@weasel-js/core';
import { poisePreset, createCurvatureCombPreset } from '@weasel-js/path-tools';
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
import { createPathLabScene, EDITED_ID, EDITED_OPENING } from './pathEditLabSeed';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const config = f.schema({
  poise: f.boolean(true).label('Show poise lines'),
  comb: f.boolean(false).label('Show comb'),
  scale: f.number(3000).range(200, 12000).step(100).label('Comb scale'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

// Two curved segments, the first with one handle much longer than the other.
const createLabScene = () =>
  createPathLabScene('M100 320 C140 200 260 140 340 140 C420 140 520 180 560 320');

function PoiseTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const selection = useSelection({ scene, initial: [EDITED_ID] });
  const { poise, comb, scale } = ctx.config;

  const chromeVisibility = useMemo(() => ({
    'path-edit.poise': poise ? editingAnchors : never,
    'path-edit.comb': comb ? editingAnchors : never,
  }), [poise, comb]);
  const features = useMemo(() => [
    pickPreset, movePreset, pathsPreset, poisePreset, createCurvatureCombPreset(() => ({ scale })),
  ] as const, [scale]);

  return (
    <TrialSceneCanvas
      features={features}
      scene={scene}
      trial={ctx.trial}
      selection={selection}
      defaultPathEdit={EDITED_OPENING}
      chromeVisibility={chromeVisibility}
    />
  );
}

const poiseInstrument = defineInstrument<State, Config>({
  name: 'Poise',
  config,
  initialState: () => ({ scene: null }),
  tools: { tools: [{ id: 'select', label: 'Select', icon: icon('core:select') }] },
  render: (ctx) => <PoiseTrial ctx={ctx} />,
});

export function PoiseLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Poise" instruments={[poiseInstrument]} />
    </div>
  );
}
