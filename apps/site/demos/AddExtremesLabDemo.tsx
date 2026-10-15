import { type ActionTunings, pathFromD, type RectPose } from '@weasel-js/core';
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
import { ActionBar, SelectIcon } from '@weasel-js/ui';
import { useMemo } from 'react';
import { OpenInPathEdit, PathLabStage, pathLabScene, pathNode } from './pathLab/pathLab';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';

const config = f.schema({
  scope: f.enum('selection', ['selection', 'path']).label('Enter adds to'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

/** A blob of three curves, none of whose anchors sits at an extreme. */
const BLOB = 'M 180 240 C 190 170 250 100 320 80 C 460 40 560 220 460 340 C 380 436 160 380 180 240 Z';

const createLabScene = () => pathLabScene([pathNode('blob', pathFromD(BLOB), '#bfe3c0')]);

function AddExtremesTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const { scope } = ctx.config;
  const tune = useMemo<ActionTunings>(
    () => ({ addExtremeAnchors: { params: { scope }, bindings: [{ kind: 'key', key: 'Enter' }] } }),
    [scope],
  );
  return (
    <PathLabStage bar={<ActionBar group="anchors" />}>
      <TrialSceneCanvas features={['draw']} scene={scene} trial={ctx.trial} tune={tune} />
      {/* Anchors 0 and 2: the segment closing the blob is selected. */}
      <OpenInPathEdit then={[['selectEveryNthAnchor', { n: 2 }]]} />
    </PathLabStage>
  );
}

const instrument = defineInstrument<State, Config>({
  name: 'Add extremes',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: { tools: [{ id: 'select', label: 'Select', icon: SelectIcon, shortcut: 'V' }] },
  render: (ctx) => <AddExtremesTrial ctx={ctx} />,
});

export function AddExtremesLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Add extremes" instruments={[instrument]} defaultInstrument="Add extremes" />
    </div>
  );
}
