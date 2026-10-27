import { asNodeId, createScene, PathBuilder, type RectPose, useSelection } from '@weasel-js/core';
import { usePuppetTool, warpPreset, withPathWarp } from '@weasel-js/path-tools';
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
import { expandWarpCommand, pathLeaf, useWarpLabActions } from './warpLab';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const FEATURES = ['draw', warpPreset] as const;

const config = f.schema({
  tolerance: f.number(0.5).range(0.05, 5).step(0.05).suffix('px').label('Refit tolerance'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

/** A long bar with a head at one end, so a bend reads along its length. */
function eel() {
  return new PathBuilder()
    .moveTo(80, 170).lineTo(420, 170).curveTo(470, 150, 520, 170, 520, 195)
    .curveTo(520, 220, 470, 240, 420, 220).lineTo(80, 220).close()
    .build();
}

/** Three pins along the eel, none moved yet: the lab opens ready to drag. */
const PINS = [{ x: 110, y: 195 }, { x: 290, y: 195 }, { x: 480, y: 195 }].map((p) => ({ from: p, to: p }));

const createLabScene = () => {
  const bare = pathLeaf('eel', eel(), '#7fb069');
  const pinned = withPathWarp(bare, { kind: 'puppet', pins: PINS });
  return createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [{ ...bare, ...(pinned as { pose: RectPose; data: unknown }) }],
  });
};

const SELECTED = [asNodeId('eel')];

function PuppetTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const selection = useSelection({ mode: 'multi', initial: SELECTED });
  const { tolerance } = ctx.config;
  const settings = useMemo(() => ({ tolerance }), [tolerance]);
  useWarpLabActions(ctx.trial.id, 'puppet', settings);
  const puppet = usePuppetTool(settings);
  return (
    <TrialSceneCanvas
      features={FEATURES}
      scene={scene}
      selection={selection}
      trial={ctx.trial}
      tools={{ puppet }}
    />
  );
}

const puppetInstrument = defineInstrument<State, Config>({
  name: 'Puppet Warp',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' },
      { id: 'puppet', label: 'Puppet Warp', icon: icon('path-tools:puppetWarp'), shortcut: 'B' },
    ],
    initial: 'puppet',
  },
  chrome: [expandWarpCommand],
  render: (ctx) => <PuppetTrial ctx={ctx} />,
});

export function PuppetLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Puppet warp" instruments={[puppetInstrument]} defaultInstrument="Puppet Warp" />
    </div>
  );
}
