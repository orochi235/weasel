import { describe, it, expect } from 'vitest';
import { meshFromStops, meshStops } from './meshPaint';
import { meshBounds } from './bake';

describe('meshFromStops', () => {
  it('pads the span before the first stop and after the last in the end colors', () => {
    const mesh = meshFromStops([{ offset: 0.2, color: '#ff0000' }, { offset: 0.8, color: '#0000ff' }]);
    expect(meshBounds(mesh.patches)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(mesh.patches.map((p) => p.colors[0])).toEqual(['#ff0000', '#ff0000', '#0000ff']);
    expect(mesh.patches.map((p) => p.colors[1])).toEqual(['#ff0000', '#0000ff', '#0000ff']);
  });

  it('covers the whole box for a hard break and for one stop at 1', () => {
    const split = meshFromStops([{ offset: 0.5, color: '#ff0000' }, { offset: 0.5, color: '#0000ff' }]);
    expect(meshBounds(split.patches)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    const end = meshFromStops([{ offset: 1, color: '#ff0000' }]);
    expect(meshBounds(end.patches)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it('round-trips stops that do not sit at 0 and 1', () => {
    const stops = [{ offset: 0.2, color: '#ff0000' }, { offset: 0.8, color: '#0000ff' }];
    const back = meshStops(meshFromStops(stops));
    expect(back.map((s) => s.color)).toEqual(['#ff0000', '#0000ff']);
    expect(back[0].offset).toBeCloseTo(0.2, 10);
    expect(back[1].offset).toBeCloseTo(0.8, 10);
  });
});
