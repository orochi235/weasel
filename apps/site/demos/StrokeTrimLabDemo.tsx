import {
  asNodeId,
  boundsOfPath,
  createScene,
  pathFromD,
  rectPath,
  solid,
  type ExportScene,
  type Path,
  type RectPose,
  type Stroke,
  type StrokeAlign,
} from '@weasel-js/core';
import { asPolygonPath } from '@weasel-js/geom';
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
import { dashForStrokeStyle } from '@weasel-js/paint';
import { exportRegionsPdf } from '@weasel-js/pdf/export';
import { exportRegionSvg } from '@weasel-js/svg';
import { Button } from '@weasel-js/ui/components/Button';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import s from './StrokeTrimLabDemo.module.css';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

const config = f.schema({
  start: f.number(0.1).range(0, 1).step(0.01).label('Start'),
  end: f.number(0.8).range(0, 1).step(0.01).label('End'),
  pace: f.enum('length', ['length', 'anchor']).label('Pace'),
  dash: f.enum('solid', ['solid', 'dashed', 'dotted']).label('Style'),
  markers: f.boolean(true).label('Markers on the open curve'),
});
type Config = ConfigOf<typeof config>;
type Data = { path: Path; fill?: { paint: ReturnType<typeof solid> }; stroke: Stroke };
type State = SceneTrialState<Data, 'default', RectPose>;

/** The wheel zooms, so a cut can be looked at closely; the hand tool pans. */
const WHEEL_ZOOM = { pan: false, zoom: { wheel: 'plain' } } as const;

/** The world rect both exports write, the same one the canvas opens on. */
const PAGE = { x: 0, y: 0, width: 760, height: 380 };

const rounded = (x: number, y: number, width: number, height: number, radius: number): Path => ({
  ...asPolygonPath(rectPath(x, y, width, height)),
  corners: Array.from({ length: 4 }, () => ({ shape: 'round' as const, radius })),
});

interface Shape {
  id: string;
  path: Path;
  /** Where the box differs from the path's own bounds, the node is stretched into it. */
  pose?: RectPose;
  width: number;
  align?: StrokeAlign;
  color: string;
  fill?: string;
  open?: boolean;
}

const SHAPES: Shape[] = [
  { id: 'curve', path: pathFromD('M40 140 C120 20 220 240 320 120 S420 60 460 140'), width: 4, color: '#3e4c59', open: true },
  { id: 'rounded', path: rounded(500, 40, 110, 110, 26), width: 4, color: '#a48bd4' },
  { id: 'stretched', path: rounded(640, 40, 50, 110, 18), pose: { x: 640, y: 40, width: 100, height: 110 }, width: 4, color: '#d4a574' },
  { id: 'inner', path: rectPath(60, 220, 120, 120), width: 14, align: 'inner', color: '#7fb069', fill: '#7fb06933' },
  { id: 'center', path: rectPath(320, 220, 120, 120), width: 14, align: 'center', color: '#7fb069', fill: '#7fb06933' },
  { id: 'outer', path: rectPath(580, 220, 120, 120), width: 14, align: 'outer', color: '#7fb069', fill: '#7fb06933' },
];

function strokeOf(shape: Shape, cfg: Config): Stroke {
  const dash = cfg.dash === 'solid' ? undefined : dashForStrokeStyle(cfg.dash, shape.width);
  const heads = shape.open && cfg.markers ? { markerStart: 'dot', markerEnd: 'arrow' } : {};
  return {
    paint: solid(shape.color),
    width: shape.width,
    ...(shape.align ? { align: shape.align } : {}),
    ...(dash ? { dash } : {}),
    ...heads,
    trim: { start: cfg.start, end: cfg.end, pace: cfg.pace },
  };
}

const dataOf = (shape: Shape, cfg: Config): Data => ({
  path: shape.path,
  ...(shape.fill ? { fill: { paint: solid(shape.fill) } } : {}),
  stroke: strokeOf(shape, cfg),
});

const createLabScene = (cfg: Config) => () =>
  createScene<Data, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    initial: SHAPES.map((shape) => ({
      id: asNodeId(shape.id),
      kind: 'mark' as const,
      layer: 'default' as const,
      pose: shape.pose ?? boundsOfPath(shape.path),
      data: dataOf(shape, cfg),
    })),
  });

/** The scene as the SVG export writes it, drawn by the browser's own SVG renderer. */
function SvgExport({ scene, version }: { scene: ExportScene; version: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void exportRegionSvg(scene, PAGE, { background: '#ffffff' }).then((text) => live && setSvg(text));
    return () => { live = false; };
  }, [scene, version]);
  return svg === null ? null : (
    <img className={s.svg} alt="The scene as exported SVG" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} />
  );
}

/** Writes the scene as a PDF and opens it in the browser's viewer. */
function PdfExport({ scene }: { scene: ExportScene }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const live = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; };
  }, []);
  const write = async () => {
    const { blob } = await exportRegionsPdf(scene, [PAGE], { background: '#ffffff', title: 'Stroke trim' });
    if (live.current) setUrl(URL.createObjectURL(blob));
  };
  return (
    <div className={s.buttons}>
      <Button onClick={() => void write()}>Write PDF</Button>
      {url && <a href={url} target="_blank" rel="noreferrer">Open the PDF</a>}
    </div>
  );
}

function TrimTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const cfg = ctx.config;
  const scene = useTrialScene(ctx, createLabScene(cfg));
  const version = JSON.stringify(cfg);
  // A layout effect, so the scene holds the new trims before the export pane's own effect reads it.
  useLayoutEffect(() => {
    // The trims follow from the config, which keeps its own undo; recording them too splits one change into six.
    scene.untracked(() => {
      for (const shape of SHAPES) scene.update(asNodeId(shape.id), { data: dataOf(shape, cfg) });
    });
    // `version` stands for `cfg`, whose identity changes on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, version]);
  const page = scene as unknown as ExportScene;
  return (
    <div className={s.trial}>
      <div className={s.canvas}>
        <TrialSceneCanvas scene={scene} trial={ctx.trial} defaultTools={['hand']} viewport={WHEEL_ZOOM} />
      </div>
      <aside className={s.exports} aria-label="Exports">
        <h3 className={s.heading}>Exported SVG</h3>
        <SvgExport scene={page} version={version} />
        <PdfExport scene={page} />
      </aside>
    </div>
  );
}

const trimInstrument = defineInstrument<State, Config>({
  name: 'Stroke trim',
  config,
  initialState: () => ({ scene: null }),
  tools: {
    initial: 'hand',
    tools: [
      { id: 'hand', label: 'Hand', icon: icon('core:hand') },
      { id: 'select', label: 'Select', icon: icon('core:select') },
    ],
  },
  render: (ctx) => <TrimTrial ctx={ctx} />,
});

export function StrokeTrimLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Stroke trim" instruments={[trimInstrument]} />
    </div>
  );
}
