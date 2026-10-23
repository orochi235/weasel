import { type ActionTunings, asNodeId, boundsOfPath, createScene, type PathEditHost, pathFromD, type RectPose, solid, useLatest } from '@weasel-js/core';
import { LENGTHEN_TOOL, lengthenPreset } from '@weasel-js/path-tools';
import {
  type ConfigOf, defineInstrument, f, Lab, type RenderContext, type SceneTrialState,
  TrialSceneCanvas, useTrialScene,
} from '@weasel-js/labkit';
import { createModeRegistry, DEFAULT_MODES } from '@weasel-js/modes';
import { useMemo, useState } from 'react';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const FEATURES = ['draw', lengthenPreset] as const;

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
  ]).radio().label('Lengthen along'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

const pathNode = (id: PathId) => {
  const path = pathFromD(PATHS[id].d);
  return {
    id: asNodeId(id),
    kind: 'mark' as const,
    layer: 'default' as const,
    pose: boundsOfPath(path),
    data: { path, stroke: { paint: solid(PATHS[id].color), width: 3 } },
  };
};

const createLabScene = () =>
  createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: (Object.keys(PATHS) as PathId[]).map(pathNode),
  });

/**
 * Path edit as a mode the trial holds, its target the open path, and the
 * path-edit tool as the trial palette's tool: picking Lengthen there turns
 * the tool on, and the canvas putting the tool down moves the palette back
 * to Select.
 */
function usePathEdit(ctx: RenderContext<State, Config>, seeded: string) {
  const [modes] = useState(() => createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' }));
  const [target, setTarget] = useState<string | null>(seeded);
  const trial = useLatest(ctx.trial);
  const paletteTool = ctx.trial.activeToolId;
  const pathEdit = useMemo<PathEditHost>(() => ({
    editingId: () => (modes.current().id === 'path-edit' ? target : null),
    setEditingId: (id) => {
      setTarget(id);
      modes.setMode(id ? 'path-edit' : 'normal');
      if (!id && trial.current.activeToolId === LENGTHEN_TOOL) trial.current.setActiveTool('select');
    },
    tool: () => (paletteTool === LENGTHEN_TOOL ? LENGTHEN_TOOL : null),
    setTool: (id) => trial.current.setActiveTool(id ?? 'select'),
  }), [modes, target, paletteTool, trial]);
  return { modes, pathEdit };
}

function LengthenTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const { modes, pathEdit } = usePathEdit(ctx, SEEDED_PATH_ID);
  const live = useLatest(ctx.config);
  // Thunked, so a change reaches a drag already under way.
  const tune = useMemo<ActionTunings>(() => ({
    lengthenPath: { params: () => ({ mode: live.current.mode }) },
  }), [live]);
  const selectionOptions = useMemo(() => ({ initial: [asNodeId(SEEDED_PATH_ID)] }), []);

  return (
    <TrialSceneCanvas
      features={FEATURES}
      scene={scene}
      trial={ctx.trial}
      modes={modes}
      pathEdit={pathEdit}
      tune={tune}
      selectionOptions={selectionOptions}
    />
  );
}

const lengthenInstrument = defineInstrument<State, Config>({
  name: 'Lengthen',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' },
      { id: LENGTHEN_TOOL, label: 'Lengthen', icon: icon('path-tools:lengthen') },
    ],
    initial: LENGTHEN_TOOL,
  },
  render: (ctx) => <LengthenTrial ctx={ctx} />,
});

export function LengthenLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Lengthen" instruments={[lengthenInstrument]} defaultInstrument="Lengthen" />
    </div>
  );
}
