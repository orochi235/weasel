import { describe, expect, it } from 'vitest';
import { diagramScene, type DiagramData } from './fromData';
import { dataKeyReader } from './trait';
import { diagramMarkOf, markShape } from './marks';

const DATA: DiagramData = {
  nodes: [{
    id: 'a', lines: [], width: 40, height: 80, at: { x: 100, y: 200 },
    marks: [
      { d: 'M0 0.5 H1', stroke: '#fff' },
      { text: '0.5', at: { u: 0, v: 0.5 }, self: { u: 1, v: 0.5 }, offset: { x: -6, y: 0 } },
    ],
  }],
  edges: [],
};
const specs = diagramScene(DATA, { layout: 'none', font: { fontFamily: 'sans-serif', fontSize: 10 } });
const drawn = specs.find((s) => s.id === ('a/mark:0' as never))!;
const text = specs.find((s) => s.id === ('a/mark:1' as never))!;

describe('marks', () => {
  it('makes a drawn mark a child of its node, over the node\'s whole box', () => {
    expect(drawn.parent).toBe('a');
    expect(drawn.pickable).toBe(false);
    expect(drawn.pose).toEqual({ x: 100, y: 200, width: 40, height: 80 });
    expect(diagramMarkOf(drawn)).toEqual({ d: 'M0 0.5 H1' });
  });

  it('does not read a mark as a diagram participant', () => {
    expect(dataKeyReader({ id: 'a/mark:0', kind: 'leaf', data: drawn.data })).toBeNull();
  });

  it('stretches the unit path over the box it is painted in', () => {
    const [cmd] = markShape().paint(drawn as never, drawn.pose as never);
    const path = (cmd as { path: { coords: Float32Array } }).path;
    expect([...path.coords]).toEqual([100, 240, 140, 240]);
  });

  it('paints an \'inherit\' fill and stroke in what it inherits', () => {
    const node = { ...drawn, data: { ...drawn.data, fill: 'inherit', stroke: 'inherit' } };
    const inherited = { fill: { paint: { color: '#0f0' } }, stroke: { paint: { color: '#00f' }, width: 2 } };
    const [cmd] = markShape().paint(node as never, drawn.pose as never, { inherited } as never);
    expect(cmd).toMatchObject({ fill: { paint: { color: '#0f0' } }, stroke: { paint: { color: '#00f' }, width: 2 } });
  });

  it('pins a text mark to a point on the node, by a point of its own', () => {
    expect(text.dependsOn).toEqual(['a']);
    expect(text.data?.text).toBe('0.5');
    // Right edge 6 left of the node's left edge, centered on its middle.
    const pose = text.pose as { x: number; y: number; width: number; height: number };
    expect(pose.x + pose.width).toBeCloseTo(94, 6);
    expect(pose.y + pose.height / 2).toBeCloseTo(240, 6);
  });

  it('rejects path data that does not parse where the diagram is built, naming the node and mark', () => {
    const bad = (d: string): DiagramData => ({
      nodes: [{ id: 'gain', lines: [], width: 40, height: 40, marks: [{ text: 'x', at: { u: 0, v: 0 } }, { d }] }],
      edges: [],
    });
    const build = (d: string) => () => diagramScene(bad(d), { layout: 'none', font: { fontFamily: 'sans-serif', fontSize: 10 } });
    expect(build('M0 0 L1 x')).toThrow(/node "gain".*mark 1/);
    expect(build('L1 1')).toThrow(/node "gain".*mark 1/);
    expect(build('M0 0 L1')).toThrow(/node "gain".*mark 1/);
    expect(build('')).toThrow(/node "gain".*mark 1/);
    expect(build('M0 0 L1 1')).not.toThrow();
  });
});
