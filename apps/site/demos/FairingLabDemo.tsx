import { ANCHORS_GROUP, type ActionTunings, editingAnchors, never, movePreset, pathsPreset, pickPreset } from '@weasel-js/core';
import { createCurvatureCombPreset, fairingPreset } from '@weasel-js/path-tools';
import {
  type ConfigOf,
  defineInstrument,
  f,
  Lab,
  type RenderContext,
  TrialSceneCanvas,
} from '@weasel-js/labkit';
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import { useMemo } from 'react';
import { type PathLabState, usePathEditTrial } from './pathEditLabScene';
import s from './FairingLabDemo.module.css';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const config = f.schema({
  comb: f.boolean(true).label('Show comb'),
  scale: f.number(4000).range(200, 12000).step(100).label('Comb scale'),
});
type Config = ConfigOf<typeof config>;

// A closed blob, smooth at every anchor, with each anchor's two handles of
// different lengths: the comb steps at all four.
const LOPSIDED =
  'M200 100 C260 100 420 110 460 200 C480 245 470 330 380 340 C299 349 160 360 140 260 C125 185 160 100 200 100 Z';

// The command has no key of its own; this canvas gives it one.
const tune: ActionTunings = { fairAnchors: { bindings: [{ kind: 'key', key: 'h' }] } };

function FairingTrial({ ctx }: { ctx: RenderContext<PathLabState, Config> }) {
  const { scene, selection, pathEdit } = usePathEditTrial(ctx, LOPSIDED);
  const { comb, scale } = ctx.config;

  const chromeVisibility = useMemo(() => ({ 'path-edit.comb': comb ? editingAnchors : never }), [comb]);
  const features = useMemo(() => [
    pickPreset, movePreset, pathsPreset, fairingPreset, createCurvatureCombPreset(() => ({ scale })),
  ] as const, [scale]);

  return (
    <div className={s.trial}>
      <div className={s.bar}>
        <ActionBar group={ANCHORS_GROUP} />
      </div>
      <TrialSceneCanvas
        features={features}
        scene={scene}
        trial={ctx.trial}
        selection={selection}
        pathEdit={pathEdit}
        chromeVisibility={chromeVisibility}
        tune={tune}
      />
    </div>
  );
}

const fairingInstrument = defineInstrument<PathLabState, Config>({
  name: 'Fairing',
  config,
  initialState: () => ({ scene: null }),
  tools: { tools: [{ id: 'select', label: 'Select', icon: icon('core:select') }] },
  render: (ctx) => <FairingTrial ctx={ctx} />,
});

export function FairingLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Fairing" instruments={[fairingInstrument]} />
    </div>
  );
}
