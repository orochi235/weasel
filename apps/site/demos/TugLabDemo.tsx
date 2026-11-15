import { type ActionTunings, asNodeId, createScene, type RectPose, solid, useLatest, drawPreset, pathNode } from '@weasel-js/core';
import { usePathEditMode, tugPreset, useTugTool } from '@weasel-js/path-tools';
import {
  type ConfigOf, defineInstrument, f, Lab, type RenderContext, type SceneTrialState,
  TrialSceneCanvas, useTrialScene,
} from '@weasel-js/labkit';
import { useMemo } from 'react';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const FEATURES = [drawPreset, tugPreset] as const;

const PATHS = {
  straight: { d: 'M60 70 L280 70', color: '#7fb069' },
  gentle: { d: 'M60 170 C160 170 240 165 320 120', color: '#e0a458' },
  tight: { d: 'M60 300 C130 300 180 290 190 250', color: '#a48bd4' },
} as const;
type PathId = keyof typeof PATHS;

/** The path the lab opens in path edit. */
export const SEEDED_PATH_ID: PathId = 'gentle';

const config = f.schema({
  mode: f.enum('tangent', [
    { value: 'tangent', label: 'Tangent' },
    { value: 'curvature', label: 'Curvature' },
    { value: 'eased', label: 'Eased' },
  ]).radio().label('Tug along'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

const tugNode = (id: PathId) => pathNode(id, PATHS[id].d, { stroke: { paint: solid(PATHS[id].color), width: 3 } });

const createLabScene = () =>
  createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: (Object.keys(PATHS) as PathId[]).map(tugNode),
  });

function TugTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const { modes, pathEdit } = usePathEditMode({ id: SEEDED_PATH_ID });
  const tug = useTugTool();
  const tools = useMemo(() => ({ tug }), [tug]);
  const live = useLatest(ctx.config);
  // Thunked, so a change reaches a drag already under way.
  const tune = useMemo<ActionTunings>(() => ({
    tugPath: { params: () => ({ mode: live.current.mode }) },
  }), [live]);
  const selectionOptions = useMemo(() => ({ initial: [asNodeId(SEEDED_PATH_ID)] }), []);

  return (
    <TrialSceneCanvas
      features={FEATURES}
      scene={scene}
      trial={ctx.trial}
      modes={modes}
      pathEdit={pathEdit}
      tools={tools}
      tune={tune}
      selectionOptions={selectionOptions}
    />
  );
}

const tugInstrument = defineInstrument<State, Config>({
  name: 'Tug',
  config,
  initialState: () => ({ scene: null }),
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: icon('core:select') },
      { id: 'anchors', label: 'Anchors', icon: icon('core:anchors') },
      { id: 'tug', label: 'Tug', icon: icon('path-tools:tug') },
    ],
    initial: 'tug',
  },
  render: (ctx) => <TugTrial ctx={ctx} />,
});

export function TugLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Tug" instruments={[tugInstrument]} />
    </div>
  );
}
