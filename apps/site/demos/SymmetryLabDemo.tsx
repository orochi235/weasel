import {
  asNodeId, boundsOfPath, createScene, ellipsePath, pathFromD, solid, type NodeId, type RectPose, drawPreset, pathNode,
} from '@weasel-js/core';
import {
  type ConfigOf, defineInstrument, f, Lab, type RenderContext, type SceneTrialState, TrialSceneCanvas,
  useTrialConfigChange, useTrialScene,
} from '@weasel-js/labkit';
import {
  createSymmetry, symmetryGroupSpec, symmetryRegistry, WALLPAPER_GROUPS, wallpaperSpec, type SymmetryKind,
  type SymmetrySpec, type WallpaperCell, type WallpaperGroup,
} from '@weasel-js/symmetry';
import { DEG_TO_RAD } from '@weasel-js/geom';
import { useLayoutEffect, useMemo, useRef } from 'react';
import '@weasel-js/labkit/styles.css';
import 'windease/styles.css';
import { icon } from '../icons.gen';

export const GROUP_ID = 'symmetry';
/** A leaf symmetric about the kaleidoscope's first mirror, open in path edit. */
export const PETAL_ID = 'petal';
const CENTER = { x: 320, y: 240 };

const KINDS: { value: SymmetryKind; label: string }[] = [
  { value: 'mirror', label: 'Mirror' },
  { value: 'both', label: 'Both axes' },
  { value: 'point', label: 'Point' },
  { value: 'radial', label: 'Radial' },
  { value: 'kaleidoscope', label: 'Kaleidoscope' },
  { value: 'repeat', label: 'Repeat' },
  { value: 'wallpaper', label: 'Wallpaper' },
];
const CELLS: { value: WallpaperCell; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'mirror', label: 'Mirror' },
  { value: 'both', label: 'Both axes' },
  { value: 'point', label: 'Point' },
  { value: 'radial', label: 'Radial' },
  { value: 'kaleidoscope', label: 'Kaleidoscope' },
];
const GROUPS = (Object.keys(WALLPAPER_GROUPS) as WallpaperGroup[]).map((g) => ({ value: g, label: g }));

const config = f.schema({
  kind: f.enum<SymmetryKind>('kaleidoscope', KINDS).label('Kind'),
  angle: f.number(0).range(-180, 180).step(1).suffix('°').label('Angle'),
  count: f.number(6).range(1, 24).step(1).label('Count'),
  centerX: f.number(CENTER.x).step(1).label('Center x'),
  centerY: f.number(CENTER.y).step(1).label('Center y'),
  spacing: f.number(120).range(10, 400).step(1).suffix('px').label('Repeat spacing'),
  glide: f.boolean(false).label('Glide'),
  glideRows: f.boolean(false).label('Glide rows'),
  pattern: f.enum<WallpaperGroup>('p4m', GROUPS).label('Wallpaper group'),
  cell: f.enum<WallpaperCell>('kaleidoscope', CELLS).label('Cell'),
  cellAngle: f.number(0).range(-180, 180).step(1).suffix('°').label('Cell angle'),
  rowAngle: f.number(90).range(1, 179).step(1).suffix('°').label('Row angle'),
  rowSpacing: f.number(120).range(10, 400).step(1).suffix('px').label('Row spacing'),
  extentWidth: f.number(640).range(0, 2000).step(10).suffix('px').label('Extent width'),
  extentHeight: f.number(480).range(0, 2000).step(10).suffix('px').label('Extent height'),
  drawInto: f.boolean(true).label('Draw into the group'),
});
type Config = ConfigOf<typeof config>;
type State = SceneTrialState<unknown, 'default', RectPose>;

/** The group's spec to start with, matching the panel's defaults. */
const INITIAL: Partial<SymmetrySpec> = {
  kind: 'kaleidoscope', count: 6, angle: 0, cell: 'kaleidoscope', extent: { x: -320, y: -240, width: 640, height: 480 },
};

/** `box`, given in world, as a child of the group stores it: in the group's frame, whose origin is its center. */
const inGroup = (box: RectPose): RectPose => ({ ...box, x: box.x - CENTER.x, y: box.y - CENTER.y });

function pathLeaf(id: string, d: string, color: string) {
  const path = pathFromD(d);
  return pathNode(id, path, { fill: { paint: solid(color) } }, { parent: GROUP_ID, pose: inGroup(boundsOfPath(path)) });
}

function createLabScene() {
  const dot = { x: CENTER.x + 110 * Math.cos(15 * DEG_TO_RAD) - 12, y: CENTER.y + 110 * Math.sin(15 * DEG_TO_RAD) - 12, width: 24, height: 24 };
  const scene = createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    registry: symmetryRegistry,
    initial: [
      symmetryGroupSpec({ id: asNodeId(GROUP_ID), layer: 'default', center: CENTER, symmetry: INITIAL }),
      pathLeaf(PETAL_ID, 'M350 240 C385 205 435 205 470 240 C435 275 385 275 350 240 Z', '#7fb069'),
      {
        id: asNodeId('dot'), kind: 'mark', layer: 'default', parent: asNodeId(GROUP_ID),
        pose: inGroup(dot), data: { path: ellipsePath(dot), fill: { paint: solid('#d4a574') } },
      },
    ],
  });
  scene.setSelection([asNodeId(PETAL_ID)]);
  return scene;
}

