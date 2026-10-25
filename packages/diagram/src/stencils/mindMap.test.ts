import { describe, expect, it } from 'vitest';
import { DIAGRAM_TYPES, STENCIL_GROUPS } from '../diagramTypes/catalog';
import { MIND_MAP_GROUP } from './mindMap';
import { expectStencilsBuild } from './stencils.fixture';

describe('the mind map group', () => {
  it('builds every stencil inside its own outline', () => {
    expectStencilsBuild(MIND_MAP_GROUP);
  });

  it('is registered, and the mind map type opens with it, drawing bezier connectors and laying out radially', () => {
    expect(STENCIL_GROUPS.mindMap).toBe(MIND_MAP_GROUP);
    const type = DIAGRAM_TYPES.mindMap!;
    expect(type.groups).toEqual(['mindMap']);
    for (const id of type.groups) expect(STENCIL_GROUPS[id]).toBeDefined();
    expect(type.edge).toEqual({ router: 'bezier', markerEnd: null });
    expect(type.layout).toBe('radial');
  });
});
