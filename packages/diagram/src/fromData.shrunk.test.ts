import { describe, expect, it } from 'vitest';
import { diagramScene } from './fromData';

describe('diagramScene, shrunk', () => {
  it('refuses a node named like the title of a group it is in', () => {
    expect(() => diagramScene({ nodes: [{ id: 'G/label', lines: ['x'] }], edges: [], groups: [{ id: 'G', members: ['G/label'], label: 'T' }] }, { layout: 'none' }))
      .toThrow('diagramScene: two things would share the scene id "G/label"');
  });

  it('refuses one edge id given to two different edges, and drops a true repeat', () => {
    const nodes = [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }];
    expect(() => diagramScene({ nodes, edges: [{ id: 'e', from: 'a', to: 'b' }, { id: 'e', from: 'b', to: 'a' }] }, { layout: 'none' }))
      .toThrow('diagramScene: edge id "e" names two different edges');
    const specs = diagramScene({ nodes, edges: [{ id: 'e', from: 'a', to: 'b' }, { id: 'e', from: 'a', to: 'b' }] }, { layout: 'none' });
    expect(specs.filter((s) => s.id === 'e')).toHaveLength(1);
  });
});