/** The petal opens in path edit. */
const OPENING = { id: PETAL_ID };

/** The config fields a group's spec and center show as. */
function fieldsOf(spec: SymmetrySpec, center: { x: number; y: number }) {
  return {
    kind: spec.kind, angle: spec.angle / DEG_TO_RAD, count: spec.count, centerX: center.x, centerY: center.y,
    spacing: spec.spacing, glide: spec.glide, glideRows: spec.glideRows ?? false, cell: spec.cell, cellAngle: spec.cellAngle / DEG_TO_RAD,
    rowAngle: spec.rowAngle / DEG_TO_RAD, rowSpacing: spec.rowSpacing, extentWidth: spec.extent.width,
    extentHeight: spec.extent.height,
  };
}

/** The spec the panel's fields say, its extent centered on the group. */
function specOf(c: Config): Partial<SymmetrySpec> {
  return {
    kind: c.kind, angle: c.angle * DEG_TO_RAD, count: c.count, spacing: c.spacing, glide: c.glide, glideRows: c.glideRows, cell: c.cell,
    cellAngle: c.cellAngle * DEG_TO_RAD, rowAngle: c.rowAngle * DEG_TO_RAD, rowSpacing: c.rowSpacing,
    extent: { x: -c.extentWidth / 2, y: -c.extentHeight / 2, width: c.extentWidth, height: c.extentHeight },
  };
}

const ROUNDED = new Set(['angle', 'centerX', 'centerY']);

type Fields = ReturnType<typeof fieldsOf>;
const near = (a: unknown, b: unknown) =>
  typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 0.5 : a === b;

function SymmetryTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const sym = useMemo(() => createSymmetry(scene), [scene]);
  const ambient = useMemo(() => [sym.contribution], [sym]);
  const group = asNodeId(GROUP_ID) as NodeId;
  const { config, setConfig } = ctx;
  const { drawInto } = config;

  useLayoutEffect(() => sym.setActive(drawInto ? group : null), [sym, group, drawInto]);

  // The panel and the canvas both edit the group, and each shows the other's changes. A panel write lands on
  // the group inside its own undo step; picking a wallpaper group, or switching to Wallpaper, writes that
  // group's fields too, which the panel then follows.
  const showing = useRef(false);
  useTrialConfigChange<Config>((c, prev) => {
    if (showing.current) return;
    const g = sym.read(group);
    if (!g) return;
    const picked = c.kind === 'wallpaper' && (prev.kind !== 'wallpaper' || prev.pattern !== c.pattern);
    const preset = picked ? wallpaperSpec(c.pattern, c.spacing) : {};
    const have = fieldsOf(g.spec, g.center);
    const same = (Object.keys(have) as (keyof Fields)[]).every((k) => near(c[k], have[k]));
    if (same && !picked) return;
    sym.update(group, { spec: { ...specOf(c), ...preset }, center: { x: c.centerX, y: c.centerY } });
  });

  // A config write notifies the scene before React renders again: `show` reads what it last wrote, or it
  // writes the same field forever. What it writes is the group's already, so the panel's write-back skips it.
  const shown = useRef(config);
  useLayoutEffect(() => { shown.current = config; }, [config]);
  useLayoutEffect(() => {
    const show = () => {
      const g = sym.read(group);
      if (!g) return;
      const have = fieldsOf(g.spec, g.center);
      for (const k of Object.keys(have) as (keyof Fields)[]) {
        const v = ROUNDED.has(k) ? Math.round(have[k] as number) : have[k];
        if (near(v, shown.current[k])) continue;
        shown.current = { ...shown.current, [k]: v };
        showing.current = true;
        try {
          setConfig(k, v);
        } finally {
          showing.current = false;
        }
      }
    };
    const offScene = scene.subscribe(show);
    const offSym = sym.subscribe(show);
    show();
    return () => { offScene(); offSym(); };
  }, [scene, sym, group, setConfig]);

  return (
    <TrialSceneCanvas
      features={[drawPreset]}
      defaultTools={['rect', 'ellipse', 'pen', 'pencil']}
      scene={scene}
      trial={ctx.trial}
      ambient={ambient}
      defaultPathEdit={OPENING}
    />
  );
}

const symmetryInstrument = defineInstrument<State, Config>({
  name: 'Symmetry',
  config,
  initialState: () => ({ scene: null }),
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: icon('core:select') },
      { id: 'rect', label: 'Rectangle', icon: icon('core:rect') },
      { id: 'ellipse', label: 'Ellipse', icon: icon('core:ellipse') },
      { id: 'pen', label: 'Pen', icon: icon('core:pen') },
      { id: 'pencil', label: 'Pencil', icon: icon('core:pencil') },
    ],
  },
  render: (ctx) => <SymmetryTrial ctx={ctx} />,
});

export function SymmetryLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Symmetry" instruments={[symmetryInstrument]} />
    </div>
  );
}
