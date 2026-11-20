/** The audit map as a scene: a frame per package, a cell per area, kept in step with the map's data. */
import { asNodeId, contrastRatio, createScene, nodeShapesOf, type NodeId, type RectPose, type Scene } from '@weasel-js/core';
import { deepEqual, getOwn } from '@weasel-js/registry';
import { AUDIT_PAINTER, type AuditCellData, type AuditFrameData, type AuditNodeData } from './auditPainter';
import { STAGE_LABEL, cellLabelOf, toneOf, wrapAtDots } from './areaData';
import type { MapCell, MapFrame } from './mapLayout';
import type { AuditPhase } from './phases';
import type { AuditArea } from './skulkMap.types';

/** The colors the map paints in, read off the page's theme. */
export interface AuditPalette {
  readonly panel: string;
  readonly ink: string;
  readonly inkInverse: string;
  readonly uncharted: string;
  readonly hatch: string;
  readonly depth: readonly [string, string, string, string, string];
  readonly settled: string;
  readonly live: string;
  /** The outline a live area's cell wears, by the phase it is in. */
  readonly phase: Readonly<Record<AuditPhase, string>>;
  /** The theme's faces, for labels and for numbers. */
  readonly font: { readonly ui: string; readonly numeric: string };
}

export type AuditLayer = 'frames' | 'cells';
export type AuditScene = Scene<AuditNodeData, AuditLayer, RectPose>;

/** An empty map, its painter registered with it. */
export function createAuditScene(): AuditScene {
  const scene = createScene<AuditNodeData, AuditLayer, RectPose>({ systemLayers: [{ id: 'frames' }, { id: 'cells' }] });
  nodeShapesOf(scene).register(AUDIT_PAINTER);
  return scene;
}

/** A package frame's node id; an area's is its own id. */
export const frameIdOf = (name: string): NodeId => asNodeId(`package:${name}`);

export interface AuditNodeSpec {
  readonly id: NodeId;
  readonly layer: AuditLayer;
  readonly pose: RectPose;
  readonly data: AuditNodeData;
}

const poseOf = (b: { x: number; y: number; width: number; height: number }): RectPose =>
  ({ x: b.x, y: b.y, width: b.width, height: b.height });

function frameTitle(f: MapFrame): string | undefined {
  if (!f.titled) return undefined;
  const name = f.name.toUpperCase();
  const full = `${name} · ${f.files}`;
  return full.length * TITLE_CHAR < f.width - 8 ? full : name.slice(0, Math.max(1, Math.floor((f.width - 8) / TITLE_CHAR)));
}

/** Whichever of the two inks reads better on `fill`. */
export function inkOn(fill: string, palette: AuditPalette): string {
  const plain = contrastRatio(palette.ink, fill) ?? 0;
  const inverse = contrastRatio(palette.inkInverse, fill) ?? 0;
  return inverse > plain ? palette.inkInverse : palette.ink;
}

/** Rough widths of a character of Oswald, the theme's condensed face: a cell label at 12px, a frame title at 12.5px bold. */
const LABEL_CHAR = 6.2;
const TITLE_CHAR = 6.9;
/** A label line's height. */
const LINE = 15;

/** Room the pass dots take at a cell's top right, which its label stops short of. */
const dotsRoom = (passes: number) => (passes > 0 ? Math.min(passes, 4) * 6 + 4 : 0);

/** An area's label as the lines its cell has room for, broken after dots, the last cut short if it must be. */
function labelLines(area: AuditArea, cell: MapCell, staged: boolean): string[] {
  const room = cell.height - 6 - (staged ? LINE + 1 : 0) - (area.queue !== null ? 17 : 0);
  return wrapAtDots(cellLabelOf(area.id), Math.floor((cell.width - 8 - dotsRoom(area.passes.length)) / LABEL_CHAR), Math.max(1, Math.floor(room / LINE)));
}

