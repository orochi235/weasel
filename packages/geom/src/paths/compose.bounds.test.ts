import { describe, expect, it } from 'vitest';
import { composePath, decomposePath } from './compose';
import { pathFromD } from './pathFromD';

describe('composePath', () => {
  // x(t) = -150t(1-t) reaches -37.5 at t = 0.5; the control points sit at -50.
  const parent = pathFromD('M0 0 C-50 0 -50 100 0 100');
  const child = { kind: 'rect' as const, x: 0, y: 0, width: 1, height: 1 };

  it('anchors a child at the parent\'s bounds, not its control points', () => {
    expect(composePath(parent, child)).toMatchObject({ x: -37.5, y: 0 });
  });

  it('is undone by decomposePath', () => {
    expect(decomposePath(parent, composePath(parent, child))).toMatchObject({ x: 0, y: 0 });
  });
});
