import { describe, expect, it } from 'vitest';
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
});
