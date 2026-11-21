import { describe, expect, it } from 'vitest';
import { measureMenuPanel, menuPanelMetrics, menuRowAtY, menuRowSpans, MENU_MIN_WIDTH } from './menuPanel';
import { exactly, UNBOUNDED, type MeasureEnv } from './measure';

const TOKENS: Record<string, string> = {
  '--wzl-control-h-sm': '24px', '--wzl-space-1': '2px', '--wzl-space-2': '4px', '--wzl-space-8': '16px', '--wzl-font-size': '10px',
  '--wzl-leading-snug': '1.2',
};
const env: MeasureEnv = {
  token: (n) => TOKENS[n],
  text: (t) => ({ width: t.length * 5, ascent: 8, descent: 2 }),
};

describe('menuPanelMetrics', () => {
  it('reads the tokens the DOM menu is laid out with, its border inside the inset', () => {
    const m = menuPanelMetrics(env);
    expect([m.rowHeight, m.inset, m.padX, m.padY, m.gap, m.labelPad, m.separatorHeight, m.minWidth, m.iconSize, m.font.size])
      .toEqual([24, 5, 9, 5, 4, 16, 5, MENU_MIN_WIDTH, 16, 10]);
    expect(m.lineHeight).toBeCloseTo(12);
  });
});

describe('measureMenuPanel', () => {
  const label = 'L'.repeat(40);
  const face = {
    rows: [
      { kind: 'row' as const, label },
      { kind: 'separator' as const },
      { kind: 'row' as const, label: 'Undo', trailing: '⌘Z' },
      { kind: 'row' as const, label: 'More', trailing: 10 },
    ],
  };

  it('stacks rows and separators inside the inset, as wide as the widest row', () => {
    const m = measureMenuPanel(face, UNBOUNDED, env);
    // 9 + 16 + 4 + 200 + 16 + 4 + 0 + 9.
    expect(m.width).toBe(258);
    expect(m.height).toBe(5 + 24 + 5 + 24 + 24 + 5);
    expect(m.layout.rows.map((r) => r.rect.y)).toEqual([5, 29, 34, 58]);
    const sep = m.layout.rows[1]!;
    expect(sep.kind === 'separator' && sep.line).toEqual({ x: 5, y: 31, width: 248, height: 1 });
    // The first line's baseline: 1px half-leading in its 12px line, 6px down a 24px row, 8 ascent.
    expect(m.baseline).toBeCloseTo(5 + 6 + 1 + 8);
  });

  it('puts the icon, the label, and the trailing part in their columns, the trailing one against the end', () => {
    const m = measureMenuPanel(face, exactly(300, 87), env);
    const undo = m.layout.rows[2]!;
    if (undo.kind !== 'row') throw new Error('a row');
    expect(undo.rect).toEqual({ x: 5, y: 34, width: 290, height: 24 });
    expect(undo.icon).toEqual({ x: 9, y: 38, width: 16, height: 16 });
    expect(undo.label.x).toBe(29);
    expect(undo.trailing).toEqual({ x: 300 - 9 - 10, y: 34, width: 10, height: 24 });
    expect(undo.label.x + undo.label.width + 4).toBe(undo.trailing!.x);
  });

  it('is never narrower than the minimum width, and with no rows is its inset alone', () => {
    const m = measureMenuPanel({ rows: [] }, UNBOUNDED, env);
    expect([m.width, m.height]).toEqual([MENU_MIN_WIDTH, 10]);
    expect(measureMenuPanel({ rows: [{ kind: 'row', label: 'A' }] }, UNBOUNDED, env).width).toBe(MENU_MIN_WIDTH);
  });

  it('finds the line under a point, and none in the inset', () => {
    const spans = menuRowSpans(face.rows, menuPanelMetrics(env));
    expect([2, 5, 30, 34, 81, 82].map((y) => menuRowAtY(spans, y))).toEqual([null, 0, 1, 2, 3, null]);
  });
});

describe('a current row', () => {
  const weighted: MeasureEnv = {
    token: (n) => ({ ...TOKENS, '--wzl-font-weight-bold': '700' })[n],
    text: (t, f) => ({ width: t.length * ((f.weight ?? 400) >= 700 ? 6 : 5), ascent: 8, descent: 2 }),
  };
  const label = 'L'.repeat(40);

  it('is measured at --wzl-font-weight-bold, as the DOM draws it', () => {
    expect(menuPanelMetrics(weighted).currentFont).toMatchObject({ size: 10, weight: 700 });
    const plain = measureMenuPanel({ rows: [{ kind: 'row', label }] }, UNBOUNDED, weighted);
    const current = measureMenuPanel({ rows: [{ kind: 'row', label, current: true }] }, UNBOUNDED, weighted);
    expect(current.width - plain.width).toBe(40);
  });

  it('falls back to 700 where the theme sets no bold weight', () => {
    expect(menuPanelMetrics(env).currentFont.weight).toBe(700);
  });
});
