import {
  asNodeId, boundsOfPath, createScene, ellipsePath, pathFromD, solid, type NodeId, type PathEditHost, type RectPose,
  type SceneRegistry,
} from '@weasel-js/core';
import {
  type ConfigOf, defineInstrument, f, Lab, type RenderContext, type SceneTrialState, TrialSceneCanvas, useTrialScene,
} from '@weasel-js/labkit';
import { createEmitter } from '@weasel-js/registry';
import {
  createSymmetry, symmetryGroupSpec, symmetryRegistry, WALLPAPER_GROUPS, wallpaperSpec, type SymmetryKind,
  type SymmetrySpec, type WallpaperCell, type WallpaperGroup,
} from '@weasel-js/symmetry';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
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

const DEG = Math.PI / 180;
/** The group's spec to start with, matching the panel's defaults. */
const INITIAL: Partial<SymmetrySpec> = {
  kind: 'kaleidoscope', count: 6, angle: 0, cell: 'kaleidoscope', extent: { x: -320, y: -240, width: 640, height: 480 },
};

function pathLeaf(id: string, d: string, color: string) {
  const path = pathFromD(d);
  const { x, y, width, height } = boundsOfPath(path);
  return {
    id: asNodeId(id), kind: 'mark' as const, layer: 'default' as const, parent: asNodeId(GROUP_ID),
    pose: { x, y, width, height }, data: { path, fill: { paint: solid(color) } },
  };
}

function createLabScene() {
  const dot = { x: CENTER.x + 110 * Math.cos(15 * DEG) - 12, y: CENTER.y + 110 * Math.sin(15 * DEG) - 12, width: 24, height: 24 };
  const scene = createScene<unknown, 'default', RectPose>({
    systemLayers: [{ id: 'default' }],
    registry: symmetryRegistry as SceneRegistry<RectPose>,
    initial: [
      { ...symmetryGroupSpec({ id: asNodeId(GROUP_ID), layer: 'default', center: CENTER, symmetry: INITIAL }) } as never,
      pathLeaf(PETAL_ID, 'M350 240 C385 205 435 205 470 240 C435 275 385 275 350 240 Z', '#7fb069'),
      {
        id: asNodeId('dot'), kind: 'mark', layer: 'default', parent: asNodeId(GROUP_ID),
        pose: dot, data: { path: ellipsePath(dot), fill: { paint: solid('#d4a574') } },
      },
    ],
  });
  scene.setSelection([asNodeId(PETAL_ID)]);
  return scene;
}

/** Which path is open in path edit: the petal, to start with. */
function usePathEditHost() {
  const [store] = useState(() => {
    let id: string | null = PETAL_ID;
    const listeners = createEmitter();
    return {
      host: {
        editingId: () => id,
        setEditingId: (next: string | null) => {
          id = next;
          listeners.emit();
        },
      } satisfies PathEditHost,
      redraw: { subscribe: listeners.subscribe },
    };
  });
  return store;
}

/** The config fields a group's spec and center show as. */
function fieldsOf(spec: SymmetrySpec, center: { x: number; y: number }) {
  return {
    kind: spec.kind, angle: spec.angle / DEG, count: spec.count, centerX: center.x, centerY: center.y,
    spacing: spec.spacing, glide: spec.glide, glideRows: spec.glideRows ?? false, cell: spec.cell, cellAngle: spec.cellAngle / DEG,
    rowAngle: spec.rowAngle / DEG, rowSpacing: spec.rowSpacing, extentWidth: spec.extent.width,
    extentHeight: spec.extent.height,
  };
}

/** The spec the panel's fields say, its extent centered on the group. */
function specOf(c: Config): Partial<SymmetrySpec> {
  return {
    kind: c.kind, angle: c.angle * DEG, count: c.count, spacing: c.spacing, glide: c.glide, glideRows: c.glideRows, cell: c.cell,
    cellAngle: c.cellAngle * DEG, rowAngle: c.rowAngle * DEG, rowSpacing: c.rowSpacing,
    extent: { x: -c.extentWidth / 2, y: -c.extentHeight / 2, width: c.extentWidth, height: c.extentHeight },
  };
}

