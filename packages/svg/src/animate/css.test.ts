import { describe, expect, it } from 'vitest';
import { sampleTrack, type Clip, type ClipKey, type ClipSampledTrack, type SampledTrack } from '@weasel-js/animator';
import { pathFromD } from '@weasel-js/core';
import { parseSvg } from '../parse';
import type { SvgNode } from '../types';
import { serializeCssAnimatedSvg } from './css';
import { dashTracksOf } from './trim';

const path = (id: string, d = 'M0 0 L50 0'): SvgNode => ({
  kind: 'path', id, path: pathFromD(d), fill: { kind: 'none' }, stroke: { paint: { kind: 'solid', color: '#000' }, width: 2 },
} as SvgNode);
const clipOf = (tracks: Record<string, ClipKey[]>, extra: Partial<Clip> = {}): Clip => ({
  version: 1, tracks: Object.entries(tracks).map(([target, keys]) => ({ kind: 'sampled', target, keys })), ...extra,
});
const keyframes = (out: string, name: string): string => new RegExp(`@keyframes ${name} \\{(.*?) \\}(?=\\n|$)`).exec(out)?.[1] ?? '';
const trackIn = (clip: Clip | undefined, target: string) => clip?.tracks.find((t) => (t as ClipSampledTrack).target === target) as ClipSampledTrack;
const at = (track: ClipSampledTrack, t: number) => sampleTrack({ kind: 'sampled', keys: track.keys } as SampledTrack<unknown>, t);

