import {
  asNodeId,
  createScene,
  pathEffectNode,
  type ActionTunings,
  type RectPose,
  solid,
  strokeOf,
  useSelection,
} from '@weasel-js/core';
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

const config = f.schema({
  count: f.number(9).range(1, 40).step(1).label('Copies'),
  spacing: f.number(0).range(0, 120).step(5).suffix('px').label('Spacing (0 spreads them end to end)'),
  align: f.enum('start', ['start', 'center', 'end']).label('Spaced run sits at'),
  offset: f.number(0).range(-100, 100).step(5).suffix('px').label('Slide along'),
  orient: f.boolean(true).label('Turn to the path'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

const settingsOf = (c: Config) => ({
  count: c.count, spacing: c.spacing, align: c.align, offset: c.offset, orient: c.orient,
});

const TRACK = asNodeId('track');

function createLabScene() {
  const tile = pathNode('tile', 'M40 40 L76 56 L40 72 L50 56 Z', {
    fill: { paint: solid('#d1495b') },
    stroke: strokeOf('#6b1f2a', 1.5),
  });
  const track = pathNode('track', 'M80 320 C200 180 320 460 440 300 C520 200 600 240 660 320', {
    fill: null,
    stroke: strokeOf('#8a8a8a', 1),
  });
  const copies = { ...pathEffectNode({ kind: 'repeatAlong', ...settingsOf(config.defaults()) }, [tile.id, track.id], 'default'), id: asNodeId('copies') };
  return createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [tile, track, copies],
    coalesceWindowMs: 600,
  });
}

function RepeatTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const selection = useSelection({ initial: [TRACK] });
  const settings = settingsOf(ctx.config);
  const latest = useLatest(settings);
  // A repeat made from the bar or with Mod+Alt+R takes the panel's settings.
  const tune = useMemo<ActionTunings>(() => ({ repeatAlong: { params: () => latest.current } }), [latest]);
  usePathEffectSettings(scene, 'repeatAlong', settings);
  usePathEffectProbe(scene);
  useSeedPathEdit();

  return (
    <PathEffectFrame>
      <TrialSceneCanvas
        features={['draw']}
        defaultTools={['rect', 'pen']}
        scene={scene}
        selection={selection}
        trial={ctx.trial}
        tune={tune}
      />
    </PathEffectFrame>
  );
}

const repeatInstrument = defineInstrument<State, Config>({
  name: 'Repeat along a path',
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
  render: (ctx) => <RepeatTrial ctx={ctx} />,
});

export function RepeatAlongLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Repeat along a path" instruments={[repeatInstrument]} defaultInstrument="Repeat along a path" />
    </div>
  );
}
