import { ANCHORS_GROUP, drawPreset } from '@weasel-js/core';
import { addExtremesPreset, anchorSelectionPreset } from '@weasel-js/path-tools';
import {
  type ConfigOf,
  defineInstrument,
  f,
  Lab,
  type RenderContext,
  TrialSceneCanvas,
} from '@weasel-js/labkit';
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import { LastOperationPanel } from '@weasel-js/ui/components/LastOperationPanel';
import { type PathLabState, usePathEditTrial } from './pathEditLabScene';
import { OpeningSteps, PathLabStage } from './pathLab/pathLab';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const config = f.schema({});
type Config = ConfigOf<typeof config>;

/** A blob of three curves, none of whose anchors sits at an extreme. */
const BLOB = 'M 180 240 C 190 170 250 100 320 80 C 460 40 560 220 460 340 C 380 436 160 380 180 240 Z';

// Anchor selection is what seeds the opening selection.
const features = [drawPreset, addExtremesPreset, anchorSelectionPreset] as const;

function AddExtremesTrial({ ctx }: { ctx: RenderContext<PathLabState, Config> }) {
  const { scene, selection, pathEdit } = usePathEditTrial(ctx, BLOB, { fill: '#bfe3c0' });
  return (
    <PathLabStage bar={<><ActionBar group={ANCHORS_GROUP} /><LastOperationPanel /></>}>
      <TrialSceneCanvas
        features={features}
        scene={scene}
        trial={ctx.trial}
        selection={selection}
        pathEdit={pathEdit}
      />
      {/* Anchors 0 and 2: the segment closing the blob is selected. */}
      <OpeningSteps steps={[['selectEveryNthAnchor', { n: 2 }]]} />
    </PathLabStage>
  );
}

const instrument = defineInstrument<PathLabState, Config>({
  name: 'Add extremes',
  config,
  initialState: () => ({ scene: null }),
  tools: { tools: [{ id: 'select', label: 'Select', icon: icon('core:select') }] },
  render: (ctx) => <AddExtremesTrial ctx={ctx} />,
});

export function AddExtremesLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Add extremes" instruments={[instrument]} />
    </div>
  );
}
