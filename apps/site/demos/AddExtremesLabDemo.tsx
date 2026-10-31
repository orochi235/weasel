import { type RectPose } from '@weasel-js/core';
import { addExtremesPreset, anchorSelectionPreset } from '@weasel-js/path-tools';
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
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import { LastOperationPanel } from '@weasel-js/ui/components/LastOperationPanel';
import { createPathLabScene, useSeededPathEdit } from './pathEditLabSeed';
import { OpeningSteps, PathLabStage } from './pathLab/pathLab';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const config = f.schema({});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

/** A blob of three curves, none of whose anchors sits at an extreme. */
const BLOB = 'M 180 240 C 190 170 250 100 320 80 C 460 40 560 220 460 340 C 380 436 160 380 180 240 Z';

const createLabScene = () => createPathLabScene(BLOB, '#bfe3c0');
// Anchor selection is what seeds the opening selection.
const features = ['draw', addExtremesPreset, anchorSelectionPreset] as const;

function AddExtremesTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const { selection, pathEdit, redrawOn } = useSeededPathEdit();
  return (
    <PathLabStage bar={<><ActionBar group="anchors" /><LastOperationPanel /></>}>
      <TrialSceneCanvas
        features={features}
        scene={scene}
        trial={ctx.trial}
        selection={selection}
        pathEdit={pathEdit}
        redrawOn={redrawOn}
      />
      {/* Anchors 0 and 2: the segment closing the blob is selected. */}
      <OpeningSteps steps={[['selectEveryNthAnchor', { n: 2 }]]} />
    </PathLabStage>
  );
}

const instrument = defineInstrument<State, Config>({
  name: 'Add extremes',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: { tools: [{ id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' }] },
  render: (ctx) => <AddExtremesTrial ctx={ctx} />,
});

export function AddExtremesLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Add extremes" instruments={[instrument]} defaultInstrument="Add extremes" />
    </div>
  );
}
