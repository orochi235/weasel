import { describe, expect, it } from 'vitest';
import { dataEdgeStyle, dataNodeStyle, dataRegionStyle } from './dataStyles';
import type { DiagramData } from './dataTypes';
import { diagramScene, edgeIdOf, type DiagramSpec } from './fromData';
import { DIAGRAM_THEMES } from './theme/themes';

const THEME = DIAGRAM_THEMES.night!;
const byId = (specs: readonly DiagramSpec[], id: string) => specs.find((s) => s.id === id)!;
const strokeOf = (spec: DiagramSpec) => (spec.data.stroke?.paint as { color?: string } | undefined)?.color;
const trait = (spec: DiagramSpec) => spec.data.diagram as unknown as Record<string, unknown>;

const DATA: DiagramData = {
  nodes: [
    { id: 'a', lines: ['A'], colors: { fill: '#112233', text: '#445566' } },
    { id: 'b', lines: ['B'] },
  ],
  edges: [{ from: 'a', to: 'b', label: 'go', colors: { stroke: '#778899', label: '#aabbcc' } }],
  containers: [
    { id: 'k', role: 'container', label: 'K', members: ['b'], colors: { stroke: '#010203' } },
    { id: 'p', role: 'pool', lanes: [{ id: 'l1', label: 'L', colors: { stroke: '#0a0b0c' } }] },
  ],
};

describe('diagramScene colors', () => {
  const specs = diagramScene(DATA, { theme: THEME, layout: 'none' });

  it('draws a node in its own colors over its role, and lists them as its own', () => {
    const a = byId(specs, 'a');
    expect(a.data.fill?.paint.color).toBe('#112233');
    expect(strokeOf(a)).toBe(THEME.roles[THEME.defaultRole]!.stroke);
    expect(trait(a).ownStyle).toEqual(['fill', 'text']);
    const row = specs.find((s) => s.parent === 'a' && s.data.text === 'A')!;
    expect(row.data.fill?.paint.color).toBe('#445566');
    expect(trait(byId(specs, 'b')).ownStyle).toBeUndefined();
  });

  it('draws an edge and its label in its own colors, the label owned as text', () => {
    const id = edgeIdOf(DATA.edges[0]!);
    const edge = byId(specs, id);
    expect(strokeOf(edge)).toBe('#778899');
    expect(trait(edge).ownStyle).toEqual(['stroke', 'text']);
    expect(byId(specs, `${id}/label`).data.fill?.paint.color).toBe('#aabbcc');
  });

  it('draws a container and a lane in their own colors, listed as their own', () => {
    const k = byId(specs, 'k');
    expect(strokeOf(k)).toBe('#010203');
    expect(k.data.fill?.paint.color).toBe(THEME.container.fill);
    expect(trait(k).ownStyle).toEqual(['stroke']);
    expect(strokeOf(byId(specs, 'l1'))).toBe('#0a0b0c');
    expect(trait(byId(specs, 'l1')).ownStyle).toEqual(['stroke']);
  });
});

describe('diagramScene edge roles', () => {
  it('draws an edge naming a role in its stroke, and keeps the role on its trait', () => {
    const data: DiagramData = { nodes: [{ id: 'a' }, { id: 'b' }], edges: [{ from: 'a', to: 'b', style: 'accent' }] };
    const edge = byId(diagramScene(data, { theme: THEME }), edgeIdOf(data.edges[0]!));
    expect(strokeOf(edge)).toBe(THEME.roles.accent!.stroke);
    expect(trait(edge).style).toBe('accent');
  });
});

describe('the data styles a writer reads', () => {
  it('give what diagramScene draws', () => {
    const specs = diagramScene(DATA, { theme: THEME });
    expect(dataNodeStyle(DATA.nodes[0]!, THEME).fill).toBe(byId(specs, 'a').data.fill?.paint.color);
    expect(dataEdgeStyle(DATA.edges[0]!, THEME).stroke).toBe(strokeOf(byId(specs, edgeIdOf(DATA.edges[0]!))));
    expect(dataRegionStyle(DATA.containers![0]!, THEME).stroke).toBe(strokeOf(byId(specs, 'k')));
    expect(dataRegionStyle({ role: 'lane', ...DATA.containers![1]!.lanes![0]! }, THEME, 0).stroke).toBe(strokeOf(byId(specs, 'l1')));
  });
});

describe('diagramScene layer', () => {
  it('puts every spec on the layer it is given, and on main by default', () => {
    expect(diagramScene(DATA).every((s) => s.layer === 'main')).toBe(true);
    const specs = diagramScene(DATA, { layer: 'shapes' });
    expect(specs.every((s) => s.layer === 'shapes')).toBe(true);
  });
});
