import { describe, expect, it } from 'vitest';
import type { Clip, ClipKey, ClipSampledTrack } from '@weasel-js/animator';
import { dashTracksOf } from './trim';

const clipOf = (tracks: Record<string, ClipKey[]>): Clip => ({
  version: 1, tracks: Object.entries(tracks).map(([target, keys]) => ({ kind: 'sampled', target, keys })),
});
const keysOf = (clip: Clip, target: string) => (clip.tracks.find((t) => (t as ClipSampledTrack).target === target) as ClipSampledTrack | undefined)?.keys;

describe('dashTracksOf', () => {
  it('keys both edges at the union of their times, sampling the edge with no key there', () => {
    const { clip, trimmed } = dashTracksOf(clipOf({
      'a.trim.start': [{ t: 0, value: 0 }, { t: 1000, value: 0.5 }],
      'a.trim.end': [{ t: 0, value: 0.5 }, { t: 500, value: 0.5 }, { t: 1000, value: 1 }],
      'a.opacity': [{ t: 0, value: 1 }],
    }));
    expect(keysOf(clip, 'a.stroke-dasharray')).toEqual([
      { t: 0, value: [0.5, 1.0001] }, { t: 500, value: [0.25, 1.0001] }, { t: 1000, value: [0.5, 1.0001] },
    ]);
    expect(keysOf(clip, 'a.stroke-dashoffset')).toEqual([{ t: 0, value: -0 }, { t: 500, value: -0.25 }, { t: 1000, value: -0.5 }]);
    expect(keysOf(clip, 'a.trim.start')).toBeUndefined();
    expect(keysOf(clip, 'a.opacity')).toEqual([{ t: 0, value: 1 }]);
    expect([...trimmed]).toEqual(['a']);
  });

  it('keeps an edge\'s easing where it alone moves over a whole key segment', () => {
    const ease = { bezier: [0.4, 0, 0.2, 1] as [number, number, number, number] };
    const { clip } = dashTracksOf(clipOf({ 'a.trim.end': [{ t: 0, value: 0 }, { t: 1000, value: 1, easing: ease }] }));
    expect(keysOf(clip, 'a.stroke-dasharray')?.[1]).toEqual({ t: 1000, value: [1, 1.0001], easing: ease });
    expect(keysOf(clip, 'a.stroke-dashoffset')?.[1]).toEqual({ t: 1000, value: -0 });
  });

  it('writes a jump in an edge as two keys at one time', () => {
    const { clip } = dashTracksOf(clipOf({ 'a.trim.end': [{ t: 0, value: 0 }, { t: 500, value: 0 }, { t: 500, value: 0.5 }] }));
    expect(keysOf(clip, 'a.stroke-dasharray')).toEqual([
      { t: 0, value: [0, 1.0001] }, { t: 500, value: [0, 1.0001] }, { t: 500, value: [0.5, 1.0001] },
    ]);
    expect(keysOf(clip, 'a.visibility')).toEqual([{ t: 0, value: 'hidden' }, { t: 500, value: 'hidden' }, { t: 500, value: 'visible' }]);
  });
});
