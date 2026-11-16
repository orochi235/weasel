import { editingAnchors, never, movePreset, pickPreset } from '@weasel-js/core';
import { pathsPreset } from '@weasel-js/path-tools';
import { poisePreset, createCurvatureCombPreset } from '@weasel-js/path-tools';
import {
  type ConfigOf,
  defineInstrument,
  f,
  Lab,
  type RenderContext,
  TrialSceneCanvas,
} from '@weasel-js/labkit';
import { useMemo } from 'react';
import { type PathLabState, usePathEditTrial } from './pathEditLabScene';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const config = f.schema({
  poise: f.boolean(true).label('Show poise lines'),
  comb: f.boolean(false).label('Show comb'),
  scale: f.number(3000).range(200, 12000).step(100).label('Comb scale'),
});
type Config = ConfigOf<typeof config>;

// Two curved segments, the first with one handle much longer than the other.
const ARCS = 'M100 320 C140 200 260 140 340 140 C420 140 520 180 560 320';

function PoiseTrial({ ctx }: { ctx: RenderContext<PathLabState, Config> }) {
  const { scene, selection, pathEdit } = usePathEditTrial(ctx, ARCS);
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
      pathEdit={pathEdit}
      chromeVisibility={chromeVisibility}
    />
  );
}

const poiseInstrument = defineInstrument<PathLabState, Config>({
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
