import { describe, expect, it } from 'vitest';
import { sampleTrack, type Clip, type ClipKey, type ClipSampledTrack, type SampledTrack } from '@weasel-js/animator';
import { pathFromD } from '@weasel-js/core';
import { parseSvg } from '../parse';
import type { SvgNode } from '../types';
import { serializeSmilAnimatedSvg } from './smil';
import { dashTracksOf } from './trim';

const path = (id: string, d = 'M0 0 L50 0'): SvgNode => ({
  kind: 'path', id, path: pathFromD(d), fill: { kind: 'none' }, stroke: { paint: { kind: 'solid', color: '#000' }, width: 2 },
} as SvgNode);
const clipOf = (tracks: Record<string, ClipKey[]>, extra: Partial<Clip> = {}): Clip => ({
  version: 1, tracks: Object.entries(tracks).map(([target, keys]) => ({ kind: 'sampled', target, keys })), ...extra,
});
/** The `<animate>` or `<set>` for `attribute`, its attributes by name. */
const animateOf = (out: string, attribute: string): Record<string, string> | undefined => {
  const el = new RegExp(`<(?:animate|set) attributeName="${attribute}"[^>]*/>`).exec(out)?.[0];
  return el === undefined ? undefined : Object.fromEntries([...el.matchAll(/ ([\w-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
};
const trackIn = (clip: Clip | undefined, target: string) => clip?.tracks.find((t) => (t as ClipSampledTrack).target === target) as ClipSampledTrack;
const at = (track: ClipSampledTrack, t: number) => sampleTrack({ kind: 'sampled', keys: track.keys } as SampledTrack<unknown>, t);

describe('serializeSmilAnimatedSvg', () => {
  it('writes one animate per node and attribute, inside its element, keyed by fraction of the duration', () => {
    const out = serializeSmilAnimatedSvg([path('a')], clipOf({ 'a.opacity': [{ t: 0, value: 0 }, { t: 1000, value: 1 }] }));
    expect(out).toMatch(/<path id="a"[^>]*><animate attributeName="opacity" [^>]*\/><\/path>/);
    expect(animateOf(out, 'opacity')).toEqual({
      attributeName: 'opacity', values: '0;1', keyTimes: '0;1', dur: '1000ms', repeatCount: '1', fill: 'freeze',
    });
  });

  it('repeats as the clip loops, and holds the first and last values out to the ends', () => {
    const out = serializeSmilAnimatedSvg([path('a')], clipOf({ 'a.opacity': [{ t: 250, value: 0 }, { t: 500, value: 1 }] }, { loop: true, duration: 1000 }));
    expect(animateOf(out, 'opacity')).toMatchObject({ values: '0;0;1;1', keyTimes: '0;0.25;0.5;1', repeatCount: 'indefinite' });
  });

  it('lowers a trim to a dash on pathLength="1"', () => {
    const out = serializeSmilAnimatedSvg([path('a')], clipOf({
      'a.trim.start': [{ t: 0, value: 0.2 }], 'a.trim.end': [{ t: 0, value: 0.2 }, { t: 1000, value: 0.6 }],
    }));
    expect(out).toMatch(/<path id="a" [^>]*pathLength="1"/);
    expect(animateOf(out, 'stroke-dasharray')).toMatchObject({ values: '0 1.0001;0.4 1.0001', keyTimes: '0;1' });
    expect(animateOf(out, 'stroke-dashoffset')?.values).toBe('-0.2;-0.2');
    expect(animateOf(out, 'visibility')).toMatchObject({ values: 'hidden;visible;visible', keyTimes: '0;0;1' });
  });

  it('writes two keys at one time as a jump, at equal keyTimes', () => {
    const out = serializeSmilAnimatedSvg([path('a')], clipOf({
      'a.opacity': [{ t: 0, value: 0 }, { t: 500, value: 0 }, { t: 500, value: 1 }, { t: 1000, value: 1 }],
    }));
    expect(animateOf(out, 'opacity')).toMatchObject({ values: '0;0;1;1', keyTimes: '0;0.5;0.5;1' });
  });

  it('warns once for an id no node has, and skips its tracks', () => {
    const warnings: string[] = [];
    const out = serializeSmilAnimatedSvg([path('a')], clipOf({
      'zz.opacity': [{ t: 0, value: 0 }, { t: 1000, value: 1 }], 'zz.fill-opacity': [{ t: 0, value: 0 }, { t: 1000, value: 1 }],
    }), { onWarn: (m) => warnings.push(m) });
    expect(warnings).toEqual(['the clip moves #zz, which no node has; its tracks are skipped']);
    expect(out).not.toContain('zz');
    expect(out).not.toContain('<animate');
  });

  it('writes a bezier key as a spline, with one keySplines entry per span', () => {
    const out = serializeSmilAnimatedSvg([path('a')], clipOf({
      'a.opacity': [{ t: 0, value: 0 }, { t: 400, value: 1, easing: { bezier: [0.4, 0, 0.2, 1] } }, { t: 800, value: 0 }],
    }));
    expect(animateOf(out, 'opacity')).toMatchObject({ calcMode: 'spline', keyTimes: '0;0.5;1', keySplines: '0.4 0 0.2 1;0 0 1 1' });
  });

  it('writes a track that only steps as discrete', () => {
    const out = serializeSmilAnimatedSvg([path('a')], clipOf({
      'a.opacity': [{ t: 0, value: 0 }, { t: 500, value: 1, easing: { steps: 1 } }, { t: 1000, value: 0, easing: { steps: 1 } }],
    }));
    expect(animateOf(out, 'opacity')).toMatchObject({ calcMode: 'discrete', values: '0;1;0', keyTimes: '0;0.5;1' });
  });

  it('writes a step beside a linear span as a hold and a jump', () => {
    const out = serializeSmilAnimatedSvg([path('a')], clipOf({
      'a.opacity': [{ t: 0, value: 0 }, { t: 500, value: 1, easing: { steps: 1 } }, { t: 1000, value: 0 }],
    }));
    const animate = animateOf(out, 'opacity');
    expect(animate?.calcMode).toBeUndefined();
    expect(animate).toMatchObject({ values: '0;0;1;0', keyTimes: '0;0.5;0.5;1' });
  });

  it('inserts the points of an easing SMIL has no form for', () => {
    const out = serializeSmilAnimatedSvg([path('a')], clipOf({
      'a.opacity': [{ t: 0, value: 0 }, { t: 1000, value: 1, easing: { linear: [[0.2, 0.25], [0.8, 0.75]] } }],
    }));
    expect(animateOf(out, 'opacity')).toMatchObject({ values: '0;0.2;0.2;0.8;0.8;1', keyTimes: '0;0;0.25;0.75;1;1' });
  });

  it('writes a one-key track, or a clip of no duration, as a set', () => {
    const out = serializeSmilAnimatedSvg([path('a')], clipOf({ 'a.opacity': [{ t: 0, value: 0.5 }] }));
    expect(out).toContain('<set attributeName="opacity" to="0.5" fill="freeze"/>');
    expect(out).not.toContain('<animate');
  });

  it('writes a color as rgba', () => {
    const out = serializeSmilAnimatedSvg([path('a')], clipOf({ 'a.stroke': [{ t: 0, value: [1, 0, 0, 1] }, { t: 1000, value: [0, 0, 1, 0.5] }] }));
    expect(animateOf(out, 'stroke')?.values).toBe('rgba(255, 0, 0, 1);rgba(0, 0, 255, 0.5)');
  });

  it('warns for, and skips, a value a SMIL values list cannot hold', () => {
    const warnings: string[] = [];
    const out = serializeSmilAnimatedSvg([path('a')], clipOf({ 'a.font-family': [{ t: 0, value: 'a;b' }, { t: 1000, value: 'c' }] }), { onWarn: (m) => warnings.push(m) });
    expect(warnings).toEqual(['#a.font-family holds a value with a ";", which a SMIL values list cannot; it is skipped']);
    expect(out).not.toContain('<animate');
  });

  it("keeps the caller's own decoration", () => {
    const out = serializeSmilAnimatedSvg([path('a')], clipOf({ 'a.opacity': [{ t: 0, value: 0 }, { t: 1000, value: 1 }] }), {
      decorate: { attrsOf: () => ({ 'data-x': '1' }), childrenOf: () => '<desc>d</desc>' },
    });
    expect(out).toMatch(/<path id="a" [^>]*data-x="1"[^>]*><desc>d<\/desc><animate /);
  });

  it('reads back as the clip it wrote, trim as the dash it lowered to', () => {
    const clip = clipOf({
      'a.opacity': [{ t: 0, value: 0 }, { t: 500, value: 1, easing: { bezier: [0.4, 0, 0.2, 1] } }, { t: 1000, value: 0.25 }],
      'b.trim.start': [{ t: 0, value: 0 }, { t: 1000, value: 0.5 }],
      'b.trim.end': [{ t: 0, value: 0.25 }, { t: 1000, value: 1 }],
      'c.opacity': [{ t: 0, value: 0 }, { t: 500, value: 0 }, { t: 500, value: 1 }, { t: 1000, value: 1 }],
    });
    const parsed = parseSvg(serializeSmilAnimatedSvg([path('a'), path('b'), path('c')], clip));
    const back = parsed.clip;
    const lowered = dashTracksOf(clip).clip;
    for (const target of ['a.opacity', 'b.stroke-dasharray', 'b.stroke-dashoffset']) {
      for (const t of [0, 250, 500, 1000]) {
        const want = at(trackIn(lowered, target), t);
        const got = at(trackIn(back, target), t);
        expect([target, t, got]).toEqual([target, t, Array.isArray(want) ? want.map((w: number) => expect.closeTo(w, 6)) : expect.closeTo(want as number, 6)]);
      }
    }
    const jump = trackIn(back, 'c.opacity');
    expect([at(jump, 499.99), at(jump, 500.01)]).toEqual([0, 1]);
    expect(parsed.warnings).toEqual([]);
  });
});
