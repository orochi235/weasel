import { describe, expect, it } from 'vitest';
import { createTextLayer, type TextPose } from './textLayer';

interface Node {
  id: string;
  pose: TextPose;
}

const DIMS = { width: 800, height: 600 };

describe('createTextLayer', () => {
  it('has a default id and label', () => {
    const layer = createTextLayer<Node>({ getTexts: () => [], getPose: (n) => n.pose });
    expect(layer.id).toBe('text');
    expect(layer.label).toBe('Text');
  });

  it('emits one text command per visible node, wrapped in a world-transform group', () => {
    const layer = createTextLayer<Node>({
      getTexts: () => [{ id: 'n', pose: { x: 100, y: 200, width: 300, height: 50, text: 'hello' } }],
      getPose: (n) => n.pose,
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, DIMS);
    expect(tree).toHaveLength(1);
    expect(tree[0].kind).toBe('group');
    const group = tree[0] as { kind: 'group'; children: { kind: string; text?: string }[] };
    expect(group.children).toHaveLength(1);
    expect(group.children[0]).toMatchObject({ kind: 'text', text: 'hello' });
  });

  it('skips hidden nodes', () => {
    const layer = createTextLayer<Node>({
      getTexts: () => [
        { id: 'a', pose: { x: 0, y: 0, width: 100, height: 20, text: 'A' } },
        { id: 'b', pose: { x: 0, y: 0, width: 100, height: 20, text: 'B' } },
      ],
      getPose: (n) => n.pose,
      isHidden: (n) => n.id === 'a',
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 });
    const group = tree[0] as { children: { kind: string; text?: string }[] };
    expect(group.children).toHaveLength(1);
    expect(group.children[0]).toMatchObject({ text: 'B' });
  });
});
