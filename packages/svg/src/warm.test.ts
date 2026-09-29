import { afterEach, describe, expect, it, vi } from 'vitest';
import { asPaint, getPaintKind, registerFont, registerPaintKindLoader, type FillStyle } from '@weasel-js/core';
import type { SvgNode } from './types';
import { svgNeeds, warmSvg } from './warm';

afterEach(() => { vi.restoreAllMocks(); });

const RECT = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 } as const;

const linear = asPaint({
  fill: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 10, y: 0 },
  stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
});
const mesh = { fill: 'mesh-gradient', patches: [] } as unknown as FillStyle;
const late = (id: string) => ({ fill: id }) as unknown as FillStyle;

function box(paint: FillStyle): SvgNode {
  return { kind: 'path', path: RECT, fill: { kind: 'gradient', paint } };
}

function text(runs: NonNullable<Extract<SvgNode, { kind: 'text' }>['runs']>, extra = {}): SvgNode {
  return { kind: 'text', x: 0, y: 0, width: 10, height: 10, text: runs.map((r) => r.text).join(''), runs, ...extra };
}

/** A loader standing in for a lazily loaded kind, and its disposer. */
function lazyKind(id: string, fail = false) {
  const load = vi.fn(async () => {
    if (fail) throw new Error(`${id} is offline`);
    return { id, label: id, seed: () => late(id), colorOf: () => undefined };
  });
  return { load, dispose: registerPaintKindLoader(id, load) };
}

describe('svgNeeds', () => {
  it('lists the kinds of fills and strokes, run paints included, through nested groups', () => {
    const nodes: SvgNode[] = [
      {
        kind: 'group',
        children: [{
          kind: 'group',
          children: [{
            kind: 'path', path: RECT, fill: { kind: 'none' },
            stroke: { paint: { kind: 'gradient', paint: late('test-stroke') }, width: 1 },
          } as SvgNode],
        }],
      },
      box(linear),
      text([{ text: 'a', fill: late('test-run') }], { fill: late('test-text') }),
    ];
    expect(svgNeeds(nodes).paintKinds).toEqual(['test-stroke', 'linear-gradient', 'test-text', 'test-run']);
  });

  it('skips a paint the writer puts inline as a color', () => {
    const nodes = [text([{ text: 'a', fill: asPaint({ fill: 'solid', color: '#f00' }) }])];
    expect(svgNeeds(nodes).paintKinds).toEqual([]);
  });

  it('lists the face of a run whose script size the writer reads off font metrics, and no other', () => {
    const nodes: SvgNode[] = [
      text([
        { text: 'x', fontFamily: 'plain' },
        { text: '2', script: 'super', fontFamily: 'keyword' },
        { text: 'n', script: 'sub', baselineShift: -0.3, fontFamily: 'metric', bold: true },
      ]),
    ];
    expect(svgNeeds(nodes).fonts).toEqual([{ family: 'metric', weight: 700, style: 'normal' }]);
  });

  it('loads nothing by asking', () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    void registerFont('svg-needs-lazy', {}, '/lazy.json', '/lazy.png', { lazy: true }).catch(() => {});
    svgNeeds([text([{ text: '2', script: 'super', baselineShift: 0.4, fontFamily: 'svg-needs-lazy' }])]);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('warmSvg', () => {
  it('loads a used mesh kind', async () => {
    expect(getPaintKind('mesh-gradient')).toBeUndefined();
    await warmSvg([{ kind: 'group', children: [box(mesh)] }]);
    expect(getPaintKind('mesh-gradient')).toBeDefined();
  });

  it('never loads a kind the nodes do not use', async () => {
    const unused = lazyKind('test-unused');
    try {
      await warmSvg([box(linear)]);
      expect(unused.load).not.toHaveBeenCalled();
    } finally {
      unused.dispose();
    }
  });

  it('is not broken by an unrelated kind that fails to load', async () => {
    const broken = lazyKind('test-broken', true);
    const used = lazyKind('test-used');
    try {
      await expect(warmSvg([box(late('test-used'))])).resolves.toBeUndefined();
      expect(used.load).toHaveBeenCalledTimes(1);
      expect(broken.load).not.toHaveBeenCalled();
    } finally {
      broken.dispose();
      used.dispose();
    }
  });

  it('rejects when a kind the nodes use fails to load', async () => {
    const broken = lazyKind('test-used-broken', true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(warmSvg([box(late('test-used-broken'))])).rejects.toThrow(/offline/);
    } finally {
      broken.dispose();
    }
  });

  it('passes over a kind nothing registered, which the export warns about instead', async () => {
    await expect(warmSvg([box(late('test-nobody'))])).resolves.toBeUndefined();
  });

  it('loads the face a script run is sized from, and not one that is merely named', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    void registerFont('svg-warm-metric', {}, '/metric.json', '/metric.png', { lazy: true }).catch(() => {});
    void registerFont('svg-warm-plain', {}, '/plain.json', '/plain.png', { lazy: true }).catch(() => {});
    await warmSvg([text([
      { text: 'x', fontFamily: 'svg-warm-plain' },
      { text: '2', script: 'super', baselineShift: 0.4, fontFamily: 'svg-warm-metric' },
    ])]).catch(() => {});
    const urls = fetch.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain('/metric.json');
    expect(urls).not.toContain('/plain.json');
  });
});
