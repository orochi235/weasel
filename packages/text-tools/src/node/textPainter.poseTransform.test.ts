/** A pose's `transform` reaches `kit:text`: it paints in its box, and the node wrap stretches it. */
import { beforeEach, describe, expect, it } from 'vitest';
import type { GroupDrawCommand } from '@weasel-js/renderer';
import { findNodeShape, type RectPose } from '@weasel-js/core';
import { _resetShapePaintersForTests } from 'canvas/NodeShape';
import { wrapNodeOutput } from 'canvas/wrapNodeOutput';
import { withTextPainter } from '../testing/textPainter';

beforeEach(() => _resetShapePaintersForTests());
withTextPainter();

describe('kit:text under a pose transform', () => {
  // The svg import of `<text transform="scale(4 1)" font-size="10">`: box and
  // font doubled, the transform carrying the rest.
  const pose: RectPose = { x: 40, y: -6, width: 80, height: 24, transform: [2, 0, 0, 0.5] };

  it('paints in its box, and the node wrap stretches it four to one', () => {
    const node = { id: 'n', kind: 'mark', layer: 'main', pose, data: { text: 'Hi', style: { fontSize: 20 } } };
    const painter = findNodeShape(node as never)!;
    expect(painter.id).toBe('kit:text');
    const own = painter.paint(node as never, pose as never);
    const plain = painter.paint({ ...node, pose: { ...pose, transform: undefined } } as never, { ...pose, transform: undefined } as never);
    expect(own).toEqual(plain);
    const out = wrapNodeOutput(own, pose, 1);
    expect(own.length).toBeGreaterThan(0);
    const m = Array.from((out[0] as GroupDrawCommand).transform!);
    // Box corners (40, -6) and (120, 18) land on (0, 0) and (160, 12).
    expect([m[0] * 40 + m[3] * -6 + m[6], m[1] * 40 + m[4] * -6 + m[7]]).toEqual([0, 0]);
    expect([m[0] * 120 + m[3] * 18 + m[6], m[1] * 120 + m[4] * 18 + m[7]]).toEqual([160, 12]);
  });
});
