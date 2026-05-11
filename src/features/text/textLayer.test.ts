import { describe, expect, it } from 'vitest';
import { createTextLayer, type TextPose } from './textLayer';
import type { StyledRun } from './runs';

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

  it('emits one TextDrawCommand per visible node with resolved runs', () => {
    const layer = createTextLayer<Node>({
      getTexts: () => [{ id: 'n', pose: { x: 100, y: 200, width: 300, height: 50, text: 'hello' } }],
      getPose: (n) => n.pose,
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, DIMS);
    expect(tree).toHaveLength(1);
    const group = tree[0] as unknown as { kind: 'group'; children: Array<Record<string, unknown>> };
    expect(group.kind).toBe('group');
    expect(group.children).toHaveLength(1);
    const cmd = group.children[0] as {
      kind: string;
      x: number;
      y: number;
      runs: Array<{ text: string; fontWeight: number; fontStyle: string }>;
      maxWidth: number;
      align: string;
    };
    expect(cmd.kind).toBe('text');
    expect(cmd.x).toBe(100);
    expect(cmd.y).toBe(200);
    expect(cmd.maxWidth).toBe(300);
    expect(cmd.runs).toHaveLength(1);
    expect(cmd.runs[0].text).toBe('hello');
    expect(cmd.runs[0].fontWeight).toBe(400);
  });

  it('emits resolved runs for a rich-text node', () => {
    const runs: StyledRun[] = [{ text: 'a ' }, { text: 'b', bold: true }];
    const layer = createTextLayer<Node>({
      getTexts: () => [{
        id: 'n',
        pose: { x: 0, y: 0, width: 200, height: 40, text: 'a b', runs },
      }],
      getPose: (n) => n.pose,
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, DIMS);
    const cmd = (tree[0] as { children: Array<{ runs: Array<{ text: string; fontWeight: number }> }> }).children[0];
    expect(cmd.runs.map((r) => r.text)).toEqual(['a ', 'b']);
    expect(cmd.runs.map((r) => r.fontWeight)).toEqual([400, 700]);
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
    const group = tree[0] as { children: Array<{ runs: Array<{ text: string }> }> };
    expect(group.children).toHaveLength(1);
    expect(group.children[0].runs[0].text).toBe('B');
  });

  it('throws when runs are present but runsToPlainText(runs) !== text', () => {
    const layer = createTextLayer<Node>({
      getTexts: () => [{
        id: 'bad',
        pose: {
          x: 0, y: 0, width: 200, height: 40,
          text: 'a b',
          runs: [{ text: 'WRONG' }],
        },
      }],
      getPose: (n) => n.pose,
    });
    expect(() => layer.draw(undefined, { x: 0, y: 0, scale: 1 }, DIMS)).toThrow(/invariant/i);
  });
});
