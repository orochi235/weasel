import { describe, expect, it } from 'vitest';
import { createHandoffs, type HandoffHost, type Placed } from './handoffs';

/** A host whose clock the test sets, over one animation running at its own rate 1. */
function host() {
  const h = { elapsed: 0, wall: 0, pace: 1 };
  const entry = { id: 1 };
  const host = {
    ctx: null as never,
    table: {
      animations: new Map([[1, entry]]),
      clockOf: () => h.elapsed,
      rateOf: () => 1,
      on: () => [],
      retire: () => {},
    } as unknown as HandoffHost['table'],
    pace: () => h.pace,
    wall: () => h.wall,
    elapsed: () => h.elapsed,
  };
  const placements: number[] = [];
  const animation = {
    set startTime(t: number) { placements.push(t); },
    playbackRate: 1,
    pause() {},
    currentTime: 0,
  } as unknown as Animation;
  const run: Placed = { id: 1, animation, offset: 0 };
  return { h, handoffs: createHandoffs(host), run, placements };
}

describe('keeping handed-off runs on the animator clock', () => {
  it('leaves the browser alone while the two clocks keep pace', () => {
    const { h, handoffs, run, placements } = host();
    handoffs.add(run);
    handoffs.place(run);
    for (let i = 1; i <= 10; i++) { h.elapsed = i * 16; h.wall = i * 16; handoffs.frame(); }
    expect(placements).toHaveLength(1);
  });

  it('places every run again where the animator clock jumped, as a seek does', () => {
    const { h, handoffs, run, placements } = host();
    handoffs.add(run);
    handoffs.place(run);
    h.elapsed = 500;
    h.wall = 16;
    handoffs.frame();
    expect(placements).toEqual([0, 16 - 500]);
  });

  it('places them again after time unseen, which the animator charges to nothing', () => {
    const { h, handoffs, run, placements } = host();
    handoffs.add(run);
    handoffs.place(run);
    h.elapsed = 16;
    h.wall = 16;
    handoffs.frame();
    handoffs.resumed();
    h.wall = 60_000;
    handoffs.frame();
    expect(placements).toEqual([0, 60_000 - 16]);
  });

  it('places them again when the pace changes, as a ramp of an outside clock does', () => {
    const { h, handoffs, run, placements } = host();
    handoffs.add(run);
    h.pace = 2;
    h.elapsed = 32;
    h.wall = 16;
    handoffs.frame();
    expect(placements).toHaveLength(1);
  });
});
