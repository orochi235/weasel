import { describe, expect, it } from 'vitest';
import type { Clip, ClipKey } from '@weasel-js/animator';
import { pathFromD } from '@weasel-js/geom';
import type { SvgNode } from '@weasel-js/svg';
import type { LottieGroup, LottieTrim } from './types';
import { writeLottie } from './write';

const path = (id: string, d = 'M0 0 L50 0', extra: Partial<SvgNode> = {}): SvgNode => ({
  kind: 'path', id, path: pathFromD(d), fill: { kind: 'none' }, stroke: { paint: { kind: 'solid', color: '#ff0000' }, width: 2 }, ...extra,
} as SvgNode);
const clipOf = (tracks: Record<string, ClipKey[]>, extra: Partial<Clip> = {}): Clip => ({
  version: 1, tracks: Object.entries(tracks).map(([target, keys]) => ({ kind: 'sampled', target, keys })), loop: true, ...extra,
});
const itemsOf = (group: LottieGroup, ty: string) => group.it.filter((item) => item.ty === ty);

describe('writeLottie', () => {
  it('writes one shape layer per path, the last drawn first, on a canvas the size of the drawing', () => {
    const anim = writeLottie([path('a', 'M10 10 L50 10'), path('b', 'M10 10 L10 40')], clipOf({}, { duration: 1000 }));
    expect(anim).toMatchObject({ v: '5.12.0', fr: 60, ip: 0, op: 60, w: 41, h: 31 });
    expect(anim.layers.map((l) => [l.nm, l.ty, l.ip, l.op])).toEqual([['b', 4, 0, 60], ['a', 4, 0, 60]]);
    expect(anim.layers[0].ks.p.k).toEqual([-9, -9]);
  });

  it('writes a square as one closed path of four vertices, its stroke and its group transform', () => {
    const anim = writeLottie([path('sq', 'M0 0 L10 0 L10 10 L0 10 Z', { fill: { kind: 'solid', color: '#0000ff', opacity: 0.5 } } as Partial<SvgNode>)], clipOf({}));
    const [group] = anim.layers[0].shapes;
    expect(group.it.map((i) => i.ty)).toEqual(['sh', 'st', 'fl', 'tr']);
    const [sh] = itemsOf(group, 'sh');
    expect(sh).toMatchObject({ ks: { a: 0, k: { c: true } } });
    expect((sh as { ks: { k: { v: unknown[] } } }).ks.k.v).toHaveLength(4);
    expect(itemsOf(group, 'st')[0]).toMatchObject({ c: { a: 0, k: [1, 0, 0, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 2 }, lc: 1, lj: 1 });
    expect(itemsOf(group, 'fl')[0]).toMatchObject({ c: { a: 0, k: [0, 0, 1, 1] }, o: { a: 0, k: 50 }, r: 1 });
  });

  it('writes an open polyline as an open path', () => {
    const [group] = writeLottie([path('a', 'M0 0 L10 0 L10 10')], clipOf({})).layers[0].shapes;
    expect(itemsOf(group, 'sh')[0]).toMatchObject({ ks: { k: { c: false } } });
  });

  it('writes a letter with a counter as two paths in one group', () => {
    const anim = writeLottie([path('o', 'M0 0 L30 0 L30 30 L0 30 Z M10 10 L10 20 L20 20 L20 10 Z')], clipOf({}));
    expect(anim.layers[0].shapes).toHaveLength(1);
    expect(itemsOf(anim.layers[0].shapes[0], 'sh')).toHaveLength(2);
  });

  it('writes trim keys as a tm item in percent, trimming as one, eased by each key\'s easing', () => {
    const anim = writeLottie([path('a')], clipOf({
      'a.trim.start': [{ t: 0, value: 0.2 }],
      'a.trim.end': [{ t: 0, value: 0.2 }, { t: 1000, value: 0.6, easing: { bezier: [0.4, 0, 0.2, 1] } }],
    }));
    const tm = itemsOf(anim.layers[0].shapes[0], 'tm')[0] as LottieTrim;
    expect(tm).toMatchObject({ m: 2, s: { a: 0, k: 20 }, o: { a: 0, k: 0 } });
    expect(tm.e).toEqual({
      a: 1,
      k: [{ t: 0, s: [20], o: { x: [0.4], y: [0] }, i: { x: [0.2], y: [1] } }, { t: 60, s: [60] }],
    });
  });

  it('writes a jump, two keys at one time, as a hold keyframe', () => {
    const anim = writeLottie([path('a')], clipOf({
      'a.opacity': [{ t: 0, value: 0 }, { t: 500, value: 0 }, { t: 500, value: 1 }, { t: 1000, value: 1 }],
    }));
    expect(anim.layers[0].ks.o.k).toEqual([
      { t: 0, s: [0], o: { x: [0], y: [0] }, i: { x: [1], y: [1] } },
      { t: 30, s: [0], h: 1 },
      { t: 30, s: [100], o: { x: [0], y: [0] }, i: { x: [1], y: [1] } },
      { t: 60, s: [100] },
    ]);
  });

  it('writes a single end step as a hold, and inserts keyframes for an easing Lottie has no form for', () => {
    const anim = writeLottie([path('a'), path('b')], clipOf({
      'a.opacity': [{ t: 0, value: 0 }, { t: 1000, value: 1, easing: { steps: 1 } }],
      'b.opacity': [{ t: 0, value: 0 }, { t: 1000, value: 1, easing: { linear: [0, [0.8, 0.5], 1] } }],
    }));
    const [b, a] = anim.layers;
    expect(a.ks.o.k).toEqual([{ t: 0, s: [0], h: 1 }, { t: 60, s: [100] }]);
    expect((b.ks.o.k as { t: number; s: number[] }[]).map((k) => [k.t, k.s[0]])).toEqual([[0, 0], [30, 80], [60, 100]]);
  });

  it('converts key times to frames at the given fps', () => {
    const anim = writeLottie([path('a')], clipOf({ 'a.opacity': [{ t: 0, value: 0 }, { t: 500, value: 1 }] }), { fps: 30 });
    expect(anim).toMatchObject({ fr: 30, op: 15 });
    expect((anim.layers[0].ks.o.k as { t: number }[]).map((k) => k.t)).toEqual([0, 15]);
  });

  it('warns once for an id no node has, and skips its tracks', () => {
    const warnings: string[] = [];
    const anim = writeLottie([path('a')], clipOf({
      'zz.opacity': [{ t: 0, value: 0 }, { t: 1000, value: 1 }], 'zz.trim.end': [{ t: 0, value: 0 }, { t: 1000, value: 1 }],
    }), { onWarn: (m) => warnings.push(m) });
    expect(warnings).toEqual(['the clip moves #zz, which no node has; its tracks are skipped']);
    expect(anim.layers[0].ks.o).toEqual({ a: 0, k: 100 });
  });

  it('warns that a clip which does not loop will, as Lottie players loop by default', () => {
    const warnings: string[] = [];
    writeLottie([path('a')], clipOf({}, { loop: false }), { onWarn: (m) => warnings.push(m) });
    expect(warnings).toEqual(['the clip plays once, but Lottie has no field for how often an animation plays and players loop by default']);
  });

  it('skips a gradient paint with a warning', () => {
    const warnings: string[] = [];
    const node = path('g', 'M0 0 L10 0 L10 10 Z', { fill: { kind: 'gradient', paint: {} } } as Partial<SvgNode>);
    const [group] = writeLottie([node], clipOf({}), { onWarn: (m) => warnings.push(m) }).layers[0].shapes;
    expect(itemsOf(group, 'fl')).toEqual([]);
    expect(warnings).toEqual(['#g has a gradient fill, which this writer does not write; it is skipped']);
  });

  it('bakes a group\'s transform into the geometry and its opacity into the layer\'s', () => {
    const group = { kind: 'group', opacity: 0.5, transform: [1, 0, 0, 1, 5, 0], children: [path('a', 'M0 0 L10 0')] } as SvgNode;
    const [layer] = writeLottie([group], clipOf({ 'a.opacity': [{ t: 0, value: 1 }, { t: 1000, value: 0 }] })).layers;
    expect(itemsOf(layer.shapes[0], 'sh')[0]).toMatchObject({ ks: { k: { v: [[5, 0], [15, 0]] } } });
    expect((layer.ks.o.k as { s: number[] }[]).map((k) => k.s[0])).toEqual([50, 0]);
  });

  it('trims a path with a counter as one: both paths in one group, then a tm laying them end to end', () => {
    const anim = writeLottie([path('o', 'M0 0 L30 0 L30 30 L0 30 Z M10 10 L10 20 L20 20 L20 10 Z')], clipOf({
      'o.trim.end': [{ t: 0, value: 0 }, { t: 1000, value: 1 }],
    }));
    const [group, ...rest] = anim.layers[0].shapes;
    expect(rest).toEqual([]);
    expect(group.it.map((i) => i.ty)).toEqual(['sh', 'sh', 'st', 'tm', 'tr']);
    expect(itemsOf(group, 'tm')[0]).toMatchObject({ m: 2 });
  });

  it('keeps a trim off the fill, as SVG trims only the stroke', () => {
    const node = path('a', 'M0 0 L10 0 L10 10 Z', { fill: { kind: 'solid', color: '#000' } } as Partial<SvgNode>);
    const shapes = writeLottie([node], clipOf({ 'a.trim.end': [{ t: 0, value: 0 }, { t: 1000, value: 1 }] })).layers[0].shapes;
    expect(shapes.map((g) => g.it.map((i) => i.ty))).toEqual([['sh', 'st', 'tm', 'tr'], ['sh', 'fl', 'tr']]);
  });
});
