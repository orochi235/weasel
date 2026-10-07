import { describe, expect, it } from 'vitest';
import { fitDiagram } from './DiagramView';
import type { DiagramSpec } from './fromData';

const wide = [
  { id: 'a', kind: 'container', pose: { x: 0, y: 0, width: 2000, height: 100 } },
] as unknown as DiagramSpec[];
const size = { width: 360, height: 600 };

describe('fitDiagram', () => {
  it('fits everything when minScale is unset', () => {
    expect(fitDiagram(wide, size)!.scale.x).toBeLessThan(0.2);
  });

  it('stops at minScale, leaving the rest to a pan', () => {
    expect(fitDiagram(wide, size, 0.75)!.scale).toEqual({ x: 0.75, y: 0.75 });
  });

  it('does not raise a diagram that already fits above the floor', () => {
    const small = [
      { id: 'a', kind: 'container', pose: { x: 0, y: 0, width: 100, height: 100 } },
    ] as unknown as DiagramSpec[];
    expect(fitDiagram(small, size, 0.75)!.scale).toEqual({ x: 1, y: 1 });
  });

  it("opens on the start of a floored diagram with anchor 'start'", () => {
    const v = fitDiagram(wide, size, 0.75, 'start')!;
    expect(v.x * v.scale.x).toBeCloseTo(-16); // left edge 16px in from the box
  });
});
