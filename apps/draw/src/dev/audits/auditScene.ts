/** The audit map as a scene: a frame per package, a cell per area, kept in step with the map's data. */
import { asNodeId, contrastRatio, createScene, nodeShapesOf, type NodeId, type RectPose, type Scene } from '@weasel-js/core';
import { deepEqual } from '@weasel-js/registry';
import { AUDIT_PAINTER, type AuditCellData, type AuditFrameData, type AuditNodeData } from './auditPainter';
import { heatScaleOf, stageLabelOf, labelIn, toneOf, wrapAtDots, type HeatScale } from './areaData';
import { rampAt } from './heat';
import type { MapCell, MapFrame } from './mapLayout';
import type { AuditPhase } from './phases';
import type { AuditArea } from './skulkMap.types';

/** The colors the map paints in, read off the page's theme. */
export interface AuditPalette {
  readonly panel: string;
  /** A nested frame's title band. */
  readonly band: string;
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

export type AuditLayer = 'map';
export type AuditScene = Scene<AuditNodeData, AuditLayer, RectPose>;

/** An empty map, its painter registered with it. */
export function createAuditScene(): AuditScene {
  const scene = createScene<AuditNodeData, AuditLayer, RectPose>({ systemLayers: [{ id: 'map' }] });
  nodeShapesOf(scene).register(AUDIT_PAINTER);
  return scene;
}

/** A frame's node id; an area's is its own id. */
export const frameIdOf = (name: string): NodeId => asNodeId(`package:${name}`);

/**
 * One node of the map, posed in its parent's frame: a frame holding the frames and cells inside it, or an area's cell.
 * A frame is a mark that holds children rather than a group, because a press on a group's child selects the group
 * until it is entered, and a click here has to land on the area.
 */
export interface AuditNodeSpec {
  readonly id: NodeId;
  readonly parent: NodeId | null;
  readonly pickable: boolean;
  readonly pose: RectPose;
  readonly data: AuditNodeData;
}

type Box = { x: number; y: number; width: number; height: number };

/** `b` in the frame of `parent`'s box, or as it is at the top. */
const poseIn = (b: Box, parent: Box | undefined): RectPose =>
  ({ x: b.x - (parent?.x ?? 0), y: b.y - (parent?.y ?? 0), width: b.width, height: b.height });

/** A frame's title size: a top-level package's, and a smaller one inside it. */
const titleSizeOf = (depth: number) => (depth === 0 ? 12.5 : 11);

function frameTitle(f: MapFrame): string | undefined {
  if (!f.titled) return undefined;
  const own = f.parent ? labelIn(f.name, f.parent) : f.name.toUpperCase();
  const full = `${own} · ${f.files}`;
  const char = TITLE_CHAR * (titleSizeOf(f.depth) / 12.5);
  return full.length * char < f.width - 8 ? full : own.slice(0, Math.max(1, Math.floor((f.width - 8) / char)));
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
  return wrapAtDots(labelIn(area.id, cell.parent), Math.floor((cell.width - 8 - dotsRoom(area.passes.length)) / LABEL_CHAR), Math.max(1, Math.floor(room / LINE)));
}

function cellData(area: AuditArea, cell: MapCell, palette: AuditPalette, heat: HeatScale, phase: AuditPhase | undefined, lit: boolean): AuditCellData {
  const tone = toneOf(area);
  const fill = tone === 'settled' ? palette.settled : tone === 'unaudited' ? palette.uncharted : rampAt(palette.depth, heat.at(tone.left));
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
    ...(staged ? { stage: stageLabelOf(area.stage!), stageInk: inkOn(live ? (phase ? palette.phase[phase] : palette.live) : palette.live, palette) } : {}),
    ...(tone === 'unaudited' && labeled ? { backing: palette.uncharted } : {}),
    font: palette.font.ui,
    numericFont: palette.font.numeric,
    ...(showsQueue ? { queue: area.queue! } : {}),
    ...(tone === 'settled' ? { settled: true } : {}),
    dots: area.passes.length,
    ...(lit ? { glow: palette.live } : {}),
    pulse: 1,
  };
}

/** Every node the map needs for `areas` laid out as `frames` and `cells`, a live area outlined in its phase's color
 *  and the `lit` one glowing. */
export function auditNodeSpecs(
  areas: readonly AuditArea[],
  layout: { frames: readonly MapFrame[]; cells: readonly MapCell[] },
  palette: AuditPalette,
  phases: ReadonlyMap<string, AuditPhase> = new Map(),
  lit: string | null = null,
): AuditNodeSpec[] {
  const byId = new Map(areas.map((a) => [a.id, a]));
  const heat = heatScaleOf(areas);
  const frameBox = new Map(layout.frames.map((f) => [f.name, f]));
  const out: AuditNodeSpec[] = [];
  // Frames come in the order the layout made them, each after its parent; cells after every frame.
  for (const f of layout.frames) {
    const parent = f.parent === null ? undefined : frameBox.get(f.parent);
    const title = frameTitle(f);
    const band = f.depth === 0 ? palette.panel : palette.band;
    const data: AuditFrameData = {
      kind: 'audit-frame', edge: palette.ink, band, ink: inkOn(band, palette), font: palette.font.ui, size: titleSizeOf(f.depth), depth: f.depth, ...(title ? { title } : {}),
    };
    out.push({ id: frameIdOf(f.name), parent: f.parent === null ? null : frameIdOf(f.parent), pickable: false, pose: poseIn(f, parent), data });
  }
  for (const c of layout.cells) {
    const area = byId.get(c.id);
    if (!area) continue;
    const parent = c.parent === null ? undefined : frameBox.get(c.parent);
    out.push({
      id: asNodeId(c.id), parent: c.parent === null ? null : frameIdOf(c.parent), pickable: true,
      pose: poseIn(c, parent), data: cellData(area, c, palette, heat, phases.get(area.id), area.id === lit),
    });
  }
  return out;
}

const samePose = (a: RectPose, b: RectPose) => a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/**
 * Make `scene` hold exactly `specs`, outside its history: a node whose id stays keeps its identity, moved if its parent changed, so the
 * selection on it survives a refresh. A frame is never picked, so hovering and clicking land on areas.
 */
export function syncAuditScene(scene: AuditScene, specs: readonly AuditNodeSpec[]): void {
  const wanted = new Map(specs.map((s) => [s.id, s]));
  scene.untracked(() => {
    // Specs list a parent before its children, so a node's new parent is in place, under its own, when it moves.
    for (const spec of specs) {
      const node = scene.get(spec.id);
      if (!node) {
        scene.add({ id: spec.id, kind: 'mark', layer: 'map', parent: spec.parent, pose: spec.pose, data: spec.data, ...(spec.pickable ? {} : { pickable: false }) });
        continue;
      }
      if (node.parent !== spec.parent) scene.move(spec.id, spec.parent);
      if (!samePose(node.pose, spec.pose)) scene.setPose(spec.id, spec.pose);
      if (!deepEqual(node.data, spec.data)) scene.update(spec.id, { data: spec.data });
    }
    // Every node still wanted has moved out from under those going, so removing them takes nothing kept.
    const gone = [...scene.nodes.values()].filter((n) => !wanted.has(n.id)).map((n) => n.id);
    if (gone.length > 0) scene.removeMany(gone);
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
