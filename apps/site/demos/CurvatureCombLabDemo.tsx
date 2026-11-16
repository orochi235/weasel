import { editingAnchors, never } from '@weasel-js/core';
import { pathsPreset } from '@weasel-js/path-tools';
import { createCurvatureCombPreset } from '@weasel-js/path-tools';
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
import { movePreset, pickPreset } from '@weasel-js/editing';

const config = f.schema({
  comb: f.boolean(true).label('Show comb'),
  scale: f.number(3000).range(200, 12000).step(100).label('Comb scale'),
  teeth: f.number(24).range(4, 64).step(1).label('Teeth per segment'),
});
type Config = ConfigOf<typeof config>;

// Smooth at both inner anchors, but each one's handles are lopsided, so the
// comb jumps there.
const S_CURVE = 'M80 300 C80 180 160 120 260 120 C300 120 440 140 460 260 C470 320 560 360 620 300';

function CombTrial({ ctx }: { ctx: RenderContext<PathLabState, Config> }) {
  const { scene, selection, pathEdit } = usePathEditTrial(ctx, S_CURVE);
  const { comb, scale, teeth } = ctx.config;

  const chromeVisibility = useMemo(() => ({ 'path-edit.comb': comb ? editingAnchors : never }), [comb]);
  const features = useMemo(() => [
    pickPreset, movePreset, pathsPreset, createCurvatureCombPreset(() => ({ scale, samplesPerSegment: teeth })),
  ] as const, [scale, teeth]);

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

const combInstrument = defineInstrument<PathLabState, Config>({
  name: 'Comb',
  config,
  initialState: () => ({ scene: null }),
  tools: { tools: [{ id: 'select', label: 'Select', icon: icon('editing:select') }] },
  render: (ctx) => <CombTrial ctx={ctx} />,
});

export function CurvatureCombLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Curvature comb" instruments={[combInstrument]} />
    </div>
  );
}
