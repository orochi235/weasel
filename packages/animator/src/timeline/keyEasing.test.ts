import { describe, expect, it } from 'vitest';
import { EASINGS } from '@weasel-js/geom';
import { bindClip, toClip, type Clip } from './clip';
import { resolveKeyEasing } from './keyEasing';
import { sampleTrack } from './sampleTrack';
import type { SampledTrack } from './types';

const stepped = (jump?: 'start' | 'end'): SampledTrack<number> => ({
  kind: 'sampled',
  keys: [{ t: 0, value: 0 }, { t: 1000, value: 100, easing: { steps: 4, jump } }],
});

describe('a key eased by blits steps', () => {
  it('holds each step for its quarter, as CSS steps() does', () => {
    const track = stepped();
    expect([0, 240, 250, 999, 1000].map((t) => sampleTrack(track, t))).toEqual([0, 0, 25, 75, 100]);
  });

  it('takes its first step at the start with jump start', () => {
    expect(sampleTrack(stepped('start'), 1)).toBe(25);
  });

  it('resolves through blits, and names and beziers through geom', () => {
    expect(resolveKeyEasing({ steps: 2 })(0.6)).toBe(0.5);
    expect(resolveKeyEasing('linear')(0.3)).toBe(0.3);
    expect(resolveKeyEasing({ bezier: [0, 0, 1, 1] })(0.5)).toBeCloseTo(0.5);
    expect(resolveKeyEasing()(0.4)).toBe(0.4);
  });
});

describe('a clip with blits easings and a loop', () => {
  const clip: Clip = {
    version: 1,
    loop: 3,
    tracks: [{ kind: 'sampled', keys: [{ t: 0, value: 0 }, { t: 1000, value: 100, easing: { steps: 4, jump: 'start' } }] }],
  };

  it('binds them, the loop beside the tracks', () => {
    const bound = bindClip(JSON.parse(JSON.stringify(clip)) as Clip, {});
    expect(bound.loop).toBe(3);
    expect((bound.tracks[0] as SampledTrack<number>).keys[1].easing).toEqual({ steps: 4, jump: 'start' });
  });

  it('writes them back as they were bound, through JSON', () => {
    expect(JSON.parse(JSON.stringify(toClip(bindClip(clip, {}))))).toEqual(clip);
  });

  it('writes no loop for a timeline that has none', () => {
    expect('loop' in toClip({ tracks: [] })).toBe(false);
  });

  it('refuses, naming the key, an easing that is neither a name nor an object', () => {
    const bad = { ...clip, tracks: [{ kind: 'sampled', keys: [{ t: 0, value: 0 }, { t: 9, value: 1, easing: 5 }] }] };
    expect(() => bindClip(bad as never, {})).toThrow("bindClip: track 0's key 1's easing is neither an easing name nor an easing object.");
  });

  it('refuses a loop that is not true, false or a count', () => {
    expect(() => bindClip({ ...clip, loop: 'twice' } as never, {})).toThrow("bindClip: the clip's loop is neither true, false nor a count.");
  });
});

describe('a named easing', () => {
  it('plays every geom name within 0.003 of geom\'s curve', () => {
    for (const [name, exact] of Object.entries(EASINGS)) {
      const played = resolveKeyEasing(name as keyof typeof EASINGS);
      for (let i = 0; i <= 100; i++) expect(Math.abs(played(i / 100) - exact(i / 100)), name).toBeLessThanOrEqual(0.003);
    }
  });

  it('throws on a name geom does not have', () => {
    expect(() => resolveKeyEasing('nope' as never)).toThrow(/unknown easing name "nope"/);
  });
});
