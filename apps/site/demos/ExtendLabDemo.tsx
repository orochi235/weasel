import { type ActionTunings, createScene, ellipsePath, pathFromD, useExtendTool } from '@weasel-js/core';
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
import { ArrowRightIcon, SelectIcon } from '@weasel-js/ui';
import { useMemo } from 'react';
import { strokeNode } from './pathEditLabScene';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';

const config = f.schema({
  reach: f.number(6).range(2, 20).step(1).suffix('px').label('Click reach'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', unknown>;

const createLabScene = () =>
  createScene<unknown, 'default', unknown>({
    systemLayers: [{ id: 'default' }],
    initial: [
      strokeNode('wall', pathFromD('M520 60 V440'), '#7fb069'),
      strokeNode('ring', ellipsePath({ x: 600, y: 180, width: 140, height: 140 }), '#a48bd4', true),
      strokeNode('short', pathFromD('M120 120 H220'), '#d4a574'),
      strokeNode('slant', pathFromD('M140 200 L260 230'), '#d4a574'),
      strokeNode('hook', pathFromD('M100 380 C120 320 180 300 240 300'), '#d4a574'),
    ],
  });

const TUNE: ActionTunings = { extendToMeet: { bindings: [{ kind: 'key', key: 'e' }] } };

function ExtendTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const extend = useExtendTool({ radiusPx: ctx.config.reach });
  const tools = useMemo(() => ({ extend }), [extend]);
  return (
    <TrialSceneCanvas
      features={['draw']}
      scene={scene}
      trial={ctx.trial}
      tools={tools}
      tune={TUNE}
    />
  );
}

const extendInstrument = defineInstrument<State, Config>({
  name: 'Extend to next path',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    initial: 'extend',
    tools: [
      { id: 'extend', label: 'Extend to next path', icon: ArrowRightIcon, shortcut: 'U' },
      { id: 'select', label: 'Select (then E extends the selection)', icon: SelectIcon, shortcut: 'V' },
    ],
  },
  render: (ctx) => <ExtendTrial ctx={ctx} />,
});

export function ExtendLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Extend to next path" instruments={[extendInstrument]} defaultInstrument="Extend to next path" />
    </div>
  );
}
