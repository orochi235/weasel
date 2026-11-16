/** A text node's glyphs as its outline: what `kit:text` answers for `NodeShapeEntry.outline`. */
import type { PathInWorldPose } from '@weasel-js/geom';
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
