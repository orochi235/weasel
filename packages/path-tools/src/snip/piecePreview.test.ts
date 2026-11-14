import { describe, expect, it, vi } from 'vitest';
import { pathFromD, type PolygonPath } from '@weasel-js/geom';
import { createPiecePreview } from './piecePreview';

const view = { x: 0, y: 0, scale: { x: 2, y: 2 } } as never;
const dims = { width: 0, height: 0, dpr: 1 } as never;

describe('createPiecePreview', () => {
  it('draws the piece at view scale until the scene changes under it', () => {
    let version = 1;
    const scene = { getVersion: () => version };
    const p = createPiecePreview();
    const heard = vi.fn();
    p.layer.subscribe!(heard);
    p.show({ path: pathFromD('M10 0 H20') as PolygonPath, scene });
    expect(heard).toHaveBeenCalledTimes(1);
    const [cmd] = p.layer.draw(null, view, dims);
    expect(Array.from((cmd as { path: PolygonPath }).path.coords)).toEqual([20, 0, 40, 0]);
    version = 2;
    expect(p.layer.draw(null, view, dims)).toEqual([]);
  });

  it('clears on null', () => {
    const p = createPiecePreview();
    p.show({ path: pathFromD('M0 0 H1') as PolygonPath, scene: { getVersion: () => 1 } });
    p.show(null);
    expect(p.current()).toBeNull();
  });
});
