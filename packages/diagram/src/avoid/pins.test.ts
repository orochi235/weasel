import { describe, expect, it } from 'vitest';
import { avoid } from '../edge';
import { pinSegment, routeHandles, unpinSegment } from '../waypoints';

const P = (x: number, y: number) => ({ x, y });
// Port at (100, 20) facing east, over a wall, to a port at (500, 20) facing west.
const drawn = [P(100, 20), P(150, 20), P(150, -100), P(450, -100), P(450, 20), P(500, 20)];
const stops = [P(100, 20), P(500, 20)];

describe('pinning a segment of an avoid route', () => {
  it('shows a bar on every segment, as an orthogonal route does', () => {
    expect(routeHandles(drawn, stops, avoid).map((h) => h.kind)).toEqual(['segment', 'segment', 'segment', 'segment', 'segment']);
  });

  it('pins only the dragged segment: its two ends become the waypoints', () => {
    expect(pinSegment(drawn, stops, 2, -30)).toEqual([P(150, -130), P(450, -130)]);
  });

  it('places the pinned pair among the waypoints in route order', () => {
    const withStop = [P(100, 20), P(450, 20), P(500, 20)];
    expect(pinSegment(drawn, withStop, 2, -30)).toEqual([P(150, -130), P(450, -130), P(450, 20)]);
    const before = [P(100, 20), P(150, 20), P(500, 20)];
    expect(pinSegment(drawn, before, 2, -30)).toEqual([P(150, 20), P(150, -130), P(450, -130)]);
  });

  it('moves a waypoint at the segment’s end rather than pinning beside it', () => {
    const atEnd = [P(100, 20), P(150, -100), P(500, 20)];
    expect(pinSegment(drawn, atEnd, 2, -30)).toEqual([P(150, -130), P(450, -130)]);
  });

  it('keeps a port square when the dragged segment meets it', () => {
    const pinned = pinSegment(drawn, stops, 0, 40);
    expect(pinned[0]!.y).toBe(60);
    expect(pinned[0]!.x).toBeGreaterThan(100);
  });

  it('unpins a segment by dropping the waypoints at its ends, and declines when there are none', () => {
    const pinned = [P(100, 20), P(150, -100), P(450, -100), P(500, 20)];
    expect(unpinSegment(drawn, pinned, 2)).toEqual([]);
    expect(unpinSegment(drawn, stops, 2)).toBeNull();
  });
});
