import { useLatest } from '@weasel-js/core';
import { type ConfigOf, defineInstrument, f, Lab, type RenderContext, TrialSceneCanvas } from '@weasel-js/labkit';
import { createHandleSnapPreset } from '@weasel-js/path-tools';
import { useMemo } from 'react';
import { icon } from '../icons.gen';
import { BLOB, type PathLabState, usePathEditTrial } from './pathEditLabScene';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';

const config = f.schema({
  snap: f.boolean(true).label('Snap handle angle'),
  step: f.enum('45', ['15', '30', '45', '90']).label('Step (degrees)'),
  tolerance: f.number(6).range(1, 20).step(1).suffix('°').label('Snap within'),
  opposite: f.boolean(true).label('Snap to opposite handle'),
});
type Config = ConfigOf<typeof config>;

function HandleSnapTrial({ ctx }: { ctx: RenderContext<PathLabState, Config> }) {
  const { scene, selection, pathEdit } = usePathEditTrial(ctx, BLOB, '#d4a574');
  const live = useLatest(ctx.config);
  const features = useMemo(() => ['pick', 'move', 'paths', createHandleSnapPreset(() => {
    const { snap, step, tolerance, opposite } = live.current;
    return snap ? { stepDeg: Number(step), reachDeg: tolerance, opposite } : null;
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

const snapInstrument = defineInstrument<PathLabState, Config>({
  name: 'Handle snapping',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: { tools: [{ id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' }] },
  render: (ctx) => <HandleSnapTrial ctx={ctx} />,
});

export function HandleSnapLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Handle snapping" instruments={[snapInstrument]} defaultInstrument="Handle snapping" />
    </div>
  );
}
