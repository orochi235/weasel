import { describe, expect, it } from 'vitest';
import { PLOT_THEME, seriesColor } from '../theme';
import { compileSankey, formatFlow } from './compile';
import { renameSankeyNode, setSankeyValue } from './edit';
import { sankeyEditor } from './editor';
import { sankeyLayout } from './layout';
import type { SankeyData } from './types';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const SIZE = { width: 800, height: 400 };
const BOX = { x: 0, y: 0, width: 400, height: 200 };

const ENERGY: SankeyData = {
  kind: 'sankey',
  title: 'Energy',
  links: [
    { source: 'Coal', target: 'Power', value: 30 },
    { source: 'Gas', target: 'Power', value: 20 },
    { source: 'Power', target: 'Homes', value: 35 },
    { source: 'Power', target: 'Industry', value: 15 },
    { source: 'Gas', target: 'Homes', value: 10 },
  ],
};

const byKey = (data: SankeyData, size = SIZE) => {
  const { marks, layout } = compileSankey(data, size, PLOT_THEME, measure);
  return { layout, marks, get: (key: string) => marks.find((m) => m.key === key) };
};

describe('sankeyLayout', () => {
  it('puts each node in the column of its longest path from a source', () => {
    const { nodes, columns } = sankeyLayout(ENERGY, BOX);
    expect(nodes.map((n) => [n.label, n.column])).toEqual([['Coal', 0], ['Power', 1], ['Gas', 0], ['Homes', 2], ['Industry', 2]]);
    expect(columns).toBe(3);
    expect(nodes[0]!.x).toBe(0);
    expect(nodes[3]!.x + nodes[3]!.width).toBe(400);
  });

  it('makes a node as tall as the larger of its flows in and out, its column fitting the box', () => {
    const { nodes } = sankeyLayout(ENERGY, BOX);
    const power = nodes[1]!;
    expect(power.value).toBe(50);
    expect(nodes[2]!.value).toBe(30);
    expect(nodes[0]!.height / nodes[0]!.value).toBeCloseTo(power.height / power.value);
    for (const n of nodes) {
      expect(n.y).toBeGreaterThanOrEqual(-1e-9);
      expect(n.y + n.height).toBeLessThanOrEqual(200 + 1e-9);
    }
  });

  it('stacks ribbons within a node, each as thick as its flow', () => {
    const { nodes, links } = sankeyLayout(ENERGY, BOX);
    const [toHomes, toIndustry] = [links[2]!, links[3]!];
    expect(toHomes.from.x).toBe(nodes[1]!.x + nodes[1]!.width);
    expect(toHomes.to.x).toBe(nodes[3]!.x);
    expect(toHomes.from.y1 - toHomes.from.y0).toBeCloseTo((35 / 15) * (toIndustry.from.y1 - toIndustry.from.y0));
    const leaving = [toHomes.from, toIndustry.from].sort((a, b) => a.y0 - b.y0);
    expect(leaving[0]!.y0).toBeCloseTo(nodes[1]!.y);
    expect(leaving[1]!.y0).toBeCloseTo(leaving[0]!.y1);
  });

  it('orders a column to cross less', () => {
    // Without reordering, x is first mentioned and sits on top, so b's ribbon crosses a's.
    const links = [{ source: 's', target: 'x', value: 1 }, { source: 'a', target: 'y', value: 10 }, { source: 'b', target: 'x', value: 10 }];
    const { nodes } = sankeyLayout({ kind: 'sankey', links }, BOX);
    const at = (label: string) => nodes.find((n) => n.label === label)!.y;
    expect(at('a')).toBeLessThan(at('b'));
    expect(at('y')).toBeLessThan(at('x'));
  });

  it('lays out a cycle without hanging, and an empty one', () => {
    const cycle = sankeyLayout({ kind: 'sankey', links: [{ source: 'a', target: 'b', value: 1 }, { source: 'b', target: 'a', value: 1 }, { source: 'a', target: 'a', value: 1 }] }, BOX);
    expect(cycle.nodes.map((n) => n.column)).toEqual([0, 1]);
    expect(sankeyLayout({ kind: 'sankey', links: [] }, BOX)).toEqual({ nodes: [], links: [], columns: 0 });
  });
});

