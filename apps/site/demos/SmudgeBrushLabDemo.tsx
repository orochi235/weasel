import { type ActionTunings, asNodeId, boundsOfPath, createScene, ellipsePath, polygonFromPoints, type PolygonPath, type RectPose, solid, useLatest } from '@weasel-js/core';
import { smudgePreset, useSmudgeBrushTool } from '@weasel-js/path-tools';
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
import { useMemo } from 'react';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const FEATURES = ['draw', smudgePreset] as const;

const config = f.schema({
  radiusPx: f.number(40).range(5, 150).step(1).suffix('px').label('Brush radius'),
  strength: f.number(0.6).range(0.05, 1).step(0.05).label('Strength'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

const pathNode = (id: string, path: PolygonPath, color: string) => ({
  id: asNodeId(id),
  kind: 'mark' as const,
  layer: 'default' as const,
  pose: boundsOfPath(path),
  data: { path, fill: { paint: solid(color) }, stroke: { paint: solid('#2b2f36'), width: 2 } },
});

const createLabScene = () => {
  const scene = createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      pathNode('square', polygonFromPoints([{ x: 80, y: 80 }, { x: 260, y: 80 }, { x: 260, y: 260 }, { x: 80, y: 260 }]), '#d4a574'),
      pathNode('circle', ellipsePath({ x: 330, y: 90, width: 170, height: 170 }), '#7fb069'),
    ],
  });
  scene.setSelection([asNodeId('square'), asNodeId('circle')]);
  return scene;
};

function SmudgeTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const smudgeBrush = useSmudgeBrushTool();
  const tools = useMemo(() => ({ smudgeBrush }), [smudgeBrush]);
  // Thunked, so a change reaches a stroke already under way.
  const brush = useLatest(ctx.config);
  const tune = useMemo<ActionTunings>(() => ({
    smudgeBrush: { params: () => ({ radiusPx: brush.current.radiusPx, strength: brush.current.strength }) },
  }), [brush]);
  return <TrialSceneCanvas features={FEATURES} scene={scene} trial={ctx.trial} tools={tools} tune={tune} />;
}

const smudgeInstrument = defineInstrument<State, Config>({
  name: 'Smudge brush',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' },
      { id: 'smudgeBrush', label: 'Smudge brush', icon: icon('ui:crosshair'), shortcut: 'S' },
    ],
    initial: 'smudgeBrush',
  },
  render: (ctx) => <SmudgeTrial ctx={ctx} />,
});

export function SmudgeBrushLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Smudge brush" instruments={[smudgeInstrument]} defaultInstrument="Smudge brush" />
    </div>
  );
}
