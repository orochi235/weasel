import { useLatest } from '@weasel-js/core';
import { type ConfigOf, defineInstrument, f, Lab, type RenderContext, TrialSceneCanvas } from '@weasel-js/labkit';
import { createSoftSelectionPreset } from '@weasel-js/path-tools';
import { SelectIcon } from '@weasel-js/ui';
import { useMemo } from 'react';
import { type PathLabState, usePathEditTrial } from './pathEditLabScene';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';

const config = f.schema({
  soft: f.boolean(true).label('Soft selection'),
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

function SoftSelectionTrial({ ctx }: { ctx: RenderContext<PathLabState, Config> }) {
  const { scene, selection, pathEdit } = usePathEditTrial(ctx, WAVE, '#3478f6');
  const live = useLatest(ctx);
  const features = useMemo(() => ['pick', 'move', 'paths', createSoftSelectionPreset(() => {
    const { soft, radius, falloff } = live.current.config;
    return soft
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

const softInstrument = defineInstrument<PathLabState, Config>({
  name: 'Soft selection',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: { tools: [{ id: 'select', label: 'Select', icon: SelectIcon, shortcut: 'V' }] },
  render: (ctx) => <SoftSelectionTrial ctx={ctx} />,
});

export function SoftSelectionLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Soft selection" instruments={[softInstrument]} defaultInstrument="Soft selection" />
    </div>
  );
}
