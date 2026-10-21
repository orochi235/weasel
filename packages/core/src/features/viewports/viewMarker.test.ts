import { describe, it, expect } from 'vitest';
import { polygonFromPoints } from '@weasel-js/geom';
import type { PathDrawCommand } from '@weasel-js/renderer';
import type { View } from 'core/viewport/view';
import { rectAim, type ViewAim } from './aim';
import { createViewMarkerLayer, type ViewMarkerHost } from './viewMarker';

const host: ViewMarkerHost = {
  aimOf: (id: string | null): ViewAim | null => {
    if (id === null) return rectAim(null, { x: 0, y: 0, width: 400, height: 300 });
    if (id === 'pip') return rectAim('pip', { x: 0, y: 0, width: 560, height: 420 });
    return null;
  },
  setAim: () => false,
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

  // Review Focus
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
