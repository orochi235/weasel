import { describe, it, expect } from 'vitest';
import { frameStatsOf } from './frameStats';

describe('frameStatsOf', () => {
  it('adds each layer\'s build time to its dispatch time and takes its draw calls', () => {
    const stats = frameStatsOf(
      [{ id: 'scene', start: 0, end: 2, buildMs: 1 }, { id: 'overlay', start: 2, end: 3, buildMs: 0.5 }],
      { drawCalls: 5, ms: 2, spans: [{ id: 'scene', drawCalls: 4, ms: 1.5 }, { id: 'overlay', drawCalls: 1, ms: 0.25 }] },
      4,
    );
    expect(stats).toEqual({
      paintMs: 4,
      drawCalls: 5,
      layers: [{ id: 'scene', drawCalls: 4, ms: 2.5 }, { id: 'overlay', drawCalls: 1, ms: 0.75 }],
    });
  });
});
