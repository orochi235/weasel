import {
  always,
  asNodeId,
  boundsOfPath,
  createScene,
  never,
  pathFromD,
  type RectPose,
  solid,
  useSelection,
} from '@weasel-js/core';
import {
  type ConfigOf,
  defineInstrument,
  f,
  FloatingPanel,
  Lab,
  type RenderContext,
  type SceneTrialState,
  TrialSceneCanvas,
  useTrialScene,
} from '@weasel-js/labkit';
import { PATH_DIRECTION_CHROME_ID, pathStructurePreset } from '@weasel-js/path-tools';
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import { useMemo } from 'react';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const config = f.schema({
  arrows: f.boolean(true).label('Direction arrows'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

/** A closed shape whose five anchors each carry a color, so turning its start or its
 *  direction shows the colors staying on their anchors. */
const RING = 'M200 60 C240 60 273 84 286 122 C298 160 285 199 253 223 C221 246 179 246 147 223 C115 199 102 160 114 122 C127 84 160 60 200 60 Z';
/** One color per anchor, as `countPathAnchors` counts them: the closing curve's end, back on
 *  the start, takes the start's color again. */
const RING_COLORS = [
  1.0, 0.35, 0.35, 1,
  1.0, 0.8, 0.3, 1,
  0.4, 0.85, 0.45, 1,
  0.35, 0.6, 1.0, 1,
  0.75, 0.45, 1.0, 1,
  1.0, 0.35, 0.35, 1,
];
const WAVE = 'M360 220 C390 140 420 140 450 200 C470 240 500 240 520 180';

function pathNode(id: string, d: string, data: object) {
  const path = pathFromD(d);
  const { x, y, width, height } = boundsOfPath(path);
  return { kind: 'leaf' as const, id: asNodeId(id), layer: 'default' as const, pose: { x, y, width, height }, data: { path, ...data } };
}

const createLabScene = () =>
  createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      pathNode('ring', RING, { fill: { paint: solid('#ffffff') }, vertexColors: RING_COLORS }),
      pathNode('wave', WAVE, { fill: null, stroke: { paint: solid('#3a3a3a'), width: 3 } }),
    ],
  });

const FEATURES = ['pick', 'move', 'paths', pathStructurePreset] as const;

/** Opens on the ring in path edit with its third anchor selected, ready for Make start point. */
const OPENING = { id: 'ring', anchors: [2] };

function DirectionTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const selection = useSelection({ mode: 'multi', scene, initial: [asNodeId('ring')] });
  const { arrows } = ctx.config;
  const chromeVisibility = useMemo(() => ({ [PATH_DIRECTION_CHROME_ID]: arrows ? always : never }), [arrows]);
  return (
    <>
      <TrialSceneCanvas
        features={FEATURES}
        scene={scene}
        selection={selection}
        trial={ctx.trial}
        defaultPathEdit={OPENING}
        chromeVisibility={chromeVisibility}
      />
      <FloatingPanel anchor="top-right">
        <ActionBar group="anchors" only={['setPathStart']} />
        <ActionBar group="path" only={['reversePath']} />
      </FloatingPanel>
    </>
  );
}

const directionInstrument = defineInstrument<State, Config>({
  name: 'Direction',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: { tools: [{ id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' }] },
  render: (ctx) => <DirectionTrial ctx={ctx} />,
});

export function PathDirectionLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Path start and direction" instruments={[directionInstrument]} defaultInstrument="Direction" />
    </div>
  );
}
