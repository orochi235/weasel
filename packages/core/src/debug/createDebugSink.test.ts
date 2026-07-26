import { describe, it, expect } from 'vitest';
import { createDebugSink } from './createDebugSink';

describe('createDebugSink', () => {
  it('records when feature flag is on', () => {
    const sink = createDebugSink({ bounds: true, origins: true });
    sink.recordBounds('a', { x: 0, y: 0, width: 10, height: 10 });
    sink.recordOrigin('a', { x: 5, y: 5 });
    const s = sink.snapshot();
    expect(s.bounds).toHaveLength(1);
    expect(s.origins).toHaveLength(1);
  });

  it('no-ops when feature flag is off', () => {
    const sink = createDebugSink({ bounds: true });
    sink.recordOrigin('a', { x: 5, y: 5 });
    sink.recordHandle('a', { x: 0, y: 0 }, 'corner');
    sink.recordHitbox('a', 'body', { kind: 'rect', x: 0, y: 0, width: 1, height: 1 });
    sink.recordSnapCandidate({ x: 0, y: 0 }, true);
    sink.recordLayer('scene', 'Scene', 'world', 0);
    const s = sink.snapshot();
    expect(s.origins).toHaveLength(0);
    expect(s.handles).toHaveLength(0);
    expect(s.hitboxes).toHaveLength(0);
    expect(s.snap).toHaveLength(0);
    expect(s.layers).toHaveLength(0);
  });

  it('beginFrame clears every non-snap array but preserves snap', () => {
    const sink = createDebugSink({
      hitboxes: true, handles: true, bounds: true, origins: true, snap: true, layers: true,
    });
    sink.recordHitbox('a', 'body', { kind: 'rect', x: 0, y: 0, width: 1, height: 1 });
    sink.recordHandle('a', { x: 0, y: 0 }, 'corner');
    sink.recordBounds('a', { x: 0, y: 0, width: 1, height: 1 });
    sink.recordOrigin('a', { x: 0, y: 0 });
    sink.recordSnapCandidate({ x: 0, y: 0 }, true);
    sink.recordLayer('scene', 'Scene', 'world', 0);
    sink.beginFrame();
    const s = sink.snapshot();
    expect(s.hitboxes).toHaveLength(0);
    expect(s.handles).toHaveLength(0);
    expect(s.bounds).toHaveLength(0);
    expect(s.origins).toHaveLength(0);
    expect(s.layers).toHaveLength(0);
    expect(s.snap).toHaveLength(1);
  });

  it('clearSnap clears only the snap array', () => {
    const sink = createDebugSink({ snap: true, bounds: true });
    sink.recordSnapCandidate({ x: 0, y: 0 }, true);
    sink.recordBounds('a', { x: 0, y: 0, width: 1, height: 1 });
    sink.clearSnap();
    const s = sink.snapshot();
    expect(s.snap).toHaveLength(0);
    expect(s.bounds).toHaveLength(1);
  });
});
