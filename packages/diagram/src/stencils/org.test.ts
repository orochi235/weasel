import { describe, expect, it } from 'vitest';
import { DIAGRAM_TYPES, STENCIL_GROUPS } from '../diagramTypes/catalog';
import { ORG_GROUP } from './org';
import { expectStencilsBuild } from './stencils.fixture';

describe('the org group', () => {
  it('builds every stencil inside its own outline', () => {
    expectStencilsBuild(ORG_GROUP);
  });

  it('gives each card a name row and a title row', () => {
    for (const id of ['person', 'executive', 'assistant']) {
      const card = ORG_GROUP.stencils.find((s) => s.id === id)!;
      expect('rows' in card && card.rows?.map((r) => ('id' in r ? r.id : undefined))).toEqual(['name', 'title']);
    }
  });

  it('draws a vacancy dashed, with a name row and a title row', () => {
    const vacancy = ORG_GROUP.stencils.find((s) => s.id === 'vacancy')!;
    expect('style' in vacancy && vacancy.style?.dash).toEqual([6, 4]);
    expect('rows' in vacancy && vacancy.rows?.map((r) => ('id' in r ? r.id : undefined))).toEqual(['name', 'title']);
  });

  it('is registered, and the org chart type opens with it and the containers, laid out top-down as a tree', () => {
    expect(STENCIL_GROUPS.org).toBe(ORG_GROUP);
    const type = DIAGRAM_TYPES.orgChart!;
    expect(type.groups).toEqual(['org', 'containers']);
    for (const id of type.groups) expect(STENCIL_GROUPS[id]).toBeDefined();
    expect(type.edge).toEqual({ router: 'orthogonal', markerEnd: null });
    expect(type.layout).toBe('tree');
  });
});
