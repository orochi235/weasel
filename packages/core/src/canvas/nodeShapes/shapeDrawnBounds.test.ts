import { describe, expect, it } from 'vitest';
import type { Stroke } from '@weasel-js/paint';
import type { NodeInkCtx } from 'canvas/NodeShape';
import type { RectPose } from 'core/scene/types';
import { SHAPE_PAINTER } from './shapePainter';
import { groupBoxDrawnBounds } from './groupBoxPainter';

const PAINT = { color: '#000' };
const BOX: RectPose = { x: 0, y: 0, width: 100, height: 60 };

const shapeBox = (shape: string, stroke: Stroke, ctx: NodeInkCtx = { scale: 1 }, pose = BOX) =>
  SHAPE_PAINTER.drawnBounds!({ data: { shape, stroke } } as never, pose, ctx)!;

describe('a group box border', () => {
  it('reaches as far as the same stroke on a rect shape, marker heads included', () => {
    const border: Stroke = { paint: PAINT, width: 2, markerMid: { key: 'dot', size: 6 } };
    const group = groupBoxDrawnBounds({ data: { border } }, BOX, { scale: 1 })!;
    const rect = shapeBox('rect', border);
    expect(rect.x).toBeLessThan(-1);
    expect(group).toEqual(rect);
  });
});
