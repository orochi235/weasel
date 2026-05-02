import { describe, expect, it, vi } from 'vitest';
import { createTextLayer, type TextPose } from './textLayer';

interface Node {
  id: string;
  pose: TextPose;
}

function makeCtx() {
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const push = (op: string, ...args: unknown[]) => calls.push({ op, args });
  const ctx = {
    font: '',
    fillStyle: '',
    textBaseline: '',
    textAlign: '',
    save: () => push('save'),
    restore: () => push('restore'),
    fillText: (...args: unknown[]) => push('fillText', ...args),
    measureText: (s: string) => ({ width: (s as string).length * 10 }) as TextMetrics,
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

describe('createTextLayer', () => {
  it('has a default id and label', () => {
    const layer = createTextLayer<Node>({ getTexts: () => [], getPose: (n) => n.pose });
    expect(layer.id).toBe('text');
    expect(layer.label).toBe('Text');
  });

  it('renders one fillText per wrapped line', () => {
    const nodes: Node[] = [
      { id: 'a', pose: { x: 0, y: 0, width: 100, height: 100, text: 'the quick brown' } },
    ];
    const layer = createTextLayer<Node>({ getTexts: () => nodes, getPose: (n) => n.pose });
    const { ctx, calls } = makeCtx();
    layer.draw(ctx, undefined);
    const fills = calls.filter((c) => c.op === 'fillText');
    expect(fills.map((c) => c.args[0])).toEqual(['the quick', 'brown']);
  });

  it('skips nodes flagged hidden', () => {
    const nodes: Node[] = [
      { id: 'a', pose: { x: 0, y: 0, width: 100, height: 20, text: 'A' } },
      { id: 'b', pose: { x: 0, y: 0, width: 100, height: 20, text: 'B' } },
    ];
    const layer = createTextLayer<Node>({
      getTexts: () => nodes,
      getPose: (n) => n.pose,
      isHidden: (n) => n.id === 'a',
    });
    const { ctx, calls } = makeCtx();
    layer.draw(ctx, undefined);
    const texts = calls.filter((c) => c.op === 'fillText').map((c) => c.args[0]);
    expect(texts).toEqual(['B']);
  });

  it('anchors x to left/center/right based on align', () => {
    const make = (align: 'left' | 'center' | 'right') => ({
      id: align,
      pose: { x: 100, y: 0, width: 200, height: 20, text: 'hi', style: { align } },
    });
    const cases: Array<['left' | 'center' | 'right', number]> = [
      ['left', 100],
      ['center', 200],
      ['right', 300],
    ];
    for (const [align, expectedX] of cases) {
      const layer = createTextLayer<Node>({
        getTexts: () => [make(align)],
        getPose: (n) => n.pose,
      });
      const { ctx, calls } = makeCtx();
      layer.draw(ctx, undefined);
      const fill = calls.find((c) => c.op === 'fillText');
      expect(fill?.args[1]).toBe(expectedX);
    }
  });

  it('applies a solid fill via Paint', () => {
    const node: Node = {
      id: 'a',
      pose: {
        x: 0,
        y: 0,
        width: 100,
        height: 20,
        text: 'hi',
        style: { fill: { kind: 'solid', color: '#abcdef' } },
      },
    };
    const layer = createTextLayer<Node>({ getTexts: () => [node], getPose: (n) => n.pose });
    const { ctx } = makeCtx();
    layer.draw(ctx, undefined);
    expect(ctx.fillStyle).toBe('#abcdef');
  });

  it('reads texts each draw (no caching)', () => {
    const getTexts = vi.fn(() => [] as Node[]);
    const layer = createTextLayer<Node>({ getTexts, getPose: (n) => n.pose });
    const { ctx } = makeCtx();
    layer.draw(ctx, undefined);
    layer.draw(ctx, undefined);
    expect(getTexts).toHaveBeenCalledTimes(2);
  });
});
