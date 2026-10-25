import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RectPose } from '@weasel-js/core';
import type { MeasureRowText } from '../body';
import { DIAGRAM_TYPES, STENCIL_GROUPS } from '../diagramTypes/catalog';
import { diagramTypeEdgeStroke } from '../diagramTypes/edge';
import { contentBox, outlinePath } from '../outline';
import { stencilBuild, type DiagramStencil } from '../stencil';
import { DIAGRAM_THEMES } from '../theme/themes';
import type { DiagramNode } from '../types';
import { ERD_GROUP } from './erd';
import { UML_GROUP } from './uml';

/** Roughly a 12px sans-serif's advance, and `canvasMeasure`'s line height. */
const measure: MeasureRowText = (text, s) => {
  const size = s.fontSize ?? 12;
  return { width: Math.ceil(text.length * size * (s.bold === true ? 0.62 : 0.56)), height: Math.ceil(size * 1.2) };
};

type Built = { id: string; pose: RectPose; data: { diagram?: DiagramNode; text?: string } };

function build(stencil: DiagramStencil) {
  let k = 0;
  const { ops } = stencilBuild(stencil, { x: 0, y: 0, width: 0, height: 0 }, { layer: 'main', newId: () => `n${++k}`, measure });
  const [body, ...rows] = ops.map((op) => (op.args as { node: Built }).node);
  return { body: body!, rows };
}

afterEach(() => { vi.restoreAllMocks(); });

describe.each([UML_GROUP, ERD_GROUP])('the $id group', (group) => {
  it.each(group.stencils.map((s) => [s.id, s as DiagramStencil]))('builds %s at its own size, its rows inside its content box', (_id, stencil) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { body, rows } = build(stencil);
    outlinePath(stencil.outline, body.pose);
    expect(warn).not.toHaveBeenCalled();
    expect({ width: body.pose.width, height: body.pose.height }).toEqual(stencil.size);
    const c = contentBox(stencil.outline, body.pose);
    for (const r of rows) {
      expect(r.pose.x).toBeGreaterThanOrEqual(c.x);
      expect(r.pose.y).toBeGreaterThanOrEqual(c.y);
      expect(r.pose.x + r.pose.width).toBeLessThanOrEqual(c.x + c.width + 1e-6);
      expect(r.pose.y + r.pose.height).toBeLessThanOrEqual(c.y + c.height + 1e-6);
      expect(measure(r.data.text ?? '', {}).width).toBeLessThanOrEqual(r.pose.width);
    }
    expect(stencil.icon).toBeDefined();
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
