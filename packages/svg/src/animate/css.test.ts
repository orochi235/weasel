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

  it('writes two keys at one time as a jump, the later key just after the earlier', () => {
    const out = serializeCssAnimatedSvg([path('a')], clipOf({
      'a.opacity': [{ t: 0, value: 0 }, { t: 500, value: 0 }, { t: 500, value: 1 }, { t: 1000, value: 1 }],
    }));
    expect(keyframes(out, 'a-opacity')).toMatch(/ 50% \{ opacity: 0;[^}]*\} 50.0001% \{ opacity: 1;/);
  });

  it('writes a jump at the end with the earlier key just before 100%', () => {
    const out = serializeCssAnimatedSvg([path('a')], clipOf({
      'a.opacity': [{ t: 0, value: 0 }, { t: 1000, value: 0 }, { t: 1000, value: 1 }],
    }));
    expect(keyframes(out, 'a-opacity')).toMatch(/ 99.9999% \{ opacity: 0;[^}]*\} 100% \{ opacity: 1 \}$/);
  });

  it('hides the stroke through a span where the trim is empty', () => {
    const out = serializeCssAnimatedSvg([path('a')], clipOf({
      'a.trim.start': [{ t: 0, value: 0.2 }], 'a.trim.end': [{ t: 0, value: 0.2 }, { t: 500, value: 0.2 }, { t: 1000, value: 0.6 }],
    }));
    expect(keyframes(out, 'a-visibility').replace(/; animation-timing-function: linear/g, ''))
      .toBe(' 0% { visibility: hidden } 50% { visibility: hidden } 50.0001% { visibility: visible } 100% { visibility: visible }');
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

  it('warns once for, and skips, a property the element cannot take, and a target naming none', () => {
    const warnings: string[] = [];
    const out = serializeCssAnimatedSvg([path('a')], clipOf({
      'a.r': [{ t: 0, value: 1 }, { t: 1000, value: 5 }], nodot: [{ t: 0, value: 1 }, { t: 1000, value: 5 }],
    }), { onWarn: (m) => warnings.push(m) });
    expect(warnings).toEqual(['a.r moves r, which CSS cannot animate on a path; it is skipped', 'nodot names no property after its node id; it is skipped']);
    expect(out).not.toContain('@keyframes');
  });

  it('gives a length its px, and path data its path()', () => {
    const out = serializeCssAnimatedSvg([path('a')], clipOf({
      'a.stroke-width': [{ t: 0, value: 1 }, { t: 1000, value: 3 }], 'a.d': [{ t: 0, value: 'M0 0L5 0' }, { t: 1000, value: 'M0 0L9 0' }],
    }));
    expect(keyframes(out, 'a-stroke-width')).toMatch(/0% \{ stroke-width: 1px;.*100% \{ stroke-width: 3px \}/);
    expect(keyframes(out, 'a-d')).toContain('d: path("M0 0L5 0")');
  });

  it('shows a viewer asking for reduced motion each property at its end, by a later rule', () => {
    const clip = clipOf({ 'a.trim.end': [{ t: 0, value: 0 }, { t: 1000, value: 1 }], 'a.opacity': [{ t: 0, value: 0.5 }] });
    expect(serializeCssAnimatedSvg([path('a')], clip)).not.toContain('prefers-reduced-motion');
    const out = serializeCssAnimatedSvg([path('a')], clip, { reducedMotion: 'end' });
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{ (.*) \}$/.exec(out.split('</style>')[0])?.[1];
    expect(reduced).toBe('#a { animation: none; stroke-dasharray: 1 1.0001; stroke-dashoffset: 0; visibility: visible }');
    expect(out.indexOf('#a { opacity: 0.5; animation:')).toBeLessThan(out.indexOf('@media'));
  });

  it("rests an edge with no track at the node's own trim, and drops the node's own trim and dash", () => {
    const warnings: string[] = [];
    const own = { ...path('a'), stroke: { paint: { kind: 'solid', color: '#000' }, width: 2, trim: { start: 0.25, end: 0 }, dash: [4, 2] } } as SvgNode;
    const out = serializeCssAnimatedSvg([own], clipOf({ 'a.trim.end': [{ t: 0, value: 0.5 }, { t: 1000, value: 1 }] }), { onWarn: (m) => warnings.push(m) });
    expect(keyframes(out, 'a-stroke-dashoffset')).toContain('stroke-dashoffset: -0.25');
    expect(keyframes(out, 'a-stroke-dasharray')).toMatch(/^ 0% \{ stroke-dasharray: 0.25 1.0001;/);
    expect(out).toMatch(/<path id="a" [^>]*pathLength="1"/);
    expect(out).not.toMatch(/stroke-dasharray="/);
    expect(warnings).toEqual(["#a's stroke has dashes, which this writer does not write; the stroke is written without"]);
  });

  it('skips with a warning a trim on a node not written as one path', () => {
    const warnings: string[] = [];
    const group = { kind: 'group', id: 'g', children: [path('a')] } as SvgNode;
    const filled = { ...path('f'), stroke: undefined, fill: { kind: 'solid', color: '#000' } } as SvgNode;
    const out = serializeCssAnimatedSvg([group, filled], clipOf({
      'g.trim.end': [{ t: 0, value: 0 }, { t: 1000, value: 1 }], 'f.trim.end': [{ t: 0, value: 0 }, { t: 1000, value: 1 }],
    }), { onWarn: (m) => warnings.push(m) });
    expect(warnings).toEqual([
      "#g's trim is drawn as a dash along one <path>, but the node is a group; its trim tracks are skipped",
      "#f's trim tracks move a stroke it does not have; they are skipped",
    ]);
    expect(out).not.toContain('pathLength');
  });

  it('reads back as the clip it wrote, trim as the dash it lowered to', () => {
    const clip = clipOf({
      'a.opacity': [{ t: 0, value: 0 }, { t: 500, value: 1, easing: { bezier: [0.4, 0, 0.2, 1] } }, { t: 1000, value: 0.25 }],
      'b.trim.start': [{ t: 0, value: 0 }, { t: 1000, value: 0.5 }],
      'b.trim.end': [{ t: 0, value: 0.25 }, { t: 1000, value: 1 }],
      'c.opacity': [{ t: 0, value: 0 }, { t: 500, value: 0 }, { t: 500, value: 1 }, { t: 1000, value: 1 }],
    });
    const parsed = parseSvg(serializeCssAnimatedSvg([path('a'), path('b'), path('c')], clip));
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
