import { describe, expect, it } from 'vitest';
import { diagramScene, edgeIdOf, type DiagramData } from '../fromData';
import type { DiagramLabel } from '../labelTrait';
import { createSpecLabelPlacer } from './specLabels';

/** `a` and `b` side by side, with `cover` on the wire just past `a`. */
function specsFor(labelPlacement: DiagramLabel) {
  const edge = { from: 'a', to: 'b', label: 'note', labelPlacement };
  const data: DiagramData = {
    nodes: [
      { id: 'a', lines: [], at: { x: 0, y: 0 }, width: 100, height: 40, pinned: true },
      { id: 'b', lines: [], at: { x: 600, y: 0 }, width: 100, height: 40, pinned: true },
      { id: 'cover', lines: [], at: { x: 110, y: -10 }, width: 80, height: 60, pinned: true },
    ],
    edges: [edge],
  };
  return { specs: diagramScene(data, { layout: 'none' }), id: `${edgeIdOf(edge)}/label` };
}

const labelOf = (specs: ReturnType<typeof specsFor>['specs'], id: string) =>
  (specs.find((s) => s.id === id)!.data?.diagram as { label: DiagramLabel }).label;

describe('createSpecLabelPlacer', () => {
  it('places a label afresh when only its inset changes', () => {
    const near = specsFor({ at: 'start', inset: 4 });
    const far = specsFor({ at: 'start', inset: 300 });
    const fresh = labelOf(createSpecLabelPlacer()(far.specs), far.id);
    expect(labelOf(createSpecLabelPlacer()(near.specs), near.id)).toHaveProperty('placed');
    expect(fresh).not.toHaveProperty('placed');

    const placer = createSpecLabelPlacer();
    placer(near.specs);
    expect(labelOf(placer(far.specs), far.id)).toEqual(fresh);
  });

  it('places a split connector\'s label on the stubs it draws, not the line between pages', () => {
    // `a` on the first page and `b` on the second; `cover` sits on the undrawn
    // line between them, well past the first stub.
    const edge = { from: 'a', to: 'b', label: 'note', labelPlacement: { at: 'mid' as const } };
    const node = (id: string, x: number) => ({ id, lines: [], at: { x, y: 20 }, width: 30, height: 20, pinned: true });
    const specs = diagramScene({
      pages: [{ id: 'p1', width: 200, height: 100 }, { id: 'p2', width: 200, height: 100 }],
      nodes: [node('a', 20), node('b', 360), node('cover', 190)],
      edges: [edge],
    }, { layout: 'none' });
    const id = `${edgeIdOf(edge)}/label`;
    expect(labelOf(createSpecLabelPlacer()(specs), id)).toEqual({ at: 'mid' });
  });
});
