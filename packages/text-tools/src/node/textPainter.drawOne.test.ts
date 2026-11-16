/** `defaultDrawOne` over a `kit:text` node: what the default scene layer draws for one. */
import { beforeEach, describe, it, expect } from 'vitest';
import { defaultDrawOne, type SceneNode as Node } from '@weasel-js/core';
import type { TextDrawCommand } from '@weasel-js/renderer';
import { _resetShapePaintersForTests } from 'canvas/NodeShape';
import { withTextPainter } from '../testing/textPainter';

function node<TData>(data: TData): Node<TData, 'default', { x: number; y: number; width: number; height: number }> {
  return {
    id: 'n', kind: 'mark', layer: 'default', pose: { x: 0, y: 0, width: 0, height: 0 }, data, parent: null,
  } as Node<TData, 'default', { x: number; y: number; width: number; height: number }>;
}

const POSE = { x: 10, y: 20, width: 80, height: 40 };

beforeEach(() => _resetShapePaintersForTests());
withTextPainter();

describe('defaultDrawOne — kit:text', () => {
  it('text branch: forwards the pose box, and wraps nothing the style does not declare', () => {
    // `height` with the default verticalAlign ('top') resolves to a zero offset.
    const cmds = defaultDrawOne(
      node({ text: 'Hello', style: { fontFamily: 'sans-serif', fontSize: 20 } }),
      POSE,
    );
    expect(cmds).toHaveLength(1);
    const cmd = cmds[0] as TextDrawCommand;
    expect(cmd).toMatchObject({
      kind: 'text',
      x: 10,
      y: 20,
      align: 'left',
      maxWidth: Infinity,
      width: POSE.width,
      height: POSE.height,
      verticalAlign: undefined,
    });
  });

  it('text branch: the anchor does not move with fontSize', () => {
    // The painter once shifted `y` down by the font size, defaulting to 16
    // when the node carried no style. Anchoring on the box top makes the
    // command's origin a property of the *pose*, so a styled and an unstyled
    // node at the same pose start their first line box in the same place —
    // which is what `verticalAlign`'s `[y, y + height]` box assumes.
    const styled = defaultDrawOne(
      node({ text: 'Hello', style: { fontSize: 64 } }), POSE,
    )[0] as TextDrawCommand;
    const unstyled = defaultDrawOne(node({ text: 'Hello' }), POSE)[0] as TextDrawCommand;
    expect(unstyled.y).toBe(POSE.y);
    expect(styled.y).toBe(unstyled.y);
  });
});
