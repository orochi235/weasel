import { describe, expect, it } from 'vitest';
import type { Clip, ClipKey, ClipSampledTrack } from '@weasel-js/animator';
import { pathFromD } from '@weasel-js/core';
import type { SvgPathNode, SvgStroke } from '../types';
import { dashTracksOf, trimEdgesOf } from './trim';

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

  it('rests an edge with no track where restOf puts it', () => {
    const { clip } = dashTracksOf(clipOf({ 'a.trim.end': [{ t: 0, value: 0.5 }, { t: 1000, value: 1 }] }), () => [0.25, 1]);
    expect(keysOf(clip, 'a.stroke-dasharray')).toEqual([{ t: 0, value: [0.25, 1.0001] }, { t: 1000, value: [0.75, 1.0001] }]);
    expect(keysOf(clip, 'a.stroke-dashoffset')).toEqual([{ t: 0, value: -0.25 }, { t: 1000, value: -0.25 }]);
  });
});

describe('trimEdgesOf', () => {
  const node = (trim?: SvgStroke['trim']): SvgPathNode => ({
    kind: 'path', path: pathFromD('M0 0 L30 0 L30 10'), fill: { kind: 'none' }, stroke: { paint: { kind: 'solid', color: '#000' }, width: 1, trim },
  } as SvgPathNode);

  it("reads a node's own trim as fractions of its length, by distance, anchor or default", () => {
    expect(trimEdgesOf(node())).toEqual([0, 1]);
    expect(trimEdgesOf(node({ start: 0.25 }))).toEqual([0.25, 1]);
    expect(trimEdgesOf(node({ start: { length: 10 }, end: { anchor: 1 } }))).toEqual([0.25, 0.75]);
  });
});
