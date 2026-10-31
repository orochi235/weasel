import { describe, expect, it } from 'vitest';
import { DIAGRAM_TYPES, STENCIL_GROUPS } from '../diagramTypes/catalog';
import { diagramTypeEdgeStroke } from '../diagramTypes/edge';
import { DIAGRAM_THEMES } from '../theme/themes';
import { ARCHITECTURE_GROUP } from './architecture';
import { C4_GROUP } from './c4';
import { KANBAN_GROUP } from './kanban';
import { REQUIREMENT_GROUP } from './requirement';
import { STATE_GROUP } from './state';
import { builtNodes, expectStencilsBuild } from './stencils.fixture';
import type { DiagramStencil } from '../stencil';

describe.each([STATE_GROUP, REQUIREMENT_GROUP, C4_GROUP, ARCHITECTURE_GROUP, KANBAN_GROUP])('the $id group', (group) => {
  it('builds every stencil at its own size, its rows inside its content box', () => {
    expectStencilsBuild(group);
  });
});

describe('the notation types', () => {
  it.each(['state', 'requirement', 'c4', 'block', 'architecture', 'kanban'])('%s opens with groups that exist and names a notation', (id) => {
    const type = DIAGRAM_TYPES[id]!;
    for (const g of type.groups) expect(STENCIL_GROUPS[g]).toBeDefined();
    expect(type.notations?.length).toBeGreaterThan(0);
  });

  it('give a requirement relationship its dash, and an architecture link no head', () => {
    const paper = DIAGRAM_THEMES.paper!;
    expect(diagramTypeEdgeStroke(paper, DIAGRAM_TYPES.requirement!).dash).toEqual([4, 4]);
    expect(diagramTypeEdgeStroke(paper, DIAGRAM_TYPES.architecture!).markerEnd).toBeUndefined();
  });

  it('keep a C4 element\'s role on its trait', () => {
    const ext = C4_GROUP.stencils.find((s) => s.id === 'c4-system-ext') as DiagramStencil;
    const [body] = builtNodes(ext);
    expect((body!.data.diagram as { style?: string }).style).toBe('muted');
  });
});
