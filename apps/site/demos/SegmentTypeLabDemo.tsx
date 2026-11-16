import { ANCHORS_GROUP, type ActionTunings, asNodeId, createScene, type RectPose, solid, useSelection, pathNode } from '@weasel-js/core';
import { pathsPreset } from '@weasel-js/path-tools';
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
import { FloatingPanel } from '@weasel-js/ui/components/FloatingPanel';
import { segmentTypePreset } from '@weasel-js/path-tools';
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import { useMemo } from 'react';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';
import { movePreset, pickPreset } from '@weasel-js/editing';

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

const createLabScene = () => createScene<unknown, 'default', RectPose>({
  systemLayers: [{ id: 'default' }],
  initial: [pathNode('tab', TAB, { fill: { paint: solid('#9cc5e8') }, stroke: { paint: solid('#2d5f8a'), width: 2 } })],
});

const FEATURES = [pickPreset, movePreset, pathsPreset, segmentTypePreset] as const;

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
        <ActionBar group={ANCHORS_GROUP} only={['convertSegments']} />
      </FloatingPanel>
    </>
  );
}

const segmentInstrument = defineInstrument<State, Config>({
  name: 'Segments',
  config,
  initialState: () => ({ scene: null }),
  tools: { tools: [{ id: 'select', label: 'Select', icon: icon('core:select') }] },
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
      <Lab title="Segment type" instruments={[segmentInstrument]} />
    </div>
  );
}
