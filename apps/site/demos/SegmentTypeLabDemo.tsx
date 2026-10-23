import {
  type ActionTunings,
  asNodeId,
  boundsOfPath,
  createScene,
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
import { segmentTypePreset } from '@weasel-js/path-tools';
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import { useMemo } from 'react';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const config = f.schema({
  shiftC: f.enum<'flip' | 'line' | 'curve'>('flip', [
    { value: 'flip', label: 'Flip' },
    { value: 'line', label: 'Straighten' },
    { value: 'curve', label: 'Curve' },
  ]).toggle().label('Shift+C'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

/** Two straight sides, a curved shoulder, and a straight closing base. */
const TAB = 'M80 240 L80 100 L220 100 C290 100 330 160 330 240 Z';

const createLabScene = () => {
  const path = pathFromD(TAB);
  const { x, y, width, height } = boundsOfPath(path);
  return createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [{
      kind: 'mark', id: asNodeId('tab'), layer: 'default', pose: { x, y, width, height },
      data: { path, fill: { paint: solid('#9cc5e8') }, stroke: { paint: solid('#2d5f8a'), width: 2 } },
    }],
  });
};

const FEATURES = ['pick', 'move', 'paths', segmentTypePreset] as const;

/** Opens in path edit with the top edge's two anchors selected, so Shift+C has a segment to convert. */
const OPENING = { id: 'tab', anchors: [1, 2] };

function SegmentTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const selection = useSelection({ mode: 'multi', scene, initial: [asNodeId('tab')] });
  const { shiftC } = ctx.config;
  const tune = useMemo<ActionTunings>(
    () => ({ convertSegments: { params: shiftC === 'flip' ? {} : { to: shiftC } } }),
    [shiftC],
  );
  return (
    <>
      <TrialSceneCanvas
        features={FEATURES}
        scene={scene}
        selection={selection}
        trial={ctx.trial}
        defaultPathEdit={OPENING}
        tune={tune}
      />
      <FloatingPanel anchor="top-right">
        <ActionBar group="anchors" only={['convertSegments']} />
      </FloatingPanel>
    </>
  );
}

const segmentInstrument = defineInstrument<State, Config>({
  name: 'Segments',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: { tools: [{ id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' }] },
  chrome: [{
    id: 'segment-keys',
    region: 'status',
    item: { text: 'Shift+C converts the selected segments · Shift+double-click a segment flips it' },
  }],
  render: (ctx) => <SegmentTrial ctx={ctx} />,
});

export function SegmentTypeLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Segment type" instruments={[segmentInstrument]} defaultInstrument="Segments" />
    </div>
  );
}