const ROUNDED = new Set(['angle', 'centerX', 'centerY']);

type Fields = ReturnType<typeof fieldsOf>;
const near = (a: unknown, b: unknown) =>
  typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 0.5 : a === b;

function SymmetryTrial({ ctx }: { ctx: RenderContext<State, Config> }) {
  const scene = useTrialScene(ctx, createLabScene);
  const sym = useMemo(() => createSymmetry(scene as never), [scene]);
  const ambient = useMemo(() => [sym.contribution], [sym]);
  const pathEdit = usePathEditHost();
  const redrawOn = useMemo(() => [pathEdit.redraw], [pathEdit]);
  const group = asNodeId(GROUP_ID) as NodeId;
  const { config, setConfig } = ctx;
  const { kind, pattern, drawInto } = config;

  useLayoutEffect(() => sym.setActive(drawInto ? group : null), [sym, group, drawInto]);

  // The panel and the canvas both edit the group: each shows the other's
  // changes. Picking a wallpaper group, or switching to Wallpaper, writes that
  // group's fields onto the group, and the panel follows.
  const applied = useRef<string | null>(null);
  useLayoutEffect(() => {
    const g = sym.read(group);
    if (!g) return;
    const now = kind === 'wallpaper' ? pattern : null;
    const preset = now !== null && now !== applied.current ? wallpaperSpec(now, config.spacing) : {};
    applied.current = now;
    const have = fieldsOf(g.spec, g.center);
    const same = (Object.keys(have) as (keyof Fields)[]).every((k) => near(config[k], have[k]));
    if (same && Object.keys(preset).length === 0) return;
    sym.update(group, { spec: { ...specOf(config), ...preset }, center: { x: config.centerX, y: config.centerY } });
  }, [sym, group, kind, pattern, config]);

  useLayoutEffect(() => {
    const show = () => {
      const g = sym.read(group);
      if (!g) return;
      const have = fieldsOf(g.spec, g.center);
      for (const k of Object.keys(have) as (keyof Fields)[]) {
        const v = ROUNDED.has(k) ? Math.round(have[k] as number) : have[k];
        if (!near(v, ctx.config[k])) setConfig(k, v);
      }
    };
    const offScene = scene.subscribe(show);
    const offSym = sym.subscribe(show);
    // The effect above can change the group in this same commit, while this one is unsubscribed.
    show();
    return () => { offScene(); offSym(); };
  }, [scene, sym, group, setConfig, ctx.config]);

  return (
    <TrialSceneCanvas
      features={['draw']}
      defaultTools={['rect', 'ellipse', 'pen', 'pencil']}
      scene={scene}
      trial={ctx.trial}
      ambient={ambient}
      pathEdit={pathEdit.host}
      redrawOn={redrawOn}
    />
  );
}

const symmetryInstrument = defineInstrument<State, Config>({
  name: 'Symmetry',
  config,
  initialState: () => ({ scene: null }),
  undo: {},
  tools: {
    tools: [
      { id: 'select', label: 'Select', icon: icon('core:select'), shortcut: 'V' },
      { id: 'rect', label: 'Rectangle', icon: icon('core:rect'), shortcut: 'R' },
      { id: 'ellipse', label: 'Ellipse', icon: icon('core:ellipse'), shortcut: 'E' },
      { id: 'pen', label: 'Pen', icon: icon('core:pen'), shortcut: 'P' },
      { id: 'pencil', label: 'Pencil', icon: icon('core:pencil'), shortcut: 'N' },
    ],
  },
  render: (ctx) => <SymmetryTrial ctx={ctx} />,
});

export function SymmetryLabDemo() {
  return (
    <div className="ckd-lab-frame">
      <Lab title="Symmetry" instruments={[symmetryInstrument]} defaultInstrument="Symmetry" />
    </div>
  );
}
