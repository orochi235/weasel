import { IDENTITY_POSE_COMPOSITION, createScene, ellipsePath, pathFromD } from '@weasel-js/core';
import { trimPreset, useTrimTool } from '@weasel-js/path-tools';
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

const FEATURES = ['draw', trimPreset] as const;

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

function TrimTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const trim = useTrimTool({ radiusPx: ctx.config.reach });
  const tools = useMemo(() => ({ trim }), [trim]);
  return (
    <TrialSceneCanvas
      features={FEATURES}
      scene={scene}
      trial={ctx.trial}
      tools={tools}
    />
  );
}

const trimInstrument = defineInstrument<State, Config>({
  name: 'Trim segment',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    initial: 'trim',
    tools: [
      { id: 'trim', label: 'Trim segment', icon: icon('core:slice'), shortcut: 'Y' },
      { id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' },
    ],
  },
  render: (ctx) => <TrimTrial ctx={ctx} />,
});

export function TrimLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Trim segment" instruments={[trimInstrument]} defaultInstrument="Trim segment" />
    </div>
  );
}
