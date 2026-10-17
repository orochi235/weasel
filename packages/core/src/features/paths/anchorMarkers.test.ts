import { describe, expect, it } from 'vitest';
import { circlePath, PathBuilder, squarePath, type PolygonPath, type View } from '@weasel-js/geom';
import type { PathDrawCommand } from '@weasel-js/renderer';
import { anchorMarkerCommands, DEFAULT_OVERLAY_STYLE } from './anchorMarkers';

/** An open polyline along y = 10 with anchors `gap` world units apart. */
function row(count: number, gap: number): PolygonPath {
  const b = new PathBuilder();
  for (let i = 0; i < count; i++) {
    if (i === 0) b.moveTo(i * gap, 10);
    else b.lineTo(i * gap, 10);
  }
  return b.build();
}

const at = (scale: number, x = 0, y = 0): View => ({ x, y, scale: { x: scale, y: scale } });
const draw = (path: PolygonPath, view: View, selected: number[] = []) =>
  anchorMarkerCommands(path, view, new Set(selected), DEFAULT_OVERLAY_STYLE) as PathDrawCommand[];
const square = (x: number, y: number) => squarePath(x, y, DEFAULT_OVERLAY_STYLE.anchorSizePx);
const dot = (x: number, y: number) => circlePath(x, y, DEFAULT_OVERLAY_STYLE.denseDotRadiusPx);

describe('anchorMarkerCommands', () => {
  it('draws the outline first, on screen, a thin accent line', () => {
    const [outline] = draw(row(3, 40), at(2, 5, 0));
    expect(outline.fill).toBeUndefined();
    expect(outline.stroke).toEqual({ paint: { kind: 'solid', color: DEFAULT_OVERLAY_STYLE.outlineStroke }, width: 1 });
    expect([...(outline.path as PolygonPath).coords]).toEqual([-10, 20, 70, 20, 150, 20]);
  });

  it('draws anchors spaced wider than a marker as squares', () => {
    const markers = draw(row(3, 20), at(1)).slice(1);
    expect(markers.map((m) => m.path)).toEqual([square(0, 10), square(20, 10), square(40, 10)]);
  });

  it('draws crowded unselected anchors as dots, a selected one still as a square', () => {
    // 2 world units apart is 2px at 1x: a quarter of an 8px marker.
    const markers = draw(row(4, 2), at(1), [2]).slice(1);
    expect(markers.map((m) => m.path)).toEqual([dot(0, 10), dot(2, 10), square(4, 10), dot(6, 10)]);
    expect(markers[0].stroke).toBeUndefined();
  });

  it('measures crowding on screen, so zooming in turns dots back into squares', () => {
    const markers = draw(row(3, 2), at(5)).slice(1);
    expect(markers.map((m) => m.path)).toEqual([square(0, 50), square(10, 50), square(20, 50)]);
  });

  it('decides per anchor: a lone anchor beside a dense run keeps its square', () => {
    const b = new PathBuilder();
    b.moveTo(0, 0);
    b.lineTo(2, 0);
    b.lineTo(4, 0);
    b.lineTo(60, 0);
    const markers = draw(b.build(), at(1)).slice(1);
    expect(markers.map((m) => m.path)).toEqual([dot(0, 0), dot(2, 0), dot(4, 0), square(60, 0)]);
  });
});

const sameCoords = (a: PolygonPath, b: PolygonPath) => expect(Array.from(a.coords)).toEqual(Array.from(b.coords));

describe('anchorMarkerCommands with marker shapes', () => {
  it('draws an anchor with the shape given for its flat index, and the rest as squares', () => {
    const control = new PathBuilder().moveTo(0, 0).lineTo(100, 0).lineTo(200, 50).build();
    const calls: unknown[][] = [];
    const disc = (at: { x: number; y: number }, size: number, prev: unknown, next: unknown) => {
      calls.push([at, size, prev, next]);
      return circlePath(at.x, at.y, size / 2);
    };
    const markers = (anchorMarkerCommands(control, at(1), new Set(), DEFAULT_OVERLAY_STYLE, [null, disc]) as PathDrawCommand[])
      .slice(1).map((c) => c.path as PolygonPath);
    expect(markers).toHaveLength(3);
    sameCoords(markers[0], squarePath(0, 0, 8));
    sameCoords(markers[1], circlePath(100, 0, 4));
    sameCoords(markers[2], squarePath(200, 50, 8));
    expect(calls).toEqual([[{ x: 100, y: 0 }, 8, { x: 0, y: 0 }, { x: 200, y: 50 }]]);
  });
});
