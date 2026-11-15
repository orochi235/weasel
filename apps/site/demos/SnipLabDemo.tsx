import { IDENTITY_POSE_COMPOSITION, createScene, ellipsePath, pathFromD, drawPreset } from '@weasel-js/core';
import { snipPreset, useSnipTool } from '@weasel-js/path-tools';
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
import { strokeNode } from './pathEditLabScene';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const FEATURES = [drawPreset, snipPreset] as const;

const config = f.schema({
  reach: f.number(6).range(2, 20).step(1).suffix('px').label('Click reach'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', unknown>;

const createLabScene = () =>
  createScene<unknown, 'default', unknown>({ composition: IDENTITY_POSE_COMPOSITION,
    systemLayers: [{ id: 'default' }],
    initial: [
      strokeNode('left', pathFromD('M200 80 V400'), '#7fb069'),
      strokeNode('right', pathFromD('M320 80 V400'), '#7fb069'),
      strokeNode('top', pathFromD('M80 160 H440'), '#d4a574'),
      strokeNode('bottom', pathFromD('M80 300 H440'), '#d4a574'),
      strokeNode('ring', ellipsePath({ x: 510, y: 150, width: 180, height: 180 }), '#a48bd4', true),
      strokeNode('axis', pathFromD('M480 240 H720'), '#a48bd4'),
    ],
  });

function SnipTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const snip = useSnipTool({ radiusPx: ctx.config.reach });
  const tools = useMemo(() => ({ snip }), [snip]);
  return (
    <TrialSceneCanvas
      features={FEATURES}
      scene={scene}
      trial={ctx.trial}
      tools={tools}
    />
  );
}

const snipInstrument = defineInstrument<State, Config>({
  name: 'Snip',
  config,
  initialState: () => ({ scene: null }),
  tools: {
    initial: 'snip',
    tools: [
      { id: 'snip', label: 'Snip', icon: icon('core:slice') },
      { id: 'select', label: 'Select', icon: icon('core:select') },
    ],
  },
  render: (ctx) => <SnipTrial ctx={ctx} />,
});

export function SnipLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Snip" instruments={[snipInstrument]} />
    </div>
  );
}
