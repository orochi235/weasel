/** How the audit map's nodes paint: an area's cell, and the frame of the package holding it. */
import { resolvePaintPattern, textCommandFromRuns, type DrawCommand, type NodeShapeEntry, type PosedPaint, type RectPose } from '@weasel-js/core';
import { circlePath, pathFromD, type Path } from '@weasel-js/geom';
import { framePadOf } from './mapLayout';

export interface AuditCellData {
  readonly kind: 'audit-cell';
  readonly fill: PosedPaint;
  /** Drawn over `fill`: the hatch on ground nobody has audited. */
  readonly over?: PosedPaint;
  readonly edge: string;
  readonly ink: string;
  /** Its name, a line each. */
  readonly label?: readonly string[];
  /** How far a live run has taken it, under the label. */
  readonly stage?: string;
  /** The outline's color while a live run holds it; the stage sits on a chip of it, in `stageInk`. */
  readonly live?: string;
  readonly stageInk?: string;
  /** A solid color its label lines sit on, where `over` would put a hatch under them. */
  readonly backing?: string;
  /** Its queue place, in the cell's corner. */
  readonly queue?: number;
  /** A check in its corner: no audit is due. */
  readonly settled?: boolean;
  /** One per pass, up to four. */
  readonly dots: number;
  /** A glow's color while something naming the area elsewhere on the page is hovered. */
  readonly glow?: string;
  /** The live outline's opacity, which the page breathes. */
  readonly pulse: number;
  /** The faces its words and its numbers are set in. */
  readonly font: string;
  readonly numericFont: string;
}

export interface AuditFrameData {
  readonly kind: 'audit-frame';
  readonly edge: string;
  /** The title band's fill, under the title so it never sits on a cell's color; `ink` is chosen to read on it. */
  readonly band: string;
  readonly ink: string;
  readonly title?: string;
  readonly font: string;
  /** The title's size, smaller for a frame inside another. */
  readonly size: number;
  /** 0 for a top-level package, which draws a firmer edge than the frames inside it. */
  readonly depth: number;
}

export type AuditNodeData = AuditCellData | AuditFrameData;

const rect = (p: RectPose, by = 0): Path => ({ kind: 'rect', x: p.x + by, y: p.y + by, width: Math.max(0, p.width - 2 * by), height: Math.max(0, p.height - 2 * by) });

/** `y` is the text's top: a text command is top-anchored by default. */
const text = (x: number, y: number, s: string, color: string, font: string, size: number, weight = 400): DrawCommand =>
  textCommandFromRuns(x, y, [{ text: s, fill: { paint: { color } } }], { fontFamily: font, fontSize: size, fontWeight: weight });

/** A label line's height. */
const LINE = 15;

/** A solid backing under `s` set at `size` from (x + 2, y + 1), so the text never sits on a hatch or a fill. Its
 *  width is estimated from Oswald's average character, with room to spare. */
const chip = (x: number, y: number, s: string, size: number, color: string): DrawCommand[] =>
  filled({ kind: 'rect', x, y, width: s.length * size * 0.52 + 4, height: size + 3 }, { color });

/** The width `n` digits take at `size`, roughly: enough to set a number against the right edge. */
const digitsWidth = (n: number, size: number) => String(n).length * size * 0.5;

function filled(path: Path, paint: PosedPaint): DrawCommand[] {
  const resolved = resolvePaintPattern(paint);
  return resolved ? [{ kind: 'path', path, fill: { paint: resolved } }] : [];
}

const GLOW = [[1.5, 1], [4.5, 0.5], [7.5, 0.22]] as const;

