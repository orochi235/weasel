import { describe, it, expect } from 'vitest';
import { markerDrawCommands, markerReach } from './markerCommands';
import { registerMarker, type MarkerEntry } from '../../core/strokeMarkers';
import { PATH_Z, PATH_M, PATH_L, type PolygonPath } from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';

const LINE: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L]),
  coords: new Float32Array([0, 0, 100, 0]),
  fillRule: 'nonzero',
};
const PAINT = { fill: 'solid', color: '#f00' } as const;
const BASE: Stroke = { paint: PAINT, width: 2 };

describe('markerDrawCommands', () => {
  it('emits nothing for a stroke with no markers', () => {
    expect(markerDrawCommands(LINE, BASE, 2, undefined)).toEqual([]);
  });

  it('emits one filled command for a filled head', () => {
    const cmds = markerDrawCommands(LINE, { ...BASE, markerEnd: 'arrow' }, 2, undefined);
    expect(cmds).toHaveLength(1);
    expect(cmds[0].fill).toEqual(PAINT);
    expect(cmds[0].stroke).toBeUndefined();
  });

  it('emits one outlined command for an open head', () => {
    const cmds = markerDrawCommands(LINE, { ...BASE, markerEnd: 'arrow-open' }, 2, undefined);
    expect(cmds).toHaveLength(1);
    expect(cmds[0].fill).toBeUndefined();
    expect(cmds[0].stroke?.paint).toEqual(PAINT);
    // outline width 1 marker unit at size 2.
    expect(cmds[0].stroke?.width).toBeCloseTo(2, 6);
  });

  it('emits an outline-only command for the hollow built-in', () => {
    const cmds = markerDrawCommands(LINE, { ...BASE, markerEnd: 'diamond-hollow' }, 2, undefined);
    expect(cmds).toHaveLength(1);
    expect(cmds[0].fill).toBeUndefined();
    expect(cmds[0].stroke).toBeDefined();
  });

  it('emits fill and outline together when an entry declares both', () => {
    // The UML aggregation diamond: filled *and* outlined. This is the case a
    // single `mode: 'fill' | 'stroke'` field could not express, and the reason
    // an entry carries the two independently.
    const dispose = registerMarker({
      id: 'app:both',
      inset: 2,
      fill: { fill: 'solid', color: '#fff' },
      outline: { width: 0.5 },
      path: ({ size }) => ({
        kind: 'polygon',
        commands: new Uint8Array([PATH_M, PATH_L, PATH_L]),
        coords: new Float32Array([0, 0, -2 * size, -size, -2 * size, size]),
        fillRule: 'nonzero',
      }),
    });
    try {
      const cmds = markerDrawCommands(LINE, { ...BASE, markerEnd: 'app:both' }, 2, undefined);
      expect(cmds).toHaveLength(1);
      expect(cmds[0].fill).toEqual({ fill: 'solid', color: '#fff' });
      // The outline declares no paint of its own, so it falls back to the line's.
      expect(cmds[0].stroke?.paint).toEqual(PAINT);
      expect(cmds[0].stroke?.width).toBeCloseTo(1, 6);
    } finally {
      dispose();
    }
  });

  it('places the head at the line end, rotated to point along it', () => {
    const cmds = markerDrawCommands(LINE, { ...BASE, markerEnd: 'arrow' }, 2, undefined);
    const path = cmds[0].path as PolygonPath;
    // Anchor vertex lands on the line's end point.
    expect(path.coords[0]).toBeCloseTo(100, 4);
    expect(path.coords[1]).toBeCloseTo(0, 4);
    // Body trails back toward -X.
    expect(path.coords[2]).toBeLessThan(100);
  });

  it('emits a command per subpath end', () => {
    const two: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_M, PATH_L]),
      coords: new Float32Array([0, 0, 10, 0, 20, 0, 30, 0]),
      fillRule: 'nonzero',
    };
    const cmds = markerDrawCommands(two, { ...BASE, markerEnd: 'arrow' }, 2, undefined);
    expect(cmds).toHaveLength(2);
  });

  it('drops an unregistered key without throwing', () => {
    expect(markerDrawCommands(LINE, { ...BASE, markerEnd: 'app:nope' }, 2, undefined)).toEqual([]);
  });

  it('honours a fixed orient angle, ignoring the line direction', () => {
    // A vertical bar that must stay vertical whatever the line does.
    const dispose = registerMarker({
      id: 'app:fixed',
      orient: 0,
      path: ({ size }) => ({
        kind: 'polygon',
        commands: new Uint8Array([PATH_M, PATH_L]),
        coords: new Float32Array([0, -size, 0, size]),
        fillRule: 'nonzero',
      }),
      fill: 'none',
      outline: { width: 1 },
    });
    try {
      // A line running up-and-right; with orient 'auto' the bar would tilt.
      const diagonal: PolygonPath = {
        kind: 'polygon',
        commands: new Uint8Array([PATH_M, PATH_L]),
        coords: new Float32Array([0, 0, 50, 50]),
        fillRule: 'nonzero',
      };
      const cmds = markerDrawCommands(diagonal, { ...BASE, markerEnd: 'app:fixed' }, 2, undefined);
      const path = cmds[0].path as PolygonPath;
      // Both endpoints share an x — the bar did not rotate with the line.
      expect(path.coords[0]).toBeCloseTo(path.coords[2], 6);
    } finally {
      dispose();
    }
  });
});

/** A head whose length is the stroke's miter limit, in marker units. */
function growingHead(reads?: MarkerEntry['reads']): MarkerEntry {
  return {
    id: 'app-grow',
    ...(reads ? { reads } : {}),
    path: ({ size, stroke }) => {
      const len = (stroke.miterLimit ?? 1) * size;
      return {
        kind: 'polygon',
        commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_Z]),
        coords: new Float32Array([0, 0, -len, -0.5 * size, -len, 0.5 * size]),
        fillRule: 'nonzero',
      };
    },
  };
}

describe('markerReach', () => {
  const at = (miterLimit: number, width = 2): Stroke => ({ ...BASE, width, miterLimit, markerEnd: 'app-grow' });

  it.each([
    ['a head that does not say what it reads', undefined],
    ['a head that declares the field it reads', ['miterLimit'] as const],
  ])('follows the stroke field that shapes %s', (_, reads) => {
    const dispose = registerMarker(growingHead(reads as MarkerEntry['reads']));
    try {
      expect(markerReach(at(1)).world).toBeCloseTo(2, 6);
      expect(markerReach(at(10)).world).toBeCloseTo(20, 6);
    } finally {
      dispose();
    }
  });

  it('measures a head once across equal strokes when it declares what it reads', () => {
    let built = 0;
    const head = growingHead(['miterLimit']);
    const counted: MarkerEntry = { ...head, path: (ctx) => { built++; return head.path(ctx); } };
    const dispose = registerMarker(counted);
    try {
      markerReach(at(3));
      markerReach(at(3));
      markerReach(at(3, 5));
      expect(built).toBe(1);
    } finally {
      dispose();
    }
  });
});
