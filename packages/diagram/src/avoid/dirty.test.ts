import { describe, expect, it } from 'vitest';
import { edgeBetween, rectShape } from './avoidFixture';
import { dirtyEdges, fullRoute, stopsKey } from './dirty';

const a = rectShape('a', 0, 0);
const b = rectShape('b', 400, 0);
/** A connector with no route, bent down through a stop well below both shapes. */
const pathless = { ...edgeBetween('ab', a, b), waypoints: [{ x: 250, y: 300 }] };

describe('fullRoute', () => {
  it('runs a connector holding no route through its waypoints, as its fallback draws it', () => {
    const full = fullRoute(pathless);
    expect(full).toContainEqual({ x: 250, y: 300 });
    // Each end leaves by the port facing the stop, as the edge draws it.
    expect(full[0]).toEqual({ x: 50, y: 60 });
    expect(full[full.length - 1]).toEqual({ x: 450, y: 60 });
  });

  it('dirties a connector with no route when an obstacle moves onto the line through its waypoints', () => {
    const keys = new Map([['ab', stopsKey(pathless)]]);
    const wall = { x: 230, y: 280, width: 40, height: 40 };
    const dirty = dirtyEdges([pathless], keys, { ids: new Set(['wall']), boxes: [wall] }, (e) => [fullRoute(e)], new Set(['ab']));
    expect(dirty.map((e) => e.id)).toEqual(['ab']);
  });
});