function cellData(area: AuditArea, cell: MapCell, palette: AuditPalette, phase: AuditPhase | undefined): AuditCellData {
  const tone = toneOf(area);
  const fill = tone === 'settled' ? palette.settled : tone === 'unaudited' ? palette.uncharted : palette.depth[tone];
  const ink = tone === 'unaudited' ? palette.ink : inkOn(fill, palette);
  const live = area.status === 'tonight';
  const labeled = cell.width > 52 && cell.height > 28;
  const staged = live && area.stage !== null && labeled && cell.height > 46;
  const showsQueue = area.queue !== null && area.queue <= 16 && !live && cell.width > 22 && cell.height > 22;
  return {
    kind: 'audit-cell',
    fill: { color: fill },
    ...(tone === 'unaudited' ? { over: { kind: 'hatch', color: palette.hatch, size: 6, lineWidth: 1.6 } } : {}),
    edge: palette.panel,
    ink,
    ...(labeled ? { label: labelLines(area, cell, staged) } : {}),
    ...(live ? { live: phase ? palette.phase[phase] : palette.live } : {}),
    ...(staged ? { stage: getOwn(STAGE_LABEL, area.stage!) ?? area.stage! } : {}),
    font: palette.font.ui,
    numericFont: palette.font.numeric,
    ...(showsQueue ? { queue: area.queue! } : {}),
    ...(tone === 'settled' ? { settled: true } : {}),
    dots: area.passes.length,
    pulse: 1,
  };
}

/** Every node the map needs for `areas` laid out as `frames` and `cells`, a live area outlined in its phase's color. */
export function auditNodeSpecs(
  areas: readonly AuditArea[],
  layout: { frames: readonly MapFrame[]; cells: readonly MapCell[] },
  palette: AuditPalette,
  phases: ReadonlyMap<string, AuditPhase> = new Map(),
): AuditNodeSpec[] {
  const byId = new Map(areas.map((a) => [a.id, a]));
  const frames = layout.frames.map((f): AuditNodeSpec => {
    const title = frameTitle(f);
    const data: AuditFrameData = { kind: 'audit-frame', edge: palette.ink, ink: palette.ink, font: palette.font.ui, ...(title ? { title } : {}) };
    return { id: frameIdOf(f.name), layer: 'frames', pose: poseOf(f), data };
  });
  const cells = layout.cells.flatMap((c): AuditNodeSpec[] => {
    const area = byId.get(c.id);
    return area ? [{ id: asNodeId(c.id), layer: 'cells', pose: poseOf(c), data: cellData(area, c, palette, phases.get(area.id)) }] : [];
  });
  return [...frames, ...cells];
}

const samePose = (a: RectPose, b: RectPose) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/**
 * Make `scene` hold exactly `specs`, outside its history: a node whose id stays keeps its identity, so the
 * selection on it survives a refresh. A frame is never picked, so hovering and clicking land on areas.
 */
export function syncAuditScene(scene: AuditScene, specs: readonly AuditNodeSpec[]): void {
  const wanted = new Set(specs.map((s) => s.id));
  scene.untracked(() => {
    const gone = [...scene.nodes.keys()].filter((id) => !wanted.has(id));
    if (gone.length > 0) scene.removeMany(gone);
    for (const spec of specs) {
      const node = scene.get(spec.id);
      if (!node) {
        scene.add({ id: spec.id, kind: 'mark', layer: spec.layer, pose: spec.pose, data: spec.data, ...(spec.layer === 'frames' ? { pickable: false } : {}) });
        continue;
      }
      if (!samePose(node.pose, spec.pose)) scene.setPose(spec.id, spec.pose);
      if (!deepEqual(node.data, spec.data)) scene.update(spec.id, { data: spec.data });
    }
  });
}

/** Set the live outline's opacity on every cell a live run holds. */
export function breathe(scene: AuditScene, ids: readonly NodeId[], pulse: number): void {
  scene.untracked(() => {
    for (const id of ids) {
      const node = scene.get(id);
      if (node?.data.kind === 'audit-cell' && node.data.pulse !== pulse) scene.update(id, { data: { ...node.data, pulse } });
    }
  });
}
