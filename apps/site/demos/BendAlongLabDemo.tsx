import {
  asNodeId,
  createScene,
  PATH_EFFECT_DERIVATIONS,
  pathEffectNode,
  type ActionTunings,
  type RectPose,
  solid,
  strokeOf,
  useSelection,
  withPathEffectsRegistry,
} from '@weasel-js/core';
import { pathEffectsPreset } from '@weasel-js/path-tools';
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
import { PenIcon, RectIcon, SelectIcon } from '@weasel-js/ui';
import { useLatest } from '@weasel-js/react';
import { useMemo } from 'react';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { PathEffectFrame, pathNode, usePathEffectProbe, usePathEffectSettings, useSeedPathEdit } from './pathEffectLab';

const FEATURES = ['draw', pathEffectsPreset] as const;

const config = f.schema({
  fit: f.enum('stretch', ['stretch', 'natural']).label('Fit'),
  baseline: f.number(0.5).range(0, 1).step(0.05).label('Spine runs through'),
  flip: f.boolean(false).label('Flip across the spine'),
  tolerance: f.number(0.5).range(0.1, 4).step(0.1).suffix('px').label('Refit tolerance'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

const settingsOf = (c: Config) => ({ fit: c.fit, baseline: c.baseline, flip: c.flip, tolerance: c.tolerance });

const SPINE = asNodeId('spine');

function createLabScene() {
  const ribbon = pathNode('ribbon', 'M60 40 L220 40 L250 70 L220 100 L60 100 L90 70 Z', {
    fill: { paint: solid('#7fb069') },
    stroke: strokeOf('#3d5a2a', 2),
  });
  const spine = pathNode('spine', 'M80 300 C180 160 300 420 420 260 C500 160 580 200 640 280', {
    fill: null,
    stroke: strokeOf('#8a8a8a', 1),
  });
  const bent = { ...pathEffectNode({ kind: 'bendAlong', ...settingsOf(config.defaults()) }, [ribbon.id, spine.id], 'default', PATH_EFFECT_DERIVATIONS), id: asNodeId('bent') };
  return createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    registry: withPathEffectsRegistry(),
    initial: [ribbon, spine, bent],
    coalesceWindowMs: 600,
  });
}

function BendTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const selection = useSelection({ initial: [SPINE] });
  const settings = settingsOf(ctx.config);
  const latest = useLatest(settings);
  // A bend made from the bar or with Alt+Shift+W takes the panel's settings.
  const tune = useMemo<ActionTunings>(() => ({ bendAlong: { params: () => latest.current } }), [latest]);
  usePathEffectSettings(scene, 'bendAlong', settings);
  usePathEffectProbe(scene);
  useSeedPathEdit();

  return (
    <PathEffectFrame>
      <TrialSceneCanvas
        features={FEATURES}
        defaultTools={['rect', 'pen']}
        scene={scene}
        selection={selection}
        trial={ctx.trial}
        tune={tune}
      />
    </PathEffectFrame>
  );
}

const bendInstrument = defineInstrument<State, Config>({
  name: 'Bend along a path',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: SelectIcon, shortcut: 'V' },
      { id: 'rect', label: 'Rectangle', icon: RectIcon, shortcut: 'R' },
      { id: 'pen', label: 'Pen', icon: PenIcon, shortcut: 'P' },
    ],
  },
  render: (ctx) => <BendTrial ctx={ctx} />,
});

export function BendAlongLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Bend along a path" instruments={[bendInstrument]} defaultInstrument="Bend along a path" />
    </div>
  );
}
