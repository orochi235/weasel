import { describe, it, expect } from 'vitest';
import { pathFromD } from '@weasel-js/geom';
import { extractPolylines } from '@weasel-js/geom/tessellate';
import { tessellateStroke } from './stroke';
import { strokeFlattening } from './flattening';

// The reported shape: its closing curve ends in a tight bend, which a 12-wide
// stroke drew as visible facets.
const path = pathFromD(
  'M288.02124 332.57312L591.342224 515.030945C591.342224 515.030945 242.15564 630.167175 241.057632 624.643799'
  + 'C239.959641 619.120422 430.260345 579.655945 330.058868 433.518829'
  + 'C229.857391 287.381653 288.02124 332.57312 288.02124 332.57312Z',
);

const vertexCount = (width: number) =>
  tessellateStroke(path, { paint: { color: '#000' }, width, join: 'bevel' }).vertices.length / 2;

describe('stroke flattening', () => {
  it('flattens a thick stroke more finely than a thin one', () => {
    expect(vertexCount(12)).toBeGreaterThan(vertexCount(1));
  });

  it('holds the edges to the tolerance only once half the widest width passes it', () => {
    expect(strokeFlattening(0.5, 1).offset).toBeUndefined();
    expect(strokeFlattening(0.5, 1.2).offset).toBe(0.6);
    expect(strokeFlattening(0.5, 1, [1, 4]).offset).toBe(2);
  });

  it('flattens gentle bends on the fill\'s vertices even when the stroke is thick', () => {
    let d = 'M0 0';
    for (let i = 0; i < 64; i++) d += `C${i * 3 + 1} 0.3 ${i * 3 + 2} 0.3 ${i * 3 + 3} 0`;
    const waves = pathFromD(d);
    expect(extractPolylines(waves, strokeFlattening(0.5, 4))).toEqual(extractPolylines(waves));
  });

  it('flattens a thin stroke on the same vertices as its fill', () => {
    expect(extractPolylines(path, strokeFlattening(0.5, 1))).toEqual(extractPolylines(path));
  });
});
