import {
  asNodeId,
  createMeasurements,
  createScene,
  measureNode,
  measureEndSource,
  measurementsContribution,
  type RectPose,
  solid,
  useMeasureTool,
} from '@weasel-js/core';
import { createGridLayer, gridSnapSource } from '@weasel-js/guides';
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
import { MeasureReadout } from '@weasel-js/ui/components/MeasureReadout';
import { useMemo, useState } from 'react';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import s from './MeasureLabDemo.module.css';
import { icon } from '../icons.gen';

const config = f.schema({
  snap: f.boolean(true).label('Snap to grid'),
  spacing: f.number(20).range(5, 80).step(5).suffix('px').label('Grid spacing'),
  angleStep: f.number(15).range(5, 90).step(5).suffix('°').label('Shift angle step'),
});
type Config = ConfigOf<typeof config>;
type Layer = 'default' | 'annotations';
type State = SceneTrialState<unknown, Layer, RectPose>;

const ANNOTATIONS: Layer = 'annotations';

const shape = (id: string, x: number, y: number, width: number, height: number, color: string) => ({
  id: asNodeId(id),
  kind: 'mark' as const,
  layer: 'default' as const,
  pose: { x, y, width, height },
  data: { fill: { paint: solid(color) } },
});

/** The green square's corner to the gray target's: Move by lands one on the other. */
const OFFSET = { start: { x: 60, y: 60 }, end: { x: 300, y: 180 } };
/** A line rising at 30°: Rotate by turns the selection the same way. */
const RISE = { start: { x: 440, y: 300 }, end: { x: 440 + 100 * Math.cos(Math.PI / 6), y: 300 - 100 * Math.sin(Math.PI / 6) } };

// The offset is added last, so with nothing picked it is the one the commands use.
const createLabScene = () =>
  createScene<unknown, Layer, RectPose>({
    systemLayers: [{ id: 'default' }, { id: ANNOTATIONS, annotation: true }],
    initial: [
      shape('target', 300, 180, 80, 80, '#d4d4d4'),
      shape('mover', 60, 60, 80, 80, '#7fb069'),
      shape('bar', 440, 60, 140, 40, '#a48bd4'),
      measureNode(asNodeId('rise'), ANNOTATIONS, RISE.start, RISE.end) as never,
      measureNode(asNodeId('offset'), ANNOTATIONS, OFFSET.start, OFFSET.end) as never,
    ],
  });

function MeasureTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const { snap, spacing, angleStep } = ctx.config;
  const [measurements] = useState(() => createMeasurements({ layer: ANNOTATIONS }));
  const measure = useMeasureTool({ measurements, angleStep: (angleStep * Math.PI) / 180 });
  const tools = useMemo(() => ({ measure }), [measure]);
  const ambient = useMemo(() => [measurementsContribution(scene as never, measurements)], [scene, measurements]);

  // A measurement's ends snap a drawing within reach; past them it takes the grid.
  const snapTo = useMemo(
    () => ({ sources: [measureEndSource(), ...(snap ? [gridSnapSource({ spacing })] : [])] }),
    [snap, spacing],
  );
  const layers = useMemo(
    () => ({
      grid: {
        layer: createGridLayer({
          spacing,
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
        ambient={ambient}
        scene={scene}
        trial={ctx.trial}
        snap={snapTo}
        layers={layers}
      />
      <MeasureReadout scene={scene as never} measurements={measurements} />
    </div>
  );
}

const measureInstrument = defineInstrument<State, Config>({
  name: 'Measure',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' },
      { id: 'measure', label: 'Measure', icon: icon('core:measure'), shortcut: 'M' },
      { id: 'rect', label: 'Rectangle', icon: icon('core:rect'), shortcut: 'R' },
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
