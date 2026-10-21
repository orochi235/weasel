import { describe, it, expect, vi } from 'vitest';
import { polygonFromPoints } from '@weasel-js/geom';
import type { PathDrawCommand } from '@weasel-js/renderer';
import type { View } from 'core/viewport/view';
import { aimSpace2d, rectAim, type ViewAim } from './aim';
import { createViewMarkerLayer, grabViewMarker, type ViewMarkerHost, type ViewMarkerProps } from './viewMarker';

const host: ViewMarkerHost = {
  aimOf: (id: string | null): ViewAim | null => {
    if (id === null) return rectAim(null, { x: 0, y: 0, width: 400, height: 300 });
    if (id === 'pip') return rectAim('pip', { x: 0, y: 0, width: 560, height: 420 });
    return null;
  },
  setAim: vi.fn(() => true),
};
const view: View = { x: 0, y: 0, scale: { x: 0.25, y: 0.25 } };
const dims = { width: 140, height: 105 };

describe('createViewMarkerLayer', () => {
  it('draws the source aim in the frame it is handed', () => {
    const [cmd] = createViewMarkerLayer(() => ({ id: 'm', source: null, target: 'pip' }), host).draw({}, view, dims) as PathDrawCommand[];
    expect(cmd!.path).toEqual(polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 75 }, { x: 0, y: 75 }]));
    expect(cmd!.stroke).toMatchObject({ paint: { kind: 'solid', color: '#ffffff' }, width: 1, dash: [2, 3] });
    expect(cmd!.fill).toBeUndefined();
  });

  it('is a screen-space layer named for its marker', () => {
    expect(createViewMarkerLayer(() => ({ id: 'm', source: null, target: 'pip' }), host))
      .toMatchObject({ id: 'view-marker:m', space: 'screen' });
  });

  it('draws an aim handed in by value', () => {
    const source = { aim: () => rectAim(null, { x: 0, y: 0, width: 400, height: 300 }) };
    const [cmd] = createViewMarkerLayer(() => ({ id: 'm', source, target: 'pip' }), host).draw({}, view, dims) as PathDrawCommand[];
    expect(cmd!.path).toEqual(polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 75 }, { x: 0, y: 75 }]));
  });

  it('draws nothing for a source with no view, or a source that is its own target', () => {
    expect(createViewMarkerLayer(() => ({ id: 'm', source: 'gone', target: 'pip' }), host).draw({}, view, dims)).toEqual([]);
    expect(createViewMarkerLayer(() => ({ id: 'm', source: 'pip', target: 'pip' }), host).draw({}, view, dims)).toEqual([]);
  });

  it('takes its style from the props it reads at draw time', () => {
    let width = 1;
    const layer = createViewMarkerLayer(() => ({ id: 'm', source: null, target: 'pip', style: { stroke: '#f00', width } }), host);
    width = 3;
    const [cmd] = layer.draw({}, view, dims) as PathDrawCommand[];
    expect(cmd!.stroke).toMatchObject({ paint: { kind: 'solid', color: '#f00' }, width: 3, dash: [2, 3] });
  });
});

describe('grabViewMarker', () => {
  const props: ViewMarkerProps = { id: 'm', source: null, target: 'pip' };
  const space = aimSpace2d('pip', view, dims);
  const R = { x: 0, y: 0, width: 400, height: 300 };

  it('grabs inside the outline, and within the slop outside it', () => {
    expect(grabViewMarker(props, host, space, { x: 50, y: 40 })).not.toBeNull();
    expect(grabViewMarker(props, host, space, { x: 103, y: 40 })).not.toBeNull();
    expect(grabViewMarker(props, host, space, { x: 110, y: 40 })).toBeNull();
  });

  it('moves the source by the world distance from the press', () => {
    grabViewMarker(props, host, space, { x: 50, y: 20 })!.moveTo({ x: 240, y: 120 }); // frame (60, 30)
    expect(host.setAim).toHaveBeenLastCalledWith(null, expect.objectContaining({ extent: { x: 40, y: 40, width: 400, height: 300 } }));
  });

  it('measures every move from the press, so a source that moved between moves keeps following', () => {
    let aim = rectAim(null, R);
    const source = { aim: () => aim, setAim: vi.fn((next: ViewAim) => { aim = next as typeof aim; }) };
    const grab = grabViewMarker({ ...props, source }, host, space, { x: 50, y: 20 })!;
    grab.moveTo({ x: 240, y: 120 });
    grab.moveTo({ x: 280, y: 80 });
    expect(source.setAim).toHaveBeenCalledTimes(2);
    expect(source.setAim.mock.lastCall![0].extent).toEqual({ x: 80, y: 0, width: 400, height: 300 });
  });

  it('does not grab a source with no writer, or a marker that is not interactive', () => {
    expect(grabViewMarker({ ...props, source: { aim: () => rectAim(null, R) } }, host, space, { x: 50, y: 40 })).toBeNull();
    expect(grabViewMarker({ ...props, interactive: false }, host, space, { x: 50, y: 40 })).toBeNull();
  });

  it('does not grab a source that names no view, or one that is its own target', () => {
    expect(grabViewMarker({ ...props, source: 'gone' }, host, space, { x: 50, y: 40 })).toBeNull();
    expect(grabViewMarker({ ...props, source: 'pip' }, host, space, { x: 50, y: 40 })).toBeNull();
  });
});
