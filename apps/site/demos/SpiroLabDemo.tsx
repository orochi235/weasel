import { type ActionTunings, asNodeId, boundsOfPath, createScene, type RectPose, solid } from '@weasel-js/core';
import { SPIRO_KINDS, type SpiroContour, type SpiroKind } from '@weasel-js/geom';
import { spiroNodeData, spiroPreset, useSpiroTool } from '@weasel-js/path-tools';
import {
  type ConfigOf,
  defineInstrument,
  f,
  FloatingPanel,
  Lab,
  type RenderContext,
  type SceneTrialState,
  TrialSceneCanvas,
  useTrialScene,
} from '@weasel-js/labkit';
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import { useMemo } from 'react';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const config = f.schema({
  pointKind: f.enum<SpiroKind>('smooth', SPIRO_KINDS).toggle().label('New point kind'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

/** The curve the lab opens on, in path edit. */
export const SEEDED_SPIRO = 'wave';

const FEATURES = ['draw', spiroPreset] as const;
const OPENING = { id: SEEDED_SPIRO };

function spiroNode(id: string, contour: SpiroContour, color: string) {
  const { path, representation } = spiroNodeData([contour]);
  const { x, y, width, height } = boundsOfPath(path);
  return {
    id: asNodeId(id),
    kind: 'mark' as const,
    layer: 'default' as const,
    pose: { x, y, width, height },
    data: {
      path,
      representation,
      fill: contour.closed ? { paint: solid(color) } : null,
      stroke: { paint: solid(color), width: 2 },
    },
  };
}

const createLabScene = () =>
  createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      spiroNode(SEEDED_SPIRO, {
        closed: false,
        points: [
          { x: 60, y: 300, kind: 'smooth' },
          { x: 160, y: 170, kind: 'smooth' },
          { x: 280, y: 280, kind: 'corner' },
          { x: 360, y: 150, kind: 'smooth' },
          { x: 440, y: 150, kind: 'left' },
          { x: 540, y: 260, kind: 'smooth' },
        ],
      }, '#4a7fd4'),
      spiroNode('loop', {
        closed: true,
        points: [
          { x: 600, y: 80, kind: 'smooth' },
          { x: 700, y: 120, kind: 'smooth' },
          { x: 660, y: 220, kind: 'smooth' },
          { x: 570, y: 170, kind: 'smooth' },
        ],
      }, '#d4a574'),
    ],
  });

function SpiroTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const { pointKind } = ctx.config;
  const tune = useMemo<ActionTunings>(() => ({ 'spiro.placePoint': { params: { kind: pointKind } } }), [pointKind]);
  const selectionOptions = useMemo(() => ({ initial: [asNodeId(SEEDED_SPIRO)] }), []);
  const spiro = useSpiroTool();
  const tools = useMemo(() => ({ spiro }), [spiro]);

  return (
    <>
      <TrialSceneCanvas
        features={FEATURES}
        tools={tools}
        scene={scene}
        trial={ctx.trial}
        tune={tune}
        defaultPathEdit={OPENING}
        selectionOptions={selectionOptions}
      />
      <FloatingPanel anchor="top-right">
        <ActionBar group="spiro" />
      </FloatingPanel>
    </>
  );
}

const spiroInstrument = defineInstrument<State, Config>({
  name: 'Spiro',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' },
      { id: 'spiro', label: 'Spiro', icon: icon('path-tools:spiro'), shortcut: 'Shift+P' },
    ],
  },
  render: (ctx) => <SpiroTrial ctx={ctx} />,
});

export function SpiroLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Spiro curves" instruments={[spiroInstrument]} defaultInstrument="Spiro" />
    </div>
  );
}
