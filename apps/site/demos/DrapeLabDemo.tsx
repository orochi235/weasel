import { useLatest } from '@weasel-js/core';
import { type ConfigOf, defineInstrument, f, Lab, type RenderContext, TrialSceneCanvas } from '@weasel-js/labkit';
import { createDrapePreset } from '@weasel-js/path-tools';
import { useMemo } from 'react';
import { icon } from '../icons.gen';
import { type PathLabState, usePathEditTrial } from './pathEditLabScene';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';

const config = f.schema({
  drape: f.boolean(true).label('Drape'),
  radius: f.number(160).range(10, 600).step(5).suffix('px').label('Radius'),
  falloff: f.enum('smooth', ['smooth', 'linear', 'sharp']).label('Falloff'),
});
type Config = ConfigOf<typeof config>;

/** A wave of nine smooth anchors, 60 apart. */
const WAVE = (() => {
  const pts = Array.from({ length: 9 }, (_, i) => ({ x: 60 + 60 * i, y: i % 2 ? 260 : 160 }));
  return pts.reduce(
    (d, p, i) => (i === 0 ? `M${p.x} ${p.y}` : `${d} C${pts[i - 1]!.x + 25} ${pts[i - 1]!.y} ${p.x - 25} ${p.y} ${p.x} ${p.y}`),
    '',
  );
})();

function DrapeTrial({ ctx }: { ctx: RenderContext<PathLabState, Config> }) {
  const { scene, selection, pathEdit } = usePathEditTrial(ctx, WAVE, '#3478f6');
  const live = useLatest(ctx);
  const features = useMemo(() => ['pick', 'move', 'paths', createDrapePreset(() => {
    const { drape, radius, falloff } = live.current.config;
    return drape
      ? { radiusPx: radius, falloff, onRadius: (px: number) => live.current.setConfig('radius', Math.round(px)) }
      : null;
  })] as const, [live]);

  return (
    <TrialSceneCanvas
      features={features}
      scene={scene}
      selection={selection}
      pathEdit={pathEdit}
      trial={ctx.trial}
    />
  );
}

const drapeInstrument = defineInstrument<PathLabState, Config>({
  name: 'Drape',
  config,
  initialState: () => ({ scene: null }),
  tools: { tools: [{ id: 'select', label: 'Select', icon: icon('core:select') }] },
  render: (ctx) => <DrapeTrial ctx={ctx} />,
});

export function DrapeLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Drape" instruments={[drapeInstrument]} />
    </div>
  );
}
