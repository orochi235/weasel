import { describe, expect, it } from 'vitest';
import { clocked } from '../pbt.fixture';

describe('timelines, shrunk from the property tests', () => {
  it('fire no event a seek left the playhead on when the next frame plays backward', () => {
    const h = clocked();
    const fired: number[] = [];
    const tl = h.animator.timeline({ duration: 400, tracks: [{ kind: 'event', events: [{ t: 0, fire: () => { fired.push(0); } }] }] });
    h.at(0);
    expect(fired).toEqual([0]);
    tl.seek(0);
    tl.setTimeScale(-0.5);
    h.at(1);
    expect(fired).toEqual([0]);
    expect(tl.time()).toBe(0);
  });

  it('keep an endless timeline\'s playhead finite where its laps pass the double range', () => {
    const h = clocked();
    h.at(-Number.MAX_VALUE);
    const tl = h.animator.timeline({ duration: 3, loop: true, tracks: [] });
    h.at(Number.MAX_VALUE);
    h.at(Number.MAX_VALUE);
    expect(tl.time()).toBeGreaterThanOrEqual(0);
    expect(tl.time()).toBeLessThanOrEqual(3);
    tl.seek(Number.MAX_VALUE);
    expect(tl.time()).toBeGreaterThanOrEqual(0);
    expect(tl.time()).toBeLessThanOrEqual(3);
  });

  it('seek a timeline of infinite duration to where it is asked', () => {
    const h = clocked();
    h.at(0);
    const tl = h.animator.timeline({ duration: Infinity, loop: 2, tracks: [] });
    tl.seek(3);
    expect(tl.time()).toBe(3);
    h.at(10);
    expect(tl.time()).toBe(13);
  });
});
