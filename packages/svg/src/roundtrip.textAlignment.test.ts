import { describe, it, expect } from 'vitest';
import { parseSvg, serializeSvg, type SvgNode } from './index';
import { registerBidi, resolveAlign } from '@weasel-js/core';

describe('text direction', () => {
  const VIEW = { viewBox: { x: 0, y: 0, width: 200, height: 100 } };
  const ser = (style: Record<string, unknown>) => serializeSvg(
    [{ id: 't1', kind: 'text', x: 0, y: 0, width: 100, height: 20, text: 'AB', style }] as unknown as SvgNode[],
    VIEW,
  );

  it('writes direction="rtl" and keeps a reading-order start relative', () => {
    const out = ser({ align: 'start', direction: 'rtl' });
    expect(out).toContain('direction="rtl"');
    // SVG's text-anchor is reading-order relative too, so a reading-order
    // start stays `start` there rather than becoming the absolute edge.
    expect(out).not.toContain('text-anchor="end"');
  });

  it('writes no direction for ltr', () => {
    expect(ser({ align: 'left' })).not.toContain('direction=');
  });

  it('round-trips an rtl alignment to the same rendered edge', () => {
    const out = ser({ align: 'start', direction: 'rtl' });
    const back = parseSvg(out).nodes[0] as { style?: Record<string, unknown> };
    expect(back.style?.direction).toBe('rtl');
    expect(resolveAlign(back.style?.align as never, 'rtl')).toBe('right');
  });
});

describe('text with no stated direction', () => {
  const VIEW = { viewBox: { x: 0, y: 0, width: 200, height: 100 } };
  /** Stands in for a bidi engine that reads every paragraph right to left. */
  const RTL_ENGINE = {
    analyze: () => null,
    reorder: (_a: unknown, start: number, end: number) => ({
      order: Array.from({ length: end - start }, (_, i) => end - 1 - i),
      levels: new Uint8Array(end - start).fill(1),
    }),
    mirror: () => null,
    baseLevel: () => 1,
  };
  const ser = (style: Record<string, unknown>) => serializeSvg(
    [{ id: 't1', kind: 'text', x: 0, y: 0, width: 100, height: 20, text: 'AB', style }] as unknown as SvgNode[],
    VIEW,
  );

  it('writes the direction its text reads in, and anchors `start` at that edge', () => {
    const unregister = registerBidi(RTL_ENGINE);
    try {
      const out = ser({ align: 'start' });
      expect(out).toContain('direction="rtl"');
      expect(out).toContain('x="100"');
      expect(out).not.toContain('text-anchor=');
    } finally {
      unregister();
    }
  });

  it('writes a stated ltr, which would otherwise read back as the text\'s own', () => {
    const out = ser({ align: 'left', direction: 'ltr' });
    expect(out).toContain('direction="ltr"');
    const back = parseSvg(out).nodes[0] as { style?: Record<string, unknown> };
    expect(back.style?.direction).toBe('ltr');
    expect(parseSvg(ser({ align: 'left' })).nodes[0]).not.toHaveProperty('style.direction');
  });

  it('reads another writer\'s text with no direction as ltr, which is what SVG means by it', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20">
      <text x="0" y="10">hi</text>
    </svg>`;
    const t = parseSvg(svg).nodes[0];
    if (t.kind !== 'text') throw new Error('expected text');
    expect(t.style?.direction).toBe('ltr');
  });

  it('reads left to right with no engine registered', () => {
    const out = ser({ align: 'start' });
    expect(out).not.toContain('direction=');
    expect(out).toContain('x="0"');
  });
});

describe('text vertical alignment', () => {
  const VIEW = { viewBox: { x: 0, y: 0, width: 200, height: 100 } };
  const text = (verticalAlign?: 'top' | 'center' | 'bottom'): SvgNode => ({
    kind: 'text', x: 10, y: 20, width: 100, height: 60, text: 'Mid',
    ...(verticalAlign ? { verticalAlign } : {}),
  });

  it.each(['center', 'bottom'] as const)('round-trips %s', (va) => {
    const out = serializeSvg([text(va)], VIEW);
    expect(out).toContain(`data-weasel-vertical-align="${va}"`);
    const back = parseSvg(out).nodes[0];
    if (back.kind !== 'text') throw new Error('expected text');
    expect(back.verticalAlign).toBe(va);
    expect(back.y).toBe(20);
  });

  it('writes nothing for top or an absent alignment, and reads either back as absent', () => {
    for (const node of [text('top'), text()]) {
      const out = serializeSvg([node], VIEW);
      expect(out).not.toContain('data-weasel-vertical-align');
      const back = parseSvg(out).nodes[0];
      if (back.kind !== 'text') throw new Error('expected text');
      expect(back.verticalAlign).toBeUndefined();
    }
  });
});