describe('compileSankey', () => {
  it('draws a bar per node and a ribbon per link, colored by its source', () => {
    const { layout, get } = byKey(ENERGY);
    const gas = get('node:2')!;
    expect(gas.data.plotMark).toEqual({ kind: 'bar', datum: { node: 'Gas' } });
    expect(gas.pose.y).toBeCloseTo(layout.nodes[2]!.y);
    expect(gas.data.fill?.paint.color).toBe(seriesColor(PLOT_THEME, 2));
    const ribbon = get('link:4')!;
    expect(ribbon.data.plotMark).toEqual({ kind: 'ribbon', datum: { link: 4 } });
    expect(ribbon.data.fill?.paint.color).toBe(seriesColor(PLOT_THEME, 2));
  });

  it('labels each node with its name and value beside it, and each ribbon with its value', () => {
    const { layout, get } = byKey(ENERGY);
    const coal = get('node:0:label')!;
    expect(coal.data.text).toBe('Coal');
    expect(coal.data.plotMark.datum).toEqual({ edit: 'node', node: 'Coal' });
    expect(coal.pose.x).toBeGreaterThan(layout.nodes[0]!.x + layout.nodes[0]!.width);
    expect(get('node:3:label')!.pose.x + get('node:3:label')!.pose.width).toBeLessThan(layout.nodes[3]!.x);
    expect(get('node:1:value')!.data.text).toBe('50');
    const value = get('link:2:value')!;
    expect(value.data.text).toBe('35');
    expect(value.data.plotMark.datum).toEqual({ edit: 'value', link: 2 });
    expect(get('title')!.data.text).toBe('Energy');
  });

  it('keeps every key unique, and its keys through a value edit', () => {
    const keys = byKey(ENERGY).marks.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(byKey(setSankeyValue(ENERGY, 0, 99)).marks.map((m) => m.key)).toEqual(keys);
  });

  it('does not throw on an empty chart or a tiny box', () => {
    expect(byKey({ kind: 'sankey', links: [] }).marks).toEqual([]);
    expect(() => byKey(ENERGY, { width: 4, height: 4 })).not.toThrow();
    expect(formatFlow(0.1 + 0.2)).toBe('0.3');
  });
});

describe('sankey edits', () => {
  it('setSankeyValue sets one link\'s flow', () => {
    expect(setSankeyValue(ENERGY, 1, 25).links[1]).toEqual({ source: 'Gas', target: 'Power', value: 25 });
    expect(setSankeyValue(ENERGY, 1, 20)).toBe(ENERGY);
    expect(() => setSankeyValue(ENERGY, 9, 1)).toThrow(/no link 9/);
  });

  it('renameSankeyNode renames a node in every link', () => {
    const next = renameSankeyNode(ENERGY, 'Power', 'Grid');
    expect(next.links.map((l) => `${l.source}>${l.target}`)).toEqual(['Coal>Grid', 'Gas>Grid', 'Grid>Homes', 'Grid>Industry', 'Gas>Homes']);
    expect(next.links[4]).toBe(ENERGY.links[4]);
    expect(renameSankeyNode(ENERGY, 'Gas', 'Gas')).toBe(ENERGY);
    expect(() => renameSankeyNode(ENERGY, 'Oil', 'x')).toThrow(/no node "Oil"/);
    expect(() => renameSankeyNode(ENERGY, 'Gas', 'Coal')).toThrow(/already called "Coal"/);
  });

  it('the editor has no handles, and edits values, node labels and the title in place', () => {
    const { get } = byKey(ENERGY);
    expect(sankeyEditor.handle(ENERGY, { trait: get('node:0')!.data.plotMark, pose: get('node:0')!.pose })).toBeNull();
    const text = sankeyEditor.text!;
    expect(text(ENERGY, { edit: 'value', link: 0 }, ' 12.5 ').links[0]!.value).toBe(12.5);
    expect(text(ENERGY, { edit: 'value', link: 0 }, '-1')).toBe(ENERGY);
    expect(text(ENERGY, { edit: 'value', link: 0 }, 'lots')).toBe(ENERGY);
    expect(text(ENERGY, { edit: 'node', node: 'Coal' }, 'Lignite').links[0]!.source).toBe('Lignite');
    expect(text(ENERGY, { edit: 'node', node: 'Coal' }, 'Gas')).toBe(ENERGY);
    expect(text(ENERGY, { edit: 'node', node: 'Coal' }, '')).toBe(ENERGY);
    expect(text(ENERGY, { edit: 'title' }, 'Flows').title).toBe('Flows');
  });
});
