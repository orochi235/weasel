/** A text node's glyphs as its outline: what `kit:text` answers for `NodeShapeEntry.outline`. */
import { boundsOfPath, type Path, type PathInWorldPose, type Rect } from '@weasel-js/geom';
import { pathIntersect } from '@weasel-js/geom/booleans';
import {
  loadTextOutlines, textToPath, textToPathsByPaint, TextOutlinesError, type TextOutlineSource,
} from '@weasel-js/text';
import type { TextNodeData } from './textPainter';
import { NodeOutlineError, strokeCovers, withInheritedPaint, type InheritedPaint, type NodeOutline } from '@weasel-js/core';

/** `d`'s glyphs laid in `box`, the box its padding insets, wearing its paint with `inherited`'s resolved. */
export function textOutlineOf(d: TextNodeData, box: PathInWorldPose, inherited?: InheritedPaint): NodeOutline {
  const { text, runs, style, verticalAlign, fit, fill, stroke } = withInheritedPaint(d, inherited);
  const data: TextOutlineSource = { text, runs, style, verticalAlign, fit, fill, stroke };
  return {
    stroked: strokeCovers(stroke) || !!runs?.some((r) => strokeCovers(r.stroke)),
    path: () => outlined(() => textToPath(data, box)),
    parts: () => outlined(() => textToPathsByPaint(data, box)),
    load: () => loadTextOutlines(data),
  };
}

/** `outline` cut to `clip`, a world-space path whose bounds are `box`: what a clipped text node draws. */
export function clippedOutline(outline: NodeOutline, clip: Path, box: Rect): NodeOutline {
  const cut = (path: Path): Path => (inside(boundsOfPath(path), box) ? path : pathIntersect(path, clip));
  return {
    stroked: outline.stroked,
    path: () => cut(outline.path()),
    parts: () => outline.parts().map((p) => ({ ...p, path: cut(p.path) })).filter((p) => !emptyPath(p.path)),
    load: () => outline.load(),
  };
}

const inside = (b: Rect, box: Rect): boolean =>
  b.x >= box.x && b.y >= box.y && b.x + b.width <= box.x + box.width && b.y + b.height <= box.y + box.height;

const emptyPath = (p: Path): boolean => p.kind !== 'rect' && 'commands' in p && p.commands.length === 0;

function outlined<T>(build: () => T): T {
  try {
    return build();
  } catch (err) {
    if (!(err instanceof TextOutlinesError)) throw err;
    throw new NodeOutlineError(err.message, {
      summary: `Text in "${err.family}" can't be converted to outlines`,
      pending: err.reason === 'outlines-loading',
      cause: err,
    });
  }
}
