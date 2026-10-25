import { describe, expect, it } from 'vitest';
import { DIAGRAM_TYPES, STENCIL_GROUPS } from './catalog';

describe('the shipped catalogs', () => {
  it.each(Object.values(DIAGRAM_TYPES))('opens $id with groups that exist', (type) => {
    for (const group of type.groups) expect(STENCIL_GROUPS[group], `${type.id}: ${group}`).toBeDefined();
  });

  it('gives every stencil an id no other stencil has, since a tool is named for it', () => {
    const ids = Object.values(STENCIL_GROUPS).flatMap((g) => g.stencils.map((s) => s.id));
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it('draws network links straight and plain, and BPMN flows square with an arrow', () => {
    expect(DIAGRAM_TYPES.network).toMatchObject({ groups: ['network', 'containers'], edge: { router: 'straight', markerEnd: null } });
    expect(DIAGRAM_TYPES.bpmn).toMatchObject({ groups: ['bpmn', 'containers'], edge: { router: 'orthogonal', markerEnd: 'arrow' } });
  });
});
