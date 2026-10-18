import { asNodeId, createScene, type RectPose, solid, useSelection } from '@weasel-js/core';
import { usePuppetTool, warpPreset, withPathWarp } from '@weasel-js/path-tools';
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
import { useCallback, useMemo, useState } from 'react';
import { createMeshLayers, type MeshShow } from './puppetSolverLab/meshLayer';
import type { Stage } from './puppetSolverLab/meshModel';
import { createReadout, SolverPanel } from './puppetSolverLab/SolverPanel';
import { PRESETS, type PresetId } from './puppetSolverLab/presets';
import { STEP_ONE_SHOWN } from './puppetSolverLab/solverStages';
import s from './puppetSolverLab/PuppetSolverLab.module.css';
import { pathLeaf } from './warpLab';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const FEATURES = ['draw', warpPreset] as const;

const config = f.schema({
  preset: f.enum<PresetId>('disc', (Object.keys(PRESETS) as PresetId[]).map((value) => ({ value, label: PRESETS[value].label })))
    .radio().label('Pins'),
  stage: f.enum<Stage>('step2', [
    { value: 'step1', label: 'Step 1' },
    { value: 'step2', label: 'Step 2' },
  ]).radio().label('Solver step').showIf(() => STEP_ONE_SHOWN)
    .describe('Step 1 lets each triangle scale and turn to fit the pins. Step 2 fits an unscaled copy of each to that and averages the copies.'),
  mesh: f.enum<MeshShow>('area', [
    { value: 'area', label: 'Area' },
    { value: 'wire', label: 'Wire' },
    { value: 'off', label: 'Off' },
  ]).radio().label('Mesh').describe('Area colors each triangle by its area now over its area at rest; Wire leaves only the turned-over ones filled.'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

export const SHAPE_ID = 'shape';
const SELECTED = [asNodeId(SHAPE_ID)];

/** The preset's shape holding its pins, already dragged, so the lab opens on the warp. */
export function createLabScene(preset: PresetId) {
  const { shape, pins } = PRESETS[preset];
  const bare = pathLeaf(SHAPE_ID, shape, '#ffffff1f', { stroke: { paint: solid('#14141a'), width: 2 } });
  const pinned = withPathWarp(bare, { kind: 'puppet', pins });
  return createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [{ ...bare, ...(pinned as { pose: RectPose; data: unknown }) }],
  });
}

function SolverTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const { preset, stage, mesh } = ctx.config;
  const create = useCallback(() => createLabScene(preset), [preset]);
  const scene = useTrialScene(ctx, create);
  const selection = useSelection({ mode: 'multi', initial: SELECTED });
  const puppet = usePuppetTool();
  const [readout] = useState(createReadout);
  const layers = useMemo(() => {
    const built = createMeshLayers({ scene: scene as never, nodeId: SHAPE_ID, display: () => ({ stage, show: mesh }), onModel: readout.set });
    return { mesh: { layer: built.mesh, before: 'scene' }, backward: { layer: built.backward, after: 'scene' } };
  }, [scene, stage, mesh, readout]);
  return (
    <div className={s.trial}>
      <TrialSceneCanvas
        features={FEATURES}
        scene={scene}
        selection={selection}
        trial={ctx.trial}
        tools={{ puppet }}
        layers={layers}
      />
      <SolverPanel readout={readout} caption={PRESETS[preset].caption} />
    </div>
  );
}

const solverInstrument = defineInstrument<State, Config>({
  name: 'Puppet solver',
  config,
  initialState: () => ({ scene: null }),
  // A new pin set opens on its own shape: the scene goes back to `create`'s.
  onConfigChange: (next, prev, state) => (next.preset === prev.preset ? state : { scene: null }),
  undo: {},
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' },
      { id: 'puppet', label: 'Puppet Warp', icon: icon('ui:pin'), shortcut: 'B' },
    ],
    initial: 'puppet',
  },
  // Keyed, so a trial still on the scene `create` built (state `null`) builds the new preset's.
  render: (ctx) => <SolverTrial key={ctx.config.preset} ctx={ctx} />,
});

export function PuppetSolverLabDemo() {
  return (
    <div className={s.frame}>
      <Lab title="Inside the puppet solver" instruments={[solverInstrument]} defaultInstrument="Puppet solver" />
    </div>
  );
}
