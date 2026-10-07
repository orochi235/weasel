import { describe, expect, it } from 'vitest';
import { createScene } from '@weasel-js/core';
import { diagramScene, edgeIdOf, type DiagramData } from './fromData';
import { withDiagramRegistry } from './edge';

const DATA: DiagramData = {
  nodes: [
    { id: 'a', lines: ['level mix', '0–1'] },
    { id: 'b', lines: ['warm'] },
    { id: 'c', lines: ['color', 'hex'] },
  ],
  edges: [{ from: 'a', to: 'b', label: 'weight' }, { from: 'b', to: 'c' }],
};

const containers = (specs: ReturnType<typeof diagramScene>) =>
  specs.filter((s) => s.kind === 'container');

describe('diagramScene', () => {
  it('makes one container per node, carrying the data id', () => {
    expect(containers(diagramScene(DATA)).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('makes one text child per line, unpickable', () => {
    const texts = diagramScene(DATA).filter((s) => s.data?.text !== undefined && s.parent === ('a' as never));
    expect(texts.map((t) => t.data?.text)).toEqual(['level mix', '0–1']);
    expect(texts.every((t) => t.pickable === false)).toBe(true);
  });

  it('lays nodes out in ranks running down by default', () => {
    const ys = containers(diagramScene(DATA)).map((s) => (s.pose as { y: number }).y);
    expect(ys[0]).toBeLessThan(ys[1]!);
    expect(ys[1]).toBeLessThan(ys[2]!);
  });

  it('gives each edge a stable id and a label node', () => {
    const specs = diagramScene(DATA);
    const edge = specs.find((s) => s.id === (edgeIdOf(DATA.edges[0]!) as never));
    expect(edge?.dependsOn).toEqual(['a', 'b']);
    expect(specs.some((s) => s.data?.text === 'weight' && s.dependsOn?.[0] === edge?.id)).toBe(true);
  });

  it('drops an edge whose end is not a node', () => {
    const specs = diagramScene({ nodes: DATA.nodes, edges: [{ from: 'a', to: 'nowhere' }] });
    expect(specs.some((s) => s.dependsOn !== undefined)).toBe(false);
  });

  it('applies nodeStyle and edgeStyle', () => {
    const specs = diagramScene(DATA, {
      nodeStyle: () => ({ fill: '#000000', stroke: '#ff0000', text: '#ffffff', strokeWidth: 3 }),
      edgeStyle: () => ({ stroke: '#00ff00', width: 1 }),
    });
    expect(containers(specs)[0]!.data?.stroke).toEqual({ paint: { color: '#ff0000' }, width: 3 });
    const edge = specs.find((s) => s.id === (edgeIdOf(DATA.edges[1]!) as never));
    expect(edge?.data?.stroke).toMatchObject({ paint: { color: '#00ff00' }, width: 1 });
  });

  it('handles one node and no edges', () => {
    expect(containers(diagramScene({ nodes: [{ id: 'pose', lines: ['pose'] }], edges: [] }))).toHaveLength(1);
  });

  it('loads into a scene', () => {
    const scene = createScene({
      systemLayers: [{ id: 'main' as const }],
      initial: diagramScene(DATA),
      registry: withDiagramRegistry(),
    });
    expect(scene.get('b' as never)).toBeDefined();
  });
});
