import {
  asNodeId,
  createMeasurementStore,
  createScene,
  measureBetween,
  type RectPose,
  solid,
  useMeasureTool,
  useSelection,
} from '@weasel-js/core';
import { createGridLayer, gridSnapStrategy, roundToCell } from '@weasel-js/guides';
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
import { MeasureIcon, MeasureReadout, RectIcon, SelectIcon } from '@weasel-js/ui';
import { useMemo, useState } from 'react';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import s from './MeasureLabDemo.module.css';

const config = f.schema({
  snap: f.boolean(true).label('Snap to grid'),
  spacing: f.number(20).range(5, 80).step(5).suffix('px').label('Grid spacing'),
  angleStep: f.number(15).range(5, 90).step(5).suffix('°').label('Shift angle step'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

const shape = (id: string, x: number, y: number, width: number, height: number, color: string) => ({
  id: asNodeId(id),
  kind: 'leaf' as const,
  layer: 'default' as const,
  pose: { x, y, width, height },
  data: { fill: { paint: solid(color) } },
});

/** The selected square sits at (60, 60); the measurement runs from its corner
 *  to the target's, so Move by lands it exactly on the target. */
const MOVER = shape('mover', 60, 60, 80, 80, '#7fb069');
const TARGET = shape('target', 300, 180, 80, 80, '#d4d4d4');
const createLabScene = () =>
  createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [TARGET, MOVER, shape('bar', 440, 60, 140, 40, '#a48bd4')],
  });

function MeasureTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const { snap, spacing, angleStep } = ctx.config;
  const selection = useSelection({ mode: 'multi', scene, initial: [MOVER.id] });
  const [store] = useState(() => {
    const made = createMeasurementStore();
    made.set(measureBetween({ x: MOVER.pose.x, y: MOVER.pose.y }, { x: TARGET.pose.x, y: TARGET.pose.y }));
    return made;
  });
  const measure = useMeasureTool({ store, angleStep: (angleStep * Math.PI) / 180 });
  const tools = useMemo(() => ({ measure }), [measure]);

  const selectTool = useMemo(
    () => ({ snap: snap ? gridSnapStrategy<RectPose>(spacing) : undefined }),
    [snap, spacing],
  );
  const toolOptions = useMemo(
    () => ({
      snapPoint: snap
        ? (p: { x: number; y: number }) => ({ x: roundToCell(p.x, spacing), y: roundToCell(p.y, spacing) })
        : undefined,
    }),
    [snap, spacing],
  );
  const layers = useMemo(
    () => ({
      grid: {
        layer: createGridLayer({
          spacing,
          bounds: () => ({ x: -2000, y: -2000, width: 4000, height: 4000 }),
          accentEvery: 5,
        }),
      },
    }),
    [spacing],
  );

  return (
    <div className={s.stage}>
      <TrialSceneCanvas
        features={['draw']}
        defaultTools={['rect']}
        tools={tools}
        scene={scene}
        selection={selection}
        trial={ctx.trial}
        selectTool={selectTool}
        toolOptions={toolOptions}
        layers={layers}
      />
      <MeasureReadout store={store} />
    </div>
  );
}

const measureInstrument = defineInstrument<State, Config>({
  name: 'Measure',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    initial: 'measure',
    tools: [
      { id: 'select', label: 'Select', icon: SelectIcon, shortcut: 'V' },
      { id: 'measure', label: 'Measure', icon: MeasureIcon, shortcut: 'M' },
      { id: 'rect', label: 'Rectangle', icon: RectIcon, shortcut: 'R' },
    ],
  },
  render: (ctx) => <MeasureTrial ctx={ctx} />,
});

export function MeasureLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Measure, then transform" instruments={[measureInstrument]} defaultInstrument="Measure" />
    </div>
  );
}
