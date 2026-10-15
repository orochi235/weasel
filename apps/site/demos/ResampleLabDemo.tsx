import { pathFromD, type RectPose, useOngoingAction } from '@weasel-js/core';
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
import { Button, SelectIcon } from '@weasel-js/ui';
import { useEffect, useMemo, useState } from 'react';
import { OpenInPathEdit, PathLabStage, pathLabScene, pathNode } from './pathLab/pathLab';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';

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

const createLabScene = () => pathLabScene([pathNode('wave', pathFromD(WAVE), null)]);

function ResampleTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const resample = useOngoingAction('resamplePath');
  const { by, count, spacing, keepCorners, tolerance } = ctx.config;
  const params = useMemo(
    () => ({ count, spacing: by === 'spacing' ? spacing : 0, keepCorners, tolerance }),
    [by, count, spacing, keepCorners, tolerance],
  );
  // A tool switch ends an open preview, and the canvas takes up its first
  // tool after mounting, so the preview opens once it has one. From then on
  // every change of the panel previews, and Apply keeps what is shown.
  const [hasTool, setHasTool] = useState(false);
  useEffect(() => { if (hasTool) resample.input(params); }, [resample, params, hasTool]);
  const bar = (
    <>
      <Button variant="primary" size="sm" onClick={() => resample.commit()}>Apply</Button>
      <Button variant="secondary" size="sm" onClick={() => resample.cancel()}>Cancel</Button>
    </>
  );
  return (
    <PathLabStage bar={bar}>
      <TrialSceneCanvas
        features={['draw']}
        scene={scene}
        trial={ctx.trial}
        onToolsCreated={(tools) => { if (tools.active !== null) setHasTool(true); }}
      />
      <OpenInPathEdit />
    </PathLabStage>
  );
}

const instrument = defineInstrument<State, Config>({
  name: 'Resample',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: { tools: [{ id: 'select', label: 'Select', icon: SelectIcon, shortcut: 'V' }] },
  render: (ctx) => <ResampleTrial ctx={ctx} />,
});

export function ResampleLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Resample a path" instruments={[instrument]} defaultInstrument="Resample" />
    </div>
  );
}
