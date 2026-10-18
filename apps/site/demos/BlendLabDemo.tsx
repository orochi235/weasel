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
import { useLatest } from '@weasel-js/react';
import { useMemo } from 'react';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { PathEffectFrame, pathNode, usePathEffectProbe, usePathEffectSettings } from './pathEffectLab';
import { icon } from '../icons.gen';

const FEATURES = ['draw', pathEffectsPreset] as const;

const config = f.schema({
  spaceBy: f.enum('count', ['count', 'distance']).label('Space steps by'),
  steps: f.number(5).range(0, 24).step(1).label('Steps'),
  distance: f.number(40).range(4, 200).step(1).label('Distance'),
  autoAlign: f.boolean(true).label('Match start points'),
  startOffset: f.number(0).range(-8, 8).step(1).label('Start offset'),
  direction: f.enum('auto', ['auto', 'forward', 'backward']).label('Second shape runs'),
  rotate: f.boolean(true).label('Turn between rotations'),
  orient: f.boolean(false).label('Turn to spine'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

/** The control panel as `blend` and `editPathEffect` params. */
const settingsOf = (c: Config) => ({
  spaceBy: c.spaceBy,
  steps: c.steps,
  distance: c.distance,
  autoAlign: c.autoAlign,
  startOffset: c.startOffset,
  reverse: c.direction === 'auto' ? ('auto' as const) : c.direction === 'backward',
  rotate: c.rotate,
  orient: c.orient,
});

const BLEND = asNodeId('blend');

function createLabScene() {
  const from = pathNode('from', 'M120 90 L138 136 L188 140 L150 172 L162 222 L120 194 L78 222 L90 172 L52 140 L102 136 Z', {
    fill: { paint: solid('#e4572e') },
    stroke: strokeOf('#7a2412', 2),
  });
  const to = pathNode('to', 'M440 110 L540 110 L540 250 L440 250 Z', {
    fill: { paint: solid('#2e86ab') },
    stroke: strokeOf('#123f52', 6),
  }, Math.PI / 4);
  const { spaceBy, steps, distance, autoAlign, startOffset, rotate, orient } = config.defaults();
  const blend = {
    ...pathEffectNode({ kind: 'blend', spaceBy, steps, distance, autoAlign, startOffset, rotate, orient }, [from.id, to.id], 'default', PATH_EFFECT_DERIVATIONS),
    id: BLEND,
  };
  return createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    registry: withPathEffectsRegistry(),
    initial: [from, blend, to],
    coalesceWindowMs: 600,
  });
}

function BlendTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const selection = useSelection({ initial: [BLEND] });
  const settings = settingsOf(ctx.config);
  const latest = useLatest(settings);
  // A blend made from the bar or with Alt+Shift+B takes the panel's settings.
  const tune = useMemo<ActionTunings>(() => ({ blend: { params: () => latest.current } }), [latest]);
  usePathEffectSettings(scene, 'blend', settings);
  usePathEffectProbe(scene);

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

const blendInstrument = defineInstrument<State, Config>({
  name: 'Blend',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' },
      { id: 'rect', label: 'Rectangle', icon: icon('core:rect'), shortcut: 'R' },
      { id: 'pen', label: 'Pen', icon: icon('core:pen'), shortcut: 'P' },
    ],
  },
  render: (ctx) => <BlendTrial ctx={ctx} />,
});

export function BlendLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Blend" instruments={[blendInstrument]} defaultInstrument="Blend" />
    </div>
  );
}
