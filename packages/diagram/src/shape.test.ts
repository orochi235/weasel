import { describe, expect, it } from 'vitest';
import { rectPath } from '@weasel-js/core';
import { registerOutline } from './outline';
import { diagramScene, DEFAULT_NODE_STYLE, type DiagramData } from './fromData';
import { diagramShape } from './shape';

type PathCmd = { kind: 'path'; fill?: { paint: { color?: string } }; stroke?: { paint: { color?: string } } };

const POSE = { x: 0, y: 0, width: 40, height: 20 };
const node = (data: Record<string, unknown>) =>
  ({ id: 'n', kind: 'mark', data: { diagram: { outline: 'rect' }, ...data } }) as never;
const outlineOf = (data: Record<string, unknown>) => diagramShape().paint(node(data), POSE as never)[0] as PathCmd;

describe('diagramShape', () => {
  it('paints no fill or stroke for an outline whose data names none', () => {
    expect(outlineOf({})).not.toHaveProperty('fill');
    expect(outlineOf({})).not.toHaveProperty('stroke');
    expect(outlineOf({ fill: {}, stroke: null })).not.toHaveProperty('fill');
  });

  it('paints the default fill and stroke diagramScene writes onto each node', () => {
    const data: DiagramData = { nodes: [{ id: 'a', lines: ['A'], at: { x: 0, y: 0 } }], edges: [] };
    const spec = diagramScene(data, { layout: 'none', font: { fontFamily: 'sans-serif', fontSize: 10 } })
      .find((s) => s.id === ('a' as never))!;
    const cmd = diagramShape().paint(spec as never, spec.pose as never)[0] as PathCmd;
    expect(cmd.fill?.paint.color).toBe(DEFAULT_NODE_STYLE.fill);
    expect(cmd.stroke?.paint.color).toBe(DEFAULT_NODE_STYLE.stroke);
  });

  it('strokes an outline\'s detail after it, with the node\'s stroke and no fill', () => {
    const dispose = registerOutline('test:rimmed', {
      path: (b) => rectPath(b.x, b.y, b.width, b.height),
      detail: (b) => rectPath(b.x + 2, b.y + 2, 4, 4),
    });
    const data = { diagram: { outline: 'test:rimmed' }, fill: { paint: { kind: 'solid', color: '#fff' } }, stroke: { paint: { kind: 'solid', color: '#123' }, width: 1 } };
    const cmds = diagramShape().paint({ id: 'n', kind: 'mark', data } as never, POSE as never) as Array<PathCmd & { path: unknown }>;
    expect(cmds).toHaveLength(2);
    expect(cmds[1]!.path).toEqual(rectPath(2, 2, 4, 4));
    expect(cmds[1]).not.toHaveProperty('fill');
    expect(cmds[1]!.stroke).toEqual(cmds[0]!.stroke);
    dispose();
  });

  it('paints no detail when the node has no stroke', () => {
    const dispose = registerOutline('test:rimmed2', {
      path: (b) => rectPath(b.x, b.y, b.width, b.height),
      detail: (b) => rectPath(b.x + 2, b.y + 2, 4, 4),
    });
    const cmds = diagramShape().paint({ id: 'n', kind: 'mark', data: { diagram: { outline: 'test:rimmed2' } } } as never, POSE as never);
    expect(cmds).toHaveLength(1);
    dispose();
  });
});
