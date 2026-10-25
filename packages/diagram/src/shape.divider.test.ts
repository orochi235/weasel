import { describe, expect, it } from 'vitest';
import { polylineFromPoints } from '@weasel-js/core';
import { DIVIDER_HEIGHT } from './body';
import { diagramScene, type DiagramData } from './fromData';
import { diagramShape } from './shape';

type Cmd = { kind: 'path'; path: unknown; fill?: unknown; stroke?: unknown };

const DATA: DiagramData = {
  nodes: [{
    id: 'c', at: { x: 0, y: 0 }, width: 120, padding: 8, gap: 4, verticalAlign: 'top',
    rows: [{ kind: 'label', text: 'Name' }, { kind: 'divider' }, { kind: 'label', text: 'x' }, { kind: 'divider', inset: 10 }],
  }],
  edges: [],
};
const FONT = { fontFamily: 'sans-serif', fontSize: 10 };

function body(data = DATA) {
  return diagramScene(data, { layout: 'none', font: FONT }).find((s) => s.id === ('c' as never))!;
}

describe('a body with divider rows', () => {
  it('strokes one rule per divider through the middle of its row, in the body\'s stroke and no fill', () => {
    const spec = body();
    const pose = spec.pose as { x: number; y: number; width: number; height: number };
    const cmds = diagramShape().paint(spec as never, pose as never) as Cmd[];
    expect(cmds).toHaveLength(3);
    const line = 14;
    const first = pose.y + 8 + line + 4 + DIVIDER_HEIGHT / 2;
    const second = first + DIVIDER_HEIGHT / 2 + 4 + line + 4 + DIVIDER_HEIGHT / 2;
    expect(cmds[1]!.path).toEqual(polylineFromPoints([{ x: pose.x, y: first }, { x: pose.x + pose.width, y: first }]));
    expect(cmds[2]!.path).toEqual(polylineFromPoints([{ x: pose.x + 10, y: second }, { x: pose.x + pose.width - 10, y: second }]));
    expect(cmds[1]!.stroke).toEqual(cmds[0]!.stroke);
    expect(cmds[1]).not.toHaveProperty('fill');
  });

  it('lays its rules out again at the size the body is drawn at', () => {
    const spec = body({ ...DATA, nodes: [{ ...DATA.nodes[0]!, verticalAlign: 'center' }] });
    const pose = spec.pose as { x: number; y: number; width: number; height: number };
    const at = (p: typeof pose) => (diagramShape().paint(spec as never, p as never) as Cmd[])[1]!.path;
    const taller = { ...pose, width: pose.width + 40, height: pose.height + 40 };
    const y = (pose.y + 20) + (pose.y + 8 + 14 + 4 + DIVIDER_HEIGHT / 2) - pose.y;
    expect(at(taller)).toEqual(polylineFromPoints([{ x: pose.x, y }, { x: pose.x + taller.width, y }]));
  });

  it('draws no rule for a body without a stroke', () => {
    const spec = body();
    const data = { ...(spec.data as object), stroke: null };
    expect(diagramShape().paint({ ...spec, data } as never, spec.pose as never)).toHaveLength(1);
  });
});
