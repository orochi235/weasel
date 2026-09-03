import type { DrawCommand, FillStyle, Stroke } from '@weasel-js/core';
import { resolveStrokeWidth } from '@weasel-js/core';
import type { SvgNode, SvgPaint, SvgStroke } from '@weasel-js/svg';
import { type MarkStyle, markCommands, type PaintableMark } from './paint';

const NO_PAINT: SvgPaint = { kind: 'none' };

function toSvgPaint(paint: FillStyle | undefined): SvgPaint {
  if (!paint) return NO_PAINT;
  if ('color' in paint && typeof paint.color === 'string') {
    return {
      kind: 'solid',
      color: paint.color,
      ...(paint.opacity != null ? { opacity: paint.opacity } : {}),
    };
  }
  return { kind: 'gradient', paint };
}

/** Marker references are deliberately dropped: `markCommands` already resolves
 *  a marker into its own path command, and keeping the reference would make
 *  the serializer emit a `<marker>` def that draws the head a second time. */
function toSvgStroke(stroke: Stroke): SvgStroke {
  return {
    paint: toSvgPaint(stroke.paint),
    width: resolveStrokeWidth(stroke.width ?? 1, 1),
    ...(stroke.cap ? { cap: stroke.cap } : {}),
    ...(stroke.join ? { join: stroke.join } : {}),
    ...(stroke.dash ? { dash: [...stroke.dash] } : {}),
    ...(stroke.miterLimit != null ? { miterLimit: stroke.miterLimit } : {}),
  };
}

function toSvgNode(cmd: DrawCommand, m: PaintableMark): SvgNode {
  if (cmd.kind === 'path') {
    return {
      kind: 'path',
      path: cmd.path,
      fill: toSvgPaint(cmd.fill),
      ...(cmd.stroke ? { stroke: toSvgStroke(cmd.stroke) } : {}),
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
  content: { w: number; h: number },
  style: MarkStyle = {},
): SvgNode[] {
  return markCommands(m, content, style).map((cmd) => toSvgNode(cmd, m));
}
