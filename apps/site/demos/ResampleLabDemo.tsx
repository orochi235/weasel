import { type RectPose, useOngoingAction } from '@weasel-js/core';
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
import { useEffect, useMemo } from 'react';
import { createPathLabScene, useSeededPathEdit } from './pathEditLabSeed';
import { PathLabStage } from './pathLab/pathLab';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const config = f.schema({
  by: f.enum('count', ['count', 'spacing']).label('Resample by'),
  count: f.number(12).range(3, 48).step(1).label('Anchors').showIf((c) => c.by === 'count'),
  spacing: f.number(40).range(5, 160).step(5).suffix('px').label('Spacing').showIf((c) => c.by === 'spacing'),
  keepCorners: f.boolean(true).label('Keep corners'),
  tolerance: f.number(0.5).range(0.05, 5).step(0.05).suffix('px').label('Tolerance'),
});
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
  const resample = useOngoingAction('resamplePath');
  const { by, count, spacing, keepCorners, tolerance } = ctx.config;
  const params = useMemo(
    () => ({ count, spacing: by === 'spacing' ? spacing : 0, keepCorners, tolerance }),
    [by, count, spacing, keepCorners, tolerance],
  );
  useEffect(() => { resample.input(params); }, [resample, params]);
  const bar = (
    <>
      <Button stance="confirm" size="sm" onClick={() => resample.commit()}>Apply</Button>
      <Button size="sm" onClick={() => resample.cancel()}>Cancel</Button>
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
