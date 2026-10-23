import {
  asNodeId, boundsOfPath, createScene, type Path, PathBuilder, pathInWorld, type RectPose, type RenderLayer, type Scene,
  solid, type Stroke,
} from '@weasel-js/core';
import { useGirthTool } from '@weasel-js/path-tools';
import { strokeToPath } from '@weasel-js/stroke';
import {
  type ConfigOf, defineInstrument, f, Lab, type RenderContext, type SceneTrialState, TrialSceneCanvas, useTrialScene,
} from '@weasel-js/labkit';
import { useEffect, useMemo, useRef } from 'react';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const config = f.schema({
  width: f.number(14).range(1, 40).step(1).suffix('px').label('Base width'),
  cap: f.enum('round', ['butt', 'round', 'square']).label('Cap'),
  join: f.enum('round', ['miter', 'round', 'bevel']).label('Join'),
  nib: f.boolean(true).label('Nib'),
  nibAngle: f.number(30).range(-90, 90).step(1).suffix('°').label('Nib angle'),
  nibRatio: f.number(0.15).range(0, 1).step(0.05).label('Nib thinnest'),
  reach: f.number(6).range(2, 24).step(1).suffix('px').label('Grab reach'),
  outline: f.boolean(false).label('Show strokeToPath outline'),
});
type Config = ConfigOf<typeof config>;
type Data = { path?: Path; stroke?: Stroke; fill?: null };
type State = SceneTrialState<Data, 'default', RectPose>;
type Style = Pick<Config, 'width' | 'cap' | 'join' | 'nib' | 'nibAngle' | 'nibRatio'>;

const radians = (deg: number) => (deg * Math.PI) / 180;

/** An S-curve across the trial, `y` down from the top: three anchors. */
const wave = (y: number): Path =>
  new PathBuilder().moveTo(60, y + 20).curveTo(180, y - 40, 300, y + 80, 440, y + 10).lineTo(520, y + 40).build();

/** A row of cursive loops on a baseline at `y`, each up one way and down another. */
function handwriting(y: number): Path {
  const b = new PathBuilder().moveTo(40, y);
  for (let i = 0; i < 5; i++) {
    const x = 40 + i * 80;
    b.curveTo(x + 40, y - 10, x + 60, y - 80, x + 40, y - 95)
      .curveTo(x + 25, y - 105, x + 10, y - 80, x + 30, y - 30)
      .curveTo(x + 40, y - 5, x + 60, y, x + 80, y);
  }
  return b.build();
}

const strokeNode = (path: Path, color: string, stroke: Partial<Stroke>) => {
  const b = boundsOfPath(path);
  return {
    kind: 'mark' as const,
    layer: 'default' as const,
    pose: { x: b.x, y: b.y, width: b.width, height: b.height },
    data: { path, fill: null, stroke: { paint: solid(color), width: 8, cap: 'round' as const, join: 'round' as const, ...stroke } },
  };
};

function seed(): Scene<Data, 'default', RectPose> {
  const scene = createScene<Data, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      strokeNode(wave(40), '#5b7c99', {}),
      strokeNode(wave(130), '#7fb069', { vertexWidths: [2, { left: 4, right: 16 }, 4] }),
      strokeNode(wave(220), '#d4a574', { vertexWidths: [14, 4, 14], dash: [20, 10], cap: 'butt' }),
      strokeNode(wave(310), '#a48bd4', { vertexWidths: [4, 16, 6], markerStart: 'circle', markerEnd: 'arrow' }),
      strokeNode(handwriting(520), '#2d2a32', { width: 14, nib: { angle: radians(30), ratio: 0.15 } }),
    ],
  });
  // The handwriting is what the style controls start on.
  const last = scene.roots.at(-1);
  if (last) scene.setSelection([asNodeId(String(last))]);
  return scene;
}

/** Every stroke's region as `strokeToPath` answers it, outlined in a
 *  hairline over the drawn ribbon. */
function outlineLayer(scene: Scene<Data, 'default', RectPose>): RenderLayer<unknown> {
  return {
    id: 'stroke-outline',
    label: 'strokeToPath outline',
    draw: () => scene.renderOrderNodes().flatMap((node) => {
      const { path, stroke } = node.data ?? {};
      if (node.kind !== 'mark' || !path || !stroke) return [];
      return [{
        kind: 'path' as const,
        path: strokeToPath(pathInWorld(path, node.pose), stroke),
        stroke: { paint: { color: '#e0218a' }, width: { px: 1 } },
      }];
    }),
  };
}

/** The stroke fields a change of `key` in the panel writes. */
function fieldsFor(key: keyof Style, style: Style): Partial<Stroke> {
  if (key === 'width' || key === 'cap' || key === 'join') return { [key]: style[key] };
  return { nib: style.nib ? { angle: radians(style.nibAngle), ratio: style.nibRatio } : undefined };
}

/** Write each panel style setting that changed onto the selected strokes,
 *  as one undo entry. */
function useStyleControls(scene: Scene<Data, 'default', RectPose>, style: Style): void {
  const previous = useRef(style);
  const { width, cap, join, nib, nibAngle, nibRatio } = style;
  useEffect(() => {
    const now = { width, cap, join, nib, nibAngle, nibRatio };
    const changed = (Object.keys(now) as (keyof Style)[]).filter((k) => now[k] !== previous.current[k]);
    previous.current = now;
    if (changed.length === 0) return;
    const patch = Object.assign({}, ...changed.map((k) => fieldsFor(k, now))) as Partial<Stroke>;
    scene.batch('Stroke style', () => {
      for (const id of scene.getSelection()) {
        const node = scene.get(id);
        const stroke = node?.data?.stroke;
        if (node?.kind !== 'mark' || !stroke) continue;
        const next = { ...stroke, ...patch };
        if (next.nib === undefined) delete next.nib;
        scene.update(id, { data: { ...node.data, stroke: next } });
      }
    });
  }, [scene, width, cap, join, nib, nibAngle, nibRatio]);
}

function WidthTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, seed);
  useStyleControls(scene, ctx.config);
  const girthTool = useGirthTool({ reach: ctx.config.reach });
  const tools = useMemo(() => ({ girth: girthTool }), [girthTool]);
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
      { id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' },
      { id: 'girth', label: 'Girth', icon: icon('path-tools:girth'), shortcut: 'Shift+W' },
    ],
    initial: 'girth',
  },
  render: (ctx) => <WidthTrial ctx={ctx} />,
});

export function StrokeWidthLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Stroke width and nib" instruments={[widthInstrument]} defaultInstrument="Width" />
    </div>
  );
}
