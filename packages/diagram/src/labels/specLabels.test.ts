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
});
