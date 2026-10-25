import { describe, it, expect, vi } from 'vitest';
import type { Path } from '@weasel-js/geom';
import type { PathDrawCommand } from '@weasel-js/renderer';
import { createPathOverlay, PATH_OVERLAY_ROLES } from './pathOverlay';

const box: Path = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
const view = { x: 0, y: 0, scale: { x: 2, y: 2 } };
const dims = { width: 100, height: 100, dpr: 1 };

describe('createPathOverlay', () => {
  it('draws nothing until it holds paths, then each path in world space', () => {
    const ov = createPathOverlay({ id: 'probe' });
    expect(ov.layer.draw(null, view, dims)).toEqual([]);
    ov.set([{ path: box }]);
    const [cmd] = ov.layer.draw(null, view, dims) as PathDrawCommand[];
    expect(ov.layer.space ?? 'world').toBe('world');
    expect(cmd).toMatchObject({ kind: 'path', path: box });
    expect(cmd!.stroke?.width).toEqual({ px: 1 });
  });

  it('paints a path by its role, and a role it does not know as chrome', () => {
    const ov = createPathOverlay({ id: 'probe', roles: { mine: { fill: { color: '#123' } } } });
    ov.set([{ path: box, role: 'remove' }, { path: box, role: 'mine' }, { path: box, role: 'unheard-of' }]);
    const [remove, mine, unknown] = ov.layer.draw(null, view, dims) as PathDrawCommand[];
    expect(remove!.fill?.paint).toEqual(PATH_OVERLAY_ROLES['remove']!.fill);
    expect(mine!.fill?.paint).toEqual({ color: '#123' });
    expect(unknown!.fill?.paint).toEqual(PATH_OVERLAY_ROLES['chrome']!.fill);
  });

  it('tells its layer to repaint on every change, and not on a clear of nothing', () => {
    const ov = createPathOverlay({ id: 'probe' });
    const heard = vi.fn();
    const off = ov.layer.subscribe!(heard);
    ov.set([{ path: box }]);
    ov.clear();
    ov.clear();
    expect(heard).toHaveBeenCalledTimes(2);
    off();
    ov.set([{ path: box }]);
    expect(heard).toHaveBeenCalledTimes(2);
    expect(ov.get()).toEqual([{ path: box }]);
  });
  it('draws a path that carries a paint in that paint, under its role\'s outline', () => {
    const ov = createPathOverlay({ id: 'probe' });
    const stroke = { paint: { color: '#00f' }, width: 4 };
    ov.set([{ path: box, role: 'remove', paint: { fill: { paint: { color: '#0f0' } }, stroke } }]);
    const [painted, outline, ...rest] = ov.layer.draw(null, view, dims) as PathDrawCommand[];
    expect(rest).toEqual([]);
    expect(painted).toMatchObject({ kind: 'path', path: box, fill: { paint: { color: '#0f0' } }, stroke });
    expect(outline).toMatchObject({ kind: 'path', path: box, stroke: { paint: PATH_OVERLAY_ROLES['remove']!.stroke, width: { px: 1 } } });
    expect(outline!.fill).toBeUndefined();
  });
});
