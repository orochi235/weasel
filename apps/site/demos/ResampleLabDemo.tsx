import { type RectPose, useActionsRegistry } from '@weasel-js/core';
import { resamplePreset } from '@weasel-js/path-tools';
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
import { Button } from '@weasel-js/ui/components/Button';
import { LastOperationPanel } from '@weasel-js/ui/components/LastOperationPanel';
import { createPathLabScene, useSeededPathEdit } from './pathEditLabSeed';
import { PathLabStage } from './pathLab/pathLab';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

// Resample's params are in the last-operation panel, once it has run.
const config = f.schema({});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

/** An open wave with anchors bunched unevenly along it, cornered twice in the middle. */
const WAVE = 'M 80 300 C 120 120 160 120 200 220 C 220 270 300 300 320 180 L 380 120 '
  + 'C 420 60 470 80 520 180 C 540 220 600 260 660 200';

const createLabScene = () => createPathLabScene(WAVE);
const features = ['draw', resamplePreset] as const;

function ResampleTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const { selection, pathEdit, redrawOn } = useSeededPathEdit();
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
        redrawOn={redrawOn}
      />
    </PathLabStage>
  );
}

const instrument = defineInstrument<State, Config>({
  name: 'Resample',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: { tools: [{ id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' }] },
  render: (ctx) => <ResampleTrial ctx={ctx} />,
});

export function ResampleLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Resample a path" instruments={[instrument]} defaultInstrument="Resample" />
    </div>
  );
}
