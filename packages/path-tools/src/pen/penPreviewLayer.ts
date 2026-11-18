/**
 * Screen-space preview layer for `usePenTool`. Reads the pen's state each
 * frame and renders the in-progress path: finished
 * subpaths (faded), the current subpath (bright + anchor dots + handles),
 * a rubber-band segment from the latest anchor to the cursor, and a
 * close-hint ring on the first anchor when the tool flags it as hot.
 *
 * Runs in screen space so anchor/handle sizes stay constant under zoom.
 * All world-space coords go through `viewWorldToScreen` with the layer's `view`
 * argument.
 */

import type { DrawCommand } from '@weasel-js/renderer';
import type { RenderLayer } from '@weasel-js/core';
import type { KitSettingsStore } from '@weasel-js/react';
import type { PenScratch, PenDraftAnchor, PenSubpath } from './usePenTool';
import { PATH_C, PATH_L, PATH_M, type PolygonPath, anchorsToPath, circlePath, viewWorldToScreen } from '@weasel-js/geom';

/** Appearance of the pen tool's in-progress path. */
export interface PenPreviewStyle {
  anchorFill?: string;
  anchorStroke?: string;
  handleStroke?: string;
  rubberBandStroke?: string;
  closeHintFill?: string;
  finishedSubpathStroke?: string;
}

/** Options for `createPenPreviewLayer`. */
export interface CreatePenPreviewLayerOptions {
  /** The pen's state. One object for the pen's life, changed in place, so
   *  the layer reads the same one on every frame. */
  state: PenScratch;
  style?: PenPreviewStyle;
  /** The kit settings whose `targets.pen*RadiusPx` size the dots, read each frame. */
  kitSettings?: () => KitSettingsStore;
}

const DEFAULT_STYLE: Required<PenPreviewStyle> = {
  anchorFill: '#d4c4a8',
  anchorStroke: '#d4c4a8',
  handleStroke: '#d4c4a8',
  rubberBandStroke: '#d4c4a8',
  closeHintFill: '#d4c4a8',
  finishedSubpathStroke: '#8a7a5e',
};

export const ANCHOR_RADIUS_PX = 4;
export const HANDLE_DOT_RADIUS_PX = 3;
export const CLOSE_HINT_RADIUS_PX = 8;

/** How near the pen's first anchor, in screen px, a click closes the subpath. */
export const PEN_CLOSE_HIT_PX = 8;

/** The pen's reach in screen px: its own option, else the kit setting, else the constant. */
export const penReachOf = (o: { closeHitRadius?: number; kitSettings?: KitSettingsStore }) => ({
  close: o.closeHitRadius ?? o.kitSettings?.get('targets.penCloseHitPx') ?? PEN_CLOSE_HIT_PX,
});

const radiiOf = (kit: KitSettingsStore | undefined) => ({
  anchor: kit?.get('targets.penAnchorRadiusPx') ?? ANCHOR_RADIUS_PX,
  handleDot: kit?.get('targets.penHandleDotRadiusPx') ?? HANDLE_DOT_RADIUS_PX,
  closeHint: kit?.get('targets.penCloseHintRadiusPx') ?? CLOSE_HINT_RADIUS_PX,
});

type View = { x: number; y: number; scale: { x: number; y: number } };
type Point = { x: number; y: number };
type Style = Required<PenPreviewStyle>;
type Radii = ReturnType<typeof radiiOf>;

/** A pen subpath as a screen-space `PolygonPath`, segmented by the same rule
 *  the pen commits with. */
function subpathToPath(sp: PenSubpath, view: View): PolygonPath | null {
  if (sp.anchors.length === 0) return null;
  const pt = (p: Point) => {
    const { x: x, y: y } = viewWorldToScreen(view, p);
    return { x, y };
  };
  const anchors = sp.anchors.map((a: PenDraftAnchor) => ({
    ...pt(a),
    ...(a.inHandle ? { inHandle: pt(a.inHandle) } : {}),
    ...(a.outHandle ? { outHandle: pt(a.outHandle) } : {}),
  }));
  return anchorsToPath([anchors], [sp.closed]);
}

function segmentPath(ax: number, ay: number, bx: number, by: number): PolygonPath {
  return {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L]),
    coords: new Float32Array([ax, ay, bx, by]),
    fillRule: 'nonzero',
  };
}

