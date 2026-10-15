import {
  boundsOfPath, createScene, type Path, PathBuilder, pathInWorld, type RectPose, type RenderLayer, type Scene,
  solid, type Stroke, strokeToPath, useLatest, useWidthTool, type WidthProfile,
} from '@weasel-js/core';
import {
  type ConfigOf, defineInstrument, f, Lab, type RenderContext, type SceneTrialState, TrialSceneCanvas, useTrialScene,
} from '@weasel-js/labkit';
import { SelectIcon, UnknownIcon } from '@weasel-js/ui';
import { useEffect, useMemo, useRef } from 'react';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';

const config = f.schema({
  width: f.number(10).range(1, 40).step(1).suffix('px').label('Base width'),
  cap: f.enum('round', ['butt', 'round', 'square']).label('Cap'),
  join: f.enum('round', ['miter', 'round', 'bevel']).label('Join'),
  reach: f.number(6).range(2, 24).step(1).suffix('px').label('Grab reach'),
  outline: f.boolean(false).label('Show strokeToPath outline'),
});
type Config = ConfigOf<typeof config>;
type Data = { path?: Path; stroke?: Stroke; fill?: null };
type State = SceneTrialState<Data, 'default', RectPose>;
type Style = Pick<Config, 'width' | 'cap' | 'join'>;

const SWELL: WidthProfile = [{ t: 0, width: 0.2 }, { t: 0.35, width: 2.2 }, { t: 0.7, width: 0.8 }, { t: 1, width: 0.2 }];
const TAPER: WidthProfile = [{ t: 0, width: 1.6 }, { t: 1, width: 0.4 }];

/** An S-curve across the trial, `y` down from the top. */
const wave = (y: number): Path =>
  new PathBuilder().moveTo(60, y + 20).curveTo(180, y - 40, 300, y + 80, 440, y + 10).lineTo(520, y + 40).build();

const strokeNode = (y: number, color: string, extra: Partial<Stroke>, style: Style) => {
  const path = wave(y);
  const b = boundsOfPath(path);
  return {
    kind: 'leaf' as const,
    layer: 'default' as const,
    pose: { x: b.x, y: b.y, width: b.width, height: b.height },
    data: { path, fill: null, stroke: { paint: solid(color), width: style.width, cap: style.cap, join: style.join, ...extra } },
  };
};

const seed = (style: Style) =>
  createScene<Data, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      strokeNode(60, '#5b7c99', {}, style),
      strokeNode(170, '#7fb069', { widthProfile: SWELL }, style),
      strokeNode(280, '#d4a574', { widthProfile: TAPER, dash: [24, 12], cap: 'butt' }, style),
      strokeNode(390, '#a48bd4', { widthProfile: SWELL, markerStart: 'circle', markerEnd: 'arrow' }, style),
    ],
  });

/** Every stroke's region as `strokeToPath` answers it, outlined in a
 *  hairline over the drawn ribbon. */
function outlineLayer(scene: Scene<Data, 'default', RectPose>): RenderLayer<unknown> {
  return {
    id: 'stroke-outline',
    label: 'strokeToPath outline',
    draw: () => scene.renderOrderNodes().flatMap((node) => {
      const { path, stroke } = node.data ?? {};
      if (node.kind !== 'leaf' || !path || !stroke) return [];
      return [{
        kind: 'path' as const,
        path: strokeToPath(pathInWorld(path, node.pose), stroke),
        stroke: { paint: { color: '#e0218a' }, width: { px: 1 } },
      }];
    }),
  };
}

/** Write the panel's width, cap, and join onto every stroke, as one undo
 *  entry, whenever they change after the trial opens. */
function useStyleControls(scene: Scene<Data, 'default', RectPose>, style: Style): void {
  const first = useRef(true);
  const { width, cap, join } = style;
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    scene.batch('Stroke style', () => {
      for (const node of scene.renderOrderNodes()) {
        const stroke = node.data?.stroke;
        if (node.kind !== 'leaf' || !stroke) continue;
        scene.update(node.id, { data: { ...node.data, stroke: { ...stroke, width, cap, join } } });
      }
    });
  }, [scene, width, cap, join]);
}

function WidthTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const latest = useLatest(ctx.config);
  const scene = useTrialScene(ctx, () => seed(latest.current));
  useStyleControls(scene, ctx.config);
  const widthTool = useWidthTool({ reach: ctx.config.reach });
  const tools = useMemo(() => ({ width: widthTool }), [widthTool]);
  const layers = useMemo(
    () => (ctx.config.outline ? { outline: { layer: outlineLayer(scene) } } : {}),
    [ctx.config.outline, scene],
  );
  return (
    <TrialSceneCanvas features={['draw']} scene={scene} trial={ctx.trial} tools={tools} layers={layers} />
  );
}

const widthInstrument = defineInstrument<State, Config>({
  name: 'Width',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: SelectIcon, shortcut: 'V' },
      { id: 'width', label: 'Width', icon: UnknownIcon, shortcut: 'Shift+W' },
    ],
    initial: 'width',
  },
  render: (ctx) => <WidthTrial ctx={ctx} />,
});

export function VariableWidthStrokesLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Variable-width strokes" instruments={[widthInstrument]} defaultInstrument="Width" />
    </div>
  );
}
