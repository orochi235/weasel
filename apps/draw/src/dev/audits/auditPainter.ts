/** How the audit map's nodes paint: an area's cell, and the frame of the package holding it. */
import { resolvePaintPattern, textCommandFromRuns, type DrawCommand, type NodeShapeEntry, type PosedPaint, type RectPose } from '@weasel-js/core';
import { circlePath, type Path } from '@weasel-js/geom';

export interface AuditCellData {
  readonly kind: 'audit-cell';
  readonly fill: PosedPaint;
  /** Drawn over `fill`: the hatch on ground nobody has audited. */
  readonly over?: PosedPaint;
  readonly edge: string;
  readonly ink: string;
  readonly label?: string;
  /** How far a live run has taken it, under the label. */
  readonly stage?: string;
  /** The outline's color while a live run holds it. */
  readonly live?: string;
  /** Its queue place, in the cell's corner. */
  readonly queue?: number;
  /** One per pass, up to four. */
  readonly dots: number;
  /** The live outline's opacity, which the page breathes. */
  readonly pulse: number;
}

export interface AuditFrameData {
  readonly kind: 'audit-frame';
  readonly edge: string;
  readonly ink: string;
  readonly title?: string;
}

export type AuditNodeData = AuditCellData | AuditFrameData;

const rect = (p: RectPose, by = 0): Path => ({ kind: 'rect', x: p.x + by, y: p.y + by, width: Math.max(0, p.width - 2 * by), height: Math.max(0, p.height - 2 * by) });

const text = (x: number, y: number, s: string, color: string, size: number, weight = 400): DrawCommand =>
  textCommandFromRuns(x, y, [{ text: s, fill: { paint: { color } } }], { fontFamily: 'sans-serif', fontSize: size, fontWeight: weight });

/** The width `n` digits take at `size`, roughly: enough to set a number against the right edge. */
const digitsWidth = (n: number, size: number) => String(n).length * size * 0.62;

function filled(path: Path, paint: PosedPaint): DrawCommand[] {
  const resolved = resolvePaintPattern(paint);
  return resolved ? [{ kind: 'path', path, fill: { paint: resolved } }] : [];
}

function paintCell(d: AuditCellData, p: RectPose): DrawCommand[] {
  const out: DrawCommand[] = [
    ...filled(rect(p), d.fill),
    ...(d.over ? filled(rect(p), d.over) : []),
    { kind: 'path', path: rect(p), stroke: { paint: { color: d.edge }, width: 0.5 } },
  ];
  if (d.live) out.push({ kind: 'path', path: rect(p, 1.5), stroke: { paint: { color: d.live, opacity: d.pulse }, width: 2.5 } });
  if (d.dots > 0 && p.width >= 14 && p.height >= 10) {
    for (let i = 0; i < Math.min(d.dots, 4); i++) {
      out.push({ kind: 'path', path: circlePath(p.x + p.width - 5 - i * 6, p.y + 5, 2, 12), fill: { paint: { color: d.ink, opacity: 0.85 } } });
    }
  }
  if (d.label) out.push(text(p.x + 4, p.y + 14, d.label, d.ink, 10));
  if (d.stage && d.live) out.push(text(p.x + 4, p.y + 27, d.stage, d.live, 9.5, 500));
  if (d.queue !== undefined) out.push(text(p.x + p.width - 4 - digitsWidth(d.queue, 11), p.y + p.height - 4, String(d.queue), d.ink, 11, 800));
  return out;
}

function paintFrame(d: AuditFrameData, p: RectPose): DrawCommand[] {
  const out: DrawCommand[] = [{ kind: 'path', path: rect(p), stroke: { paint: { color: d.edge, opacity: 0.55 }, width: 1 } }];
  if (d.title) out.push(text(p.x + 4, p.y + 11, d.title, d.ink, 10.5, 700));
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
  silhouette: (_node, p) => rect(p),
  bounds: (_node, p) => ({ x: p.x - 2, y: p.y - 2, width: p.width + 4, height: p.height + 4 }),
};
