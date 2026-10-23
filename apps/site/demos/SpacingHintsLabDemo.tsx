import { asNodeId, createScene, type RectPose, solid, useSelection } from '@weasel-js/core';
import { createSpacingHintsPreset } from '@weasel-js/guides';
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
import { icon } from '../icons.gen';
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
  kind: 'mark' as const,
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
  const spacingHints = useMemo(
    () => createSpacingHintsPreset({ spacing, align, tolerance, readout: readout && { modifier }, color: HINT_COLOR }),
    [spacing, align, tolerance, readout, modifier],
  );

  return (
    <TrialSceneCanvas
      features={['draw', spacingHints]}
      defaultTools={['rect']}
      scene={scene}
      selection={selection}
      trial={ctx.trial}
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
      { id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' },
      { id: 'rect', label: 'Rectangle', icon: icon('core:rect'), shortcut: 'R' },
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
