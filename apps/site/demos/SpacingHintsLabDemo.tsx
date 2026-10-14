import { asNodeId, createScene, type RectPose, solid, useSelection } from '@weasel-js/core';
import {
  alignMoveBehavior,
  createGuidesLayer,
  deriveAlignmentGuides,
  distanceReadout,
  type Guide,
  siblingBounds,
  type SpacingGap,
} from '@weasel-js/guides';
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
import { RectIcon, SelectIcon } from '@weasel-js/ui';
import { useMemo, useRef } from 'react';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';

const config = f.schema({
  spacing: f.boolean(true).label('Equal-spacing snap'),
  align: f.boolean(false).label('Snap to edges and centers'),
  tolerance: f.number(6).range(1, 24).step(1).suffix('px').label('Snap distance'),
  readout: f.boolean(true).label('Distance readout'),
  modifier: f.enum('alt', ['alt', 'shift', 'ctrl', 'meta']).label('Readout key'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

const HINT_COLOR = '#e0397f';
/** The box off the row, selected when a trial opens. */
export const STRAY_ID = asNodeId('stray');

const shape = (id: string, x: number, y: number, color: string) => ({
  id: asNodeId(id),
  kind: 'leaf' as const,
  layer: 'default' as const,
  pose: { x, y, width: 80, height: 80 },
  data: { fill: { paint: solid(color) } },
});

// A row 40 apart, and one box below it to drag into line.
const createLabScene = () =>
  createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      shape('a', 60, 80, '#7fb069'),
      shape('b', 180, 80, '#d4a574'),
      shape('c', 300, 80, '#6f9fd9'),
      shape('stray', 260, 260, '#a48bd4'),
    ],
  });

function SpacingTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const selection = useSelection({ mode: 'multi', initial: [STRAY_ID] });
  const { spacing, align, tolerance, readout, modifier } = ctx.config;
  const guidesRef = useRef<readonly Guide[]>([]);
  const gapsRef = useRef<readonly SpacingGap[]>([]);

  const selectTool = useMemo(() => {
    if (!spacing && !align) return undefined;
    const siblings = () => siblingBounds(scene, selection.get());
    return {
      move: {
        behaviors: [alignMoveBehavior<RectPose>({
          tolerance,
          getCandidates: () => (align ? deriveAlignmentGuides(siblings()) : []),
          setActiveGuides: (g) => { guidesRef.current = g; },
          ...(spacing ? { getSpacingTargets: siblings, setActiveGaps: (g: readonly SpacingGap[]) => { gapsRef.current = g; } } : {}),
        })],
      },
    };
  }, [scene, selection, spacing, align, tolerance]);

  const layers = useMemo(() => ({
    spacingHints: {
      layer: createGuidesLayer({
        getGuides: () => guidesRef.current,
        getGaps: () => gapsRef.current,
        color: HINT_COLOR,
      }),
    },
  }), []);

  const ambient = useMemo(
    () => (readout ? [distanceReadout({ modifier, color: HINT_COLOR })] : []),
    [readout, modifier],
  );

  return (
    <TrialSceneCanvas
      features={['draw']}
      defaultTools={['rect']}
      scene={scene}
      selection={selection}
      trial={ctx.trial}
      selectTool={selectTool}
      layers={layers}
      ambient={ambient}
    />
  );
}

const spacingInstrument = defineInstrument<State, Config>({
  name: 'Spacing hints',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: SelectIcon, shortcut: 'V' },
      { id: 'rect', label: 'Rectangle', icon: RectIcon, shortcut: 'R' },
    ],
  },
  render: (ctx) => <SpacingTrial ctx={ctx} />,
});

export function SpacingHintsLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Spacing hints" instruments={[spacingInstrument]} defaultInstrument="Spacing hints" />
    </div>
  );
}