function strokedPath(path: PolygonPath, color: string): DrawCommand {
  return { kind: 'path', path, stroke: { paint: { kind: 'solid', color }, width: 1 } };
}

function subpathOutline(sp: PenSubpath, view: View, color: string): DrawCommand | null {
  const path = subpathToPath(sp, view);
  return path === null ? null : strokedPath(path, color);
}

/** The segment from the latest anchor to the cursor: a curve through its
 *  out-handle when it has one, else a line. */
function rubberBand(last: PenDraftAnchor, cursor: Point, view: View, color: string): DrawCommand {
  const { x: sx, y: sy } = viewWorldToScreen(view, last);
  const { x: cx, y: cy } = viewWorldToScreen(view, cursor);
  if (!last.outHandle) return strokedPath(segmentPath(sx, sy, cx, cy), color);
  const { x: c1x, y: c1y } = viewWorldToScreen(view, last.outHandle);
  return strokedPath({
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_C]),
    coords: new Float32Array([sx, sy, c1x, c1y, cx, cy, cx, cy]),
    fillRule: 'nonzero',
  }, color);
}

/** A handle's line from its anchor at screen (ax, ay), and its dot. */
function handleMarks(ax: number, ay: number, handle: Point, view: View, r: number, color: string): DrawCommand[] {
  const { x: hx, y: hy } = viewWorldToScreen(view, handle);
  return [
    strokedPath(segmentPath(ax, ay, hx, hy), color),
    { kind: 'path', path: circlePath(hx, hy, r), fill: { paint: { kind: 'solid', color } } },
  ];
}

/** A dot on every anchor of the current subpath, and the latest anchor's handles. */
function anchorMarks(anchors: PenDraftAnchor[], view: View, r: Radii, style: Style): DrawCommand[] {
  const out: DrawCommand[] = [];
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    const { x: ax, y: ay } = viewWorldToScreen(view, a);
    out.push({
      kind: 'path',
      path: circlePath(ax, ay, r.anchor),
      fill: { paint: { kind: 'solid', color: style.anchorFill } },
      stroke: { paint: { kind: 'solid', color: style.anchorStroke }, width: 1 },
    });
    if (i === anchors.length - 1 && a.outHandle) {
      out.push(...handleMarks(ax, ay, a.outHandle, view, r.handleDot, style.handleStroke));
      if (a.inHandle) out.push(...handleMarks(ax, ay, a.inHandle, view, r.handleDot, style.handleStroke));
    }
  }
  return out;
}

function closeHint(first: PenDraftAnchor, view: View, r: number, color: string): DrawCommand {
  const { x: fx, y: fy } = viewWorldToScreen(view, first);
  return {
    kind: 'path',
    path: circlePath(fx, fy, r),
    stroke: { paint: { kind: 'solid', color }, width: 1.5 },
  };
}

/** The draw commands for the pen's state `s`, finished subpaths first. */
function penPreviewCommands(s: PenScratch, view: View, r: Radii, style: Style): DrawCommand[] {
  const out: DrawCommand[] = [];
  for (const sp of s.finishedSubpaths) {
    const cmd = subpathOutline(sp, view, style.finishedSubpathStroke);
    if (cmd) out.push(cmd);
  }
  const cur = s.current;
  if (!cur) return out;
  const outline = subpathOutline(cur, view, style.rubberBandStroke);
  if (outline) out.push(outline);
  if (cur.anchors.length > 0 && s.cursor && s.draggingHandleAt === null) {
    out.push(rubberBand(cur.anchors[cur.anchors.length - 1], s.cursor, view, style.rubberBandStroke));
  }
  out.push(...anchorMarks(cur.anchors, view, r, style));
  if (s.closeHintActive && cur.anchors.length >= 3) {
    out.push(closeHint(cur.anchors[0], view, r.closeHint, style.closeHintFill));
  }
  return out;
}

/** Render layer that draws the pen tool's path as it is being placed —
 *  committed anchors, the rubber band to the cursor, and the close hint. Draws
 *  nothing when the pen is idle. */
export function createPenPreviewLayer(
  opts: CreatePenPreviewLayerOptions,
): RenderLayer<unknown> {
  const style = { ...DEFAULT_STYLE, ...(opts.style ?? {}) };
  return {
    id: 'penPreview',
    label: 'Pen preview',
    space: 'screen',
    draw: (_data, view) => penPreviewCommands(opts.state, view, radiiOf(opts.kitSettings?.()), style),
  };
}