function paintCell(d: AuditCellData, p: RectPose): DrawCommand[] {
  const out: DrawCommand[] = [
    ...filled(rect(p), d.fill),
    ...(d.over ? filled(rect(p), d.over) : []),
    { kind: 'path', path: rect(p), stroke: { paint: { color: d.edge }, width: 0.5 } },
  ];
  if (d.live) out.push({ kind: 'path', path: rect(p, 1.5), stroke: { paint: { color: d.live, opacity: d.pulse }, width: 2.5 } });
  // Drawn inward, since a neighbor paints over anything outside the cell.
  if (d.glow) for (const [by, opacity] of GLOW) out.push({ kind: 'path', path: rect(p, by), stroke: { paint: { color: d.glow, opacity }, width: 3 } });
  if (d.settled && p.width >= 16 && p.height >= 16) {
    const x = p.x + p.width - 13, y = p.y + p.height - 12;
    const check = pathFromD(`M ${x} ${y + 4} L ${x + 3} ${y + 7} L ${x + 9} ${y}`);
    out.push({ kind: 'path', path: check, stroke: { paint: { color: d.ink, opacity: 0.8 }, width: 1.6 } });
  }
  if (d.dots > 0 && p.width >= 14 && p.height >= 10) {
    for (let i = 0; i < Math.min(d.dots, 4); i++) {
      out.push({ kind: 'path', path: circlePath(p.x + p.width - 5 - i * 6, p.y + 5, 2, 12), fill: { paint: { color: d.ink, opacity: 0.85 } } });
    }
  }
  const texts: DrawCommand[] = [];
  const lines = d.label ?? [];
  lines.forEach((line, i) => {
    const y = p.y + 3 + i * LINE;
    if (d.backing) texts.push(...chip(p.x + 2, y - 1, line, 12, d.backing));
    texts.push(text(p.x + 4, y, line, d.ink, d.font, 12));
  });
  if (d.stage && d.live) {
    const y = p.y + 4 + Math.max(1, lines.length) * LINE;
    texts.push(...chip(p.x + 2, y - 1, d.stage, 11.5, d.live), text(p.x + 4, y, d.stage, d.stageInk ?? d.ink, d.font, 11.5, 500));
  }
  if (d.queue !== undefined) texts.push(text(p.x + p.width - 4 - digitsWidth(d.queue, 13), p.y + p.height - 17, String(d.queue), d.ink, d.numericFont, 13, 700));
  // Label widths are estimated, not measured; the clip keeps a long one inside its own cell.
  if (texts.length > 0) out.push({ kind: 'group', clip: rect(p, 1), children: texts });
  return out;
}

function paintFrame(d: AuditFrameData, p: RectPose): DrawCommand[] {
  // Top and bottom edges only: side edges would stand between areas the layout lines up across frames.
  const edges = pathFromD(`M ${p.x} ${p.y + 0.5} H ${p.x + p.width} M ${p.x} ${p.y + p.height - 0.5} H ${p.x + p.width}`);
  const out: DrawCommand[] = [{ kind: 'path', path: edges, stroke: { paint: { color: d.edge, opacity: d.depth === 0 ? 0.55 : 0.3 }, width: 1 } }];
  if (d.title) {
    const room = framePadOf(d.depth).title;
    out.push(...filled(rect({ ...p, height: Math.min(p.height, room) }, 0.5), { color: d.band }));
    out.push({ kind: 'group', clip: rect({ ...p, height: Math.min(p.height, room) }, 1), children: [text(p.x + 4, p.y + 2, d.title, d.ink, d.font, d.size, d.depth === 0 ? 700 : 500)] });
  }
  return out;
}

const isAudit = (data: unknown): data is AuditNodeData => {
  const kind = (data as { kind?: unknown } | null)?.kind;
  return kind === 'audit-cell' || kind === 'audit-frame';
};

/** Claims the audit map's nodes; a cell picks by its whole box. */
export const AUDIT_PAINTER: NodeShapeEntry<AuditNodeData, RectPose> = {
  id: 'app:audit-map',
  matches: (node) => isAudit(node.data),
  paint: (node, pose) => (node.data.kind === 'audit-cell' ? paintCell(node.data, pose) : paintFrame(node.data, pose)),
  drawsLabel: true,
  silhouette: (_node, p) => rect(p),
  bounds: (_node, p) => ({ x: p.x - 2, y: p.y - 2, width: p.width + 4, height: p.height + 4 }),
};
