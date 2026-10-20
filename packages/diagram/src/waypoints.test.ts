import { describe, expect, it } from 'vitest';
import { bezier, orthogonal, straight } from './edge';
import type { Port } from './types';
import {
  dragSegment, dragVertex, insertWaypoint, removeSegment, removeWaypoint, routeHandles, simplifyStops,
} from './waypoints';

const port = (x: number, y: number, nx: number, ny: number): Port => ({
  id: 'p', nodeId: 'n', point: { x, y }, normal: { x: nx, y: ny },
});
const EAST = port(100, 20, 1, 0);
const WEST = port(300, 20, -1, 0);

describe('routeHandles', () => {
  it('puts a dot on each waypoint and a hollow dot in the middle of each leg of a straight route', () => {
    const stops = [EAST.point, { x: 200, y: 100 }, WEST.point];
    const drawn = straight({ from: EAST, to: WEST, waypoints: [stops[1]!] });
    expect(routeHandles(drawn, stops, straight)).toEqual([
      { kind: 'vertex', index: 0, at: { x: 200, y: 100 } },
      { kind: 'insert', leg: 0, at: { x: 150, y: 60 } },
      { kind: 'insert', leg: 1, at: { x: 250, y: 60 } },
    ]);
  });

  it('finds a bezier leg\'s middle on the drawn curve, not on the chord', () => {
    const stops = [EAST.point, { x: 200, y: 100 }, WEST.point];
    const north = port(100, 20, 0, -1);
    const drawn = bezier({ from: north, to: WEST, waypoints: [stops[1]!] });
    const handles = routeHandles(drawn, stops, bezier);
    expect(handles.map((h) => h.kind)).toEqual(['vertex', 'insert', 'insert']);
    const leg = handles[1]!;
    // The curve leaves heading north, away from the waypoint, so its middle is off the chord's.
    expect(Math.hypot(leg.at.x - 150, leg.at.y - 60)).toBeGreaterThan(5);
    expect(drawn.some((p) => Math.hypot(p.x - leg.at.x, p.y - leg.at.y) < 10)).toBe(true);
  });

  it('puts a bar on the middle of each segment of an orthogonal route', () => {
    const to = port(300, 120, -1, 0);
    const drawn = orthogonal({ from: EAST, to, waypoints: [] });
    expect(drawn).toEqual([{ x: 100, y: 20 }, { x: 200, y: 20 }, { x: 200, y: 120 }, { x: 300, y: 120 }]);
    expect(routeHandles(drawn, [EAST.point, to.point], orthogonal)).toEqual([
      { kind: 'segment', index: 0, axis: 'x', at: { x: 150, y: 20 } },
      { kind: 'segment', index: 1, axis: 'y', at: { x: 200, y: 70 } },
      { kind: 'segment', index: 2, axis: 'x', at: { x: 250, y: 120 } },
    ]);
  });
});

describe('waypoint edits', () => {
  const stops = [{ x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }];

  it('moves, inserts and removes waypoints, answering the new waypoints', () => {
    expect(dragVertex(stops, 0, { x: 60, y: 70 })).toEqual([{ x: 60, y: 70 }]);
    expect(insertWaypoint(stops, 1, { x: 80, y: 30 })).toEqual([{ x: 50, y: 50 }, { x: 80, y: 30 }]);
    expect(insertWaypoint(stops, 0, { x: 20, y: 30 })).toEqual([{ x: 20, y: 30 }, { x: 50, y: 50 }]);
    expect(removeWaypoint(stops, 0)).toEqual([]);
  });
});

describe('dragSegment', () => {
  // East port at (100, 20), west port at (300, 120): out 100, down 100, in 100.
  const drawn = [{ x: 100, y: 20 }, { x: 200, y: 20 }, { x: 200, y: 120 }, { x: 300, y: 120 }];

  it('slides a middle segment across its axis and writes every bend as a waypoint', () => {
    expect(dragSegment(drawn, 1, 40)).toEqual([{ x: 240, y: 20 }, { x: 240, y: 120 }]);
  });

  it('gives a segment touching a port a jog, so the port end stays square', () => {
    const waypoints = dragSegment(drawn, 0, 30);
    expect(waypoints).toEqual([{ x: 116, y: 20 }, { x: 116, y: 50 }, { x: 200, y: 50 }, { x: 200, y: 120 }]);
    // The router draws exactly that route back.
    const route = orthogonal({ from: EAST, to: port(300, 120, -1, 0), waypoints });
    expect(route).toEqual([drawn[0], ...waypoints, drawn[3]]);
  });

  it('jogs at both ends of a route that is one segment', () => {
    const line = [{ x: 100, y: 20 }, { x: 300, y: 20 }];
    expect(dragSegment(line, 0, -40)).toEqual([
      { x: 116, y: 20 }, { x: 116, y: -20 }, { x: 284, y: -20 }, { x: 284, y: 20 },
    ]);
  });

  it('keeps a jog no longer than half a short segment', () => {
    const short = [{ x: 100, y: 20 }, { x: 110, y: 20 }, { x: 110, y: 120 }, { x: 300, y: 120 }];
    expect(dragSegment(short, 0, 30)[0]).toEqual({ x: 105, y: 20 });
  });

  it('slides back onto the line it left and leaves no bends behind', () => {
    const jogged = [{ x: 100, y: 20 }, { x: 116, y: 20 }, { x: 116, y: 50 }, { x: 200, y: 50 }, { x: 200, y: 120 }, { x: 300, y: 120 }];
    expect(dragSegment(jogged, 1, 84)).toEqual([{ x: 200, y: 20 }, { x: 200, y: 120 }]);
  });
});

describe('removeSegment', () => {
  it('straightens a jog by sliding the neighbor that touches no port onto the other', () => {
    const jogged = [{ x: 100, y: 20 }, { x: 116, y: 20 }, { x: 116, y: 50 }, { x: 200, y: 50 }, { x: 200, y: 120 }, { x: 300, y: 120 }];
    expect(removeSegment(jogged, 1)).toEqual([{ x: 200, y: 20 }, { x: 200, y: 120 }]);
  });

  it('refuses a segment whose neighbors both touch a port and do not line up', () => {
    const z = [{ x: 100, y: 20 }, { x: 200, y: 20 }, { x: 200, y: 120 }, { x: 300, y: 120 }];
    expect(removeSegment(z, 1)).toBeNull();
  });

  it('refuses a segment at either end of the route', () => {
    const z = [{ x: 100, y: 20 }, { x: 200, y: 20 }, { x: 200, y: 120 }, { x: 300, y: 120 }];
    expect(removeSegment(z, 0)).toBeNull();
    expect(removeSegment(z, 2)).toBeNull();
  });
});

describe('simplifyStops', () => {
  it('drops duplicate stops and stops in a straight line between their neighbors', () => {
    expect(simplifyStops([
      { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 100, y: 50 },
    ])).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }]);
  });

  it('keeps a stop where the route doubles back on itself', () => {
    expect(simplifyStops([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 }])).toEqual([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 0 },
    ]);
  });
});
