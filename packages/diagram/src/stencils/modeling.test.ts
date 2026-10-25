import { describe, expect, it } from 'vitest';
import type { RectPose } from '@weasel-js/core';
import { DIAGRAM_TYPES, STENCIL_GROUPS } from '../diagramTypes/catalog';
import { diagramTypeEdgeStroke } from '../diagramTypes/edge';
import { stencilBuild, type DiagramStencil } from '../stencil';
import { DIAGRAM_THEMES } from '../theme/themes';
import type { DiagramNode } from '../types';
import { ERD_GROUP } from './erd';
import { UML_GROUP } from './uml';
import { expectStencilsBuild, measure } from './stencils.fixture';

type Built = { id: string; pose: RectPose; data: { diagram?: DiagramNode; text?: string } };

function build(stencil: DiagramStencil) {
  let k = 0;
  const { ops } = stencilBuild(stencil, { x: 0, y: 0, width: 0, height: 0 }, { layer: 'main', newId: () => `n${++k}`, measure });
  const [body, ...rows] = ops.map((op) => (op.args as { node: Built }).node);
  return { body: body!, rows };
}

describe.each([UML_GROUP, ERD_GROUP])('the $id group', (group) => {
  it('builds every stencil at its own size, its rows inside its content box', () => {
    expectStencilsBuild(group);
  });
});

describe('the class and entity stencils', () => {
  it('record their dividers and stack top-aligned', () => {
    for (const id of ['uml-class', 'erd-entity']) {
      const stencil = STENCIL_GROUPS[id.startsWith('uml') ? 'uml' : 'erd']!.stencils.find((s) => s.id === id) as DiagramStencil;
      const body = build(stencil).body.data.diagram!.body!;
      expect(body.verticalAlign).toBe('top');
      expect(body.dividers!.length).toBeGreaterThan(0);
    }
  });
});

describe('the UML class and ERD types', () => {
  const paper = DIAGRAM_THEMES.paper!;

  it.each(['umlClass', 'erd'])('%s opens with groups that exist', (id) => {
    for (const g of DIAGRAM_TYPES[id]!.groups) expect(STENCIL_GROUPS[g]).toBeDefined();
  });

  it('give a new connector their routers and end markers', () => {
    expect(DIAGRAM_TYPES.umlClass!.edge?.router).toBe('orthogonal');
    expect(diagramTypeEdgeStroke(paper, DIAGRAM_TYPES.umlClass!).markerEnd).toBe('arrow-open');
    const erd = diagramTypeEdgeStroke(paper, DIAGRAM_TYPES.erd!);
    expect([erd.markerStart, erd.markerEnd]).toEqual(['crow-one', 'crow-many']);
    expect(DIAGRAM_TYPES.erd!.edge?.router).toBe('orthogonal');
  });
});
