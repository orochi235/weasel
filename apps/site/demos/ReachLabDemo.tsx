import { IDENTITY_POSE_COMPOSITION, type ActionTunings, createScene, ellipsePath, pathFromD } from '@weasel-js/core';
import { reachPreset, useReachTool, pathsPreset } from '@weasel-js/path-tools';
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
import { drawPreset } from '@weasel-js/editing';

const FEATURES = [drawPreset, pathsPreset, reachPreset] as const;

const config = f.schema({
  reach: f.number(6).range(2, 20).step(1).suffix('px').label('Click reach'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', unknown>;

const createLabScene = () =>
  createScene<unknown, 'default', unknown>({ composition: IDENTITY_POSE_COMPOSITION,
    systemLayers: [{ id: 'default' }],
    initial: [
      strokeNode('wall', pathFromD('M520 60 V440'), { color: '#7fb069' }),
      strokeNode('ring', ellipsePath({ x: 600, y: 180, width: 140, height: 140 }), { color: '#a48bd4', fill: '#a48bd433' }),
      strokeNode('short', pathFromD('M120 120 H220'), { color: '#d4a574' }),
      strokeNode('slant', pathFromD('M140 200 L260 230'), { color: '#d4a574' }),
      strokeNode('hook', pathFromD('M100 380 C120 320 180 300 240 300'), { color: '#d4a574' }),
    ],
  });

const TUNE: ActionTunings = { reachToMeet: { bindings: [{ kind: 'key', key: 'e' }] } };

function ReachTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const reach = useReachTool({ radiusPx: ctx.config.reach });
  const tools = useMemo(() => ({ reach }), [reach]);
  return (
    <TrialSceneCanvas
      features={FEATURES}
      scene={scene}
      trial={ctx.trial}
      tools={tools}
      tune={TUNE}
    />
  );
}

const reachInstrument = defineInstrument<State, Config>({
  name: 'Reach',
  config,
  initialState: () => ({ scene: null }),
  tools: {
    initial: 'reach',
    tools: [
      { id: 'reach', label: 'Reach', icon: icon('ui:arrowRight') },
      { id: 'select', label: 'Select (then E extends the selection)', icon: icon('editing:select') },
    ],
  },
  render: (ctx) => <ReachTrial ctx={ctx} />,
});

export function ReachLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Reach" instruments={[reachInstrument]} />
    </div>
  );
}
