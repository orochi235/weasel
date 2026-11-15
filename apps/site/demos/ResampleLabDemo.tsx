import { useActionsRegistry, drawPreset } from '@weasel-js/core';
import { resamplePreset } from '@weasel-js/path-tools';
import {
  type ConfigOf,
  defineInstrument,
  f,
  Lab,
  type RenderContext,
  TrialSceneCanvas,
} from '@weasel-js/labkit';
import { Button } from '@weasel-js/ui/components/Button';
import { LastOperationPanel } from '@weasel-js/ui/components/LastOperationPanel';
import { type PathLabState, usePathEditTrial } from './pathEditLabScene';
import { PathLabStage } from './pathLab/pathLab';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

// Resample's params are in the last-operation panel, once it has run.
const config = f.schema({});
type Config = ConfigOf<typeof config>;

/** An open wave with anchors bunched unevenly along it, cornered twice in the middle. */
const WAVE = 'M 80 300 C 120 120 160 120 200 220 C 220 270 300 300 320 180 L 380 120 '
  + 'C 420 60 470 80 520 180 C 540 220 600 260 660 200';

const features = [drawPreset, resamplePreset] as const;

function ResampleTrial({ ctx }: { ctx: RenderContext<PathLabState, Config> }) {
  const { scene, selection, pathEdit } = usePathEditTrial(ctx, WAVE);
  const actions = useActionsRegistry();
  const bar = (
    <>
      <Button stance="confirm" size="sm" onClick={() => actions?.trigger('resamplePath')}>Resample</Button>
      <LastOperationPanel />
    </>
  );
  return (
    <PathLabStage bar={bar}>
      <TrialSceneCanvas
        features={features}
        scene={scene}
        trial={ctx.trial}
        selection={selection}
        pathEdit={pathEdit}
      />
    </PathLabStage>
  );
}

const instrument = defineInstrument<PathLabState, Config>({
  name: 'Resample',
  config,
  initialState: () => ({ scene: null }),
  tools: { tools: [{ id: 'select', label: 'Select', icon: icon('core:select') }] },
  render: (ctx) => <ResampleTrial ctx={ctx} />,
});

export function ResampleLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Resample a path" instruments={[instrument]} />
    </div>
  );
}
