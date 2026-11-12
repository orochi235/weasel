import {
  type DrawCommand,
  isSolidPaint,
  type MarkerRef,
  type Paint,
  resolveScreenLength,
  type Stroke,
  type View,
} from '@weasel-js/core';
import type { SvgNode, SvgPaint, SvgStroke } from '@weasel-js/svg';
import { type MarkStyle, markCommands, type PaintableMark } from './paint';

const NO_PAINT: SvgPaint = { kind: 'none' };

function toSvgPaint(paint: Paint | undefined): SvgPaint {
  if (!paint) return NO_PAINT;
  if (isSolidPaint(paint)) {
    return {
      kind: 'solid',
      color: paint.color,
      ...(paint.opacity != null ? { opacity: paint.opacity } : {}),
    };
  }
  return { kind: 'gradient', paint };
}

/** A marker with its `{ px }` size in the export's user units, which have no camera to hold a screen size through. */
function exportedMarker(ref: MarkerRef, scale: number): MarkerRef {
  if (typeof ref === 'string' || ref.size === undefined) return ref;
  return { ...ref, size: resolveScreenLength(ref.size, scale) };
}

/** `scale` is output pixels per user unit: what a `{ px }` length is written against. */
function toSvgStroke(stroke: Stroke, scale: number): SvgStroke {
  return {
    paint: toSvgPaint(stroke.paint),
    width: resolveScreenLength(stroke.width ?? 1, scale),
    ...(stroke.cap ? { cap: stroke.cap } : {}),
    ...(stroke.join ? { join: stroke.join } : {}),
    ...(stroke.dash ? { dash: [...stroke.dash] } : {}),
    ...(stroke.miterLimit != null ? { miterLimit: stroke.miterLimit } : {}),
    ...(stroke.align ? { align: stroke.align } : {}),
    ...(stroke.markerStart ? { markerStart: exportedMarker(stroke.markerStart, scale) } : {}),
    ...(stroke.markerMid ? { markerMid: exportedMarker(stroke.markerMid, scale) } : {}),
    ...(stroke.markerEnd ? { markerEnd: exportedMarker(stroke.markerEnd, scale) } : {}),
  };
}

function toSvgNode(cmd: DrawCommand, m: PaintableMark, scale: number): SvgNode {
  if (cmd.kind === 'path') {
    return {
      kind: 'path',
      path: cmd.path,
      fill: toSvgPaint(cmd.fill?.paint),
      ...(cmd.stroke ? { stroke: toSvgStroke(cmd.stroke, scale) } : {}),
    };
  }
  if (cmd.kind === 'text') {
    return {
      kind: 'text',
      x: cmd.x,
      y: cmd.y,
      width: m.pose.width,
      height: m.pose.height,
      text: cmd.runs.map((run) => run.text).join(''),
      style: cmd.style,
      ...(cmd.runs[0]?.fill ? { fill: cmd.runs[0].fill } : {}),
    };
  }
  // Unreachable while `markCommands` emits only paths and text. A throw rather
  // than a skip: a new mark kind silently vanishing from every export is a
  // worse afternoon than a loud one.
  throw new Error(`[labkit] a mark drew a '${cmd.kind}' command, which has no vector form`);
}

/**
 * One mark as SVG nodes, converted from the very commands the pane paints.
 *
 * Deliberately not a second switch over `data.kind`: geometry has one source,
 * and this is a translation of it. `serializeSvg` turns the result into a
 * document.
 */
export function markSvgNodes(
  m: PaintableMark,
  style: MarkStyle = {},
  scale?: View['scale'],
): SvgNode[] {
  return markCommands(m, style, scale).map((cmd) => toSvgNode(cmd, m, scale?.x ?? 1));
}