describe('serializeCssAnimatedSvg', () => {
  it('writes one animation per node and property, keyed by percent of the duration', () => {
    const out = serializeCssAnimatedSvg([path('a')], clipOf({ 'a.opacity': [{ t: 0, value: 0 }, { t: 1000, value: 1 }] }));
    expect(out).toMatch(/#a \{ animation: a-opacity 1000ms linear 1 both \}/);
    expect(keyframes(out, 'a-opacity')).toBe(' 0% { opacity: 0; animation-timing-function: linear } 100% { opacity: 1 }');
  });

  it('eases each keyframe by the easing of the key after it, and repeats as the clip loops', () => {
    const out = serializeCssAnimatedSvg([path('a')], clipOf({
      'a.opacity': [{ t: 0, value: 0 }, { t: 400, value: 1, easing: { bezier: [0.4, 0, 0.2, 1] } }, { t: 800, value: 0 }],
    }, { loop: true, duration: 800 }));
    expect(out).toContain('animation: a-opacity 800ms linear infinite both');
    expect(keyframes(out, 'a-opacity')).toContain('0% { opacity: 0; animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1) } 50% { opacity: 1; animation-timing-function: linear }');
  });

  it('lowers a trim to a dash on pathLength="1"', () => {
    const out = serializeCssAnimatedSvg([path('a')], clipOf({
      'a.trim.start': [{ t: 0, value: 0.2 }], 'a.trim.end': [{ t: 0, value: 0.2 }, { t: 1000, value: 0.6 }],
    }));
    expect(out).toMatch(/<path id="a" [^>]*pathLength="1"/);
    const dash = keyframes(out, 'a-stroke-dasharray');
    expect(dash).toMatch(/0% \{ stroke-dasharray: 0 1.0001;.*100% \{ stroke-dasharray: 0.4 1.0001 \}/);
    expect(keyframes(out, 'a-stroke-dashoffset')).toContain('stroke-dashoffset: -0.2');
  });

  it('writes two keys at one time as two selectors at one percentage, in key order', () => {
    const out = serializeCssAnimatedSvg([path('a')], clipOf({
      'a.opacity': [{ t: 0, value: 0 }, { t: 500, value: 0 }, { t: 500, value: 1 }, { t: 1000, value: 1 }],
    }));
    expect(keyframes(out, 'a-opacity')).toMatch(/50% \{ opacity: 0;[^}]*\} 50% \{ opacity: 1;/);
  });

  it('hides the stroke through a span where the trim is empty', () => {
    const out = serializeCssAnimatedSvg([path('a')], clipOf({
      'a.trim.start': [{ t: 0, value: 0.2 }], 'a.trim.end': [{ t: 0, value: 0.2 }, { t: 500, value: 0.2 }, { t: 1000, value: 0.6 }],
    }));
    expect(keyframes(out, 'a-visibility').replace(/; animation-timing-function: linear/g, ''))
      .toBe(' 0% { visibility: hidden } 50% { visibility: hidden } 50% { visibility: visible } 100% { visibility: visible }');
  });

  it('writes no visibility for a trim that is never empty', () => {
    const out = serializeCssAnimatedSvg([path('a')], clipOf({ 'a.trim.end': [{ t: 0, value: 0.5 }, { t: 1000, value: 1 }] }));
    expect(out).not.toContain('visibility');
  });

  it('warns once for an id no node has, and skips its tracks', () => {
    const warnings: string[] = [];
    const out = serializeCssAnimatedSvg([path('a')], clipOf({
      'zz.opacity': [{ t: 0, value: 0 }, { t: 1000, value: 1 }], 'zz.fill-opacity': [{ t: 0, value: 0 }, { t: 1000, value: 1 }],
    }), { onWarn: (m) => warnings.push(m) });
    expect(warnings).toEqual(['the clip moves #zz, which no node has; its tracks are skipped']);
    expect(out).not.toContain('zz');
  });

  it('carries one dash over every subpath of a path', () => {
    const out = serializeCssAnimatedSvg([path('a', 'M0 0 L50 0 M0 10 L50 10')], clipOf({ 'a.trim.end': [{ t: 0, value: 0 }, { t: 1000, value: 1 }] }));
    expect(out.match(/<path /g)).toHaveLength(1);
    expect(out.match(/pathLength="1"/g)).toHaveLength(1);
  });

  it('writes a one-key track, or a clip of no duration, as a static value', () => {
    const out = serializeCssAnimatedSvg([path('a')], clipOf({ 'a.opacity': [{ t: 0, value: 0.5 }] }));
    expect(out).toContain('#a { opacity: 0.5 }');
    expect(out).not.toContain('@keyframes');
  });

  it('holds the first and last values out to 0% and 100%', () => {
    const out = serializeCssAnimatedSvg([path('a')], clipOf({ 'a.opacity': [{ t: 250, value: 0 }, { t: 500, value: 1 }] }, { duration: 1000 }));
    expect(keyframes(out, 'a-opacity')).toMatch(/^ 0% \{ opacity: 0;.*25% \{ opacity: 0;.*50% \{ opacity: 1;.*100% \{ opacity: 1 \}$/);
  });

  it('reads back as the clip it wrote, trim as the dash it lowered to', () => {
    const clip = clipOf({
      'a.opacity': [{ t: 0, value: 0 }, { t: 500, value: 1, easing: { bezier: [0.4, 0, 0.2, 1] } }, { t: 1000, value: 0.25 }],
      'b.trim.start': [{ t: 0, value: 0 }, { t: 1000, value: 0.5 }],
      'b.trim.end': [{ t: 0, value: 0.25 }, { t: 1000, value: 1 }],
    });
    const parsed = parseSvg(serializeCssAnimatedSvg([path('a'), path('b')], clip));
    const back = parsed.clip;
    const lowered = dashTracksOf(clip).clip;
    for (const target of ['a.opacity', 'b.stroke-dasharray', 'b.stroke-dashoffset']) {
      for (const t of [0, 250, 500, 1000]) {
        const want = at(trackIn(lowered, target), t);
        const got = at(trackIn(back, target), t);
        expect([target, t, got]).toEqual([target, t, Array.isArray(want) ? want.map((w: number) => expect.closeTo(w, 6)) : expect.closeTo(want as number, 6)]);
      }
    }
    expect(parsed.warnings).toEqual([]);
  });
});
