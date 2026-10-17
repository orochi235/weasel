import { editingAnchors, never, type RectPose } from '@weasel-js/core';
import { balancePreset, createCurvatureCombPreset } from '@weasel-js/path-tools';
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
import { icon } from '../icon';

const config = f.schema({
  balance: f.boolean(true).label('Show balance lines'),
  comb: f.boolean(false).label('Show comb'),
  scale: f.number(3000).range(200, 12000).step(100).label('Comb scale'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

// Two curved segments, the first with one handle much longer than the other.
const createLabScene = () =>
  createPathLabScene('M100 320 C140 200 260 140 340 140 C420 140 520 180 560 320');

function BalanceTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const { selection, pathEdit, redrawOn } = useSeededPathEdit();
  const { balance, comb, scale } = ctx.config;

  const chromeVisibility = useMemo(() => ({
    'path-edit.balance': balance ? editingAnchors : never,
    'path-edit.comb': comb ? editingAnchors : never,
  }), [balance, comb]);
  const features = useMemo(() => [
    'pick', 'move', 'paths', balancePreset, createCurvatureCombPreset(() => ({ scale })),
  ] as const, [scale]);

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

const balanceInstrument = defineInstrument<State, Config>({
  name: 'Balance',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: { tools: [{ id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' }] },
  render: (ctx) => <BalanceTrial ctx={ctx} />,
});

export function BalanceHandlesLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Balance handles" instruments={[balanceInstrument]} defaultInstrument="Balance" />
    </div>
  );
}
