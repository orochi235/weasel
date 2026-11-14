import { describe, expect, it } from 'vitest';
import { formatShortcut } from '@weasel-js/gestures';
import type { DrawCommand } from '@weasel-js/core/renderer';
import type { MenuEntry } from '@weasel-js/menu';
import type { HudDrawCtx } from '../widget';
import { drawPanel, panelSize } from './drawPanel';
import { charEnv, menuTokens, THEME_METRICS as m } from './menu.fixture';

const ctx = {
  dims: { width: 800, height: 600 }, defaultFont: 'Inter',
  tokens: menuTokens({
    '--wzl-surface-popover': '#222', '--wzl-surface-hover': '#333', '--wzl-fg': '#eee',
    '--wzl-fg-muted': '#888', '--wzl-border': '#444', '--wzl-shadow': 'rgba(0, 0, 0, 0.6)', '--wzl-radius-md': '6px',
    '--wzl-bevel-raised': '0 8px 24px var(--wzl-shadow)',
  }),
  color: () => undefined,
} as never as HudDrawCtx;

const run = () => {};
const b = { x: 100, y: 50, w: 240, h: 80 };
const env = charEnv(7);
const shortcut = { key: 'z', mod: true, alt: false, shift: true };

const texts = (cmds: readonly DrawCommand[]) =>
  cmds.flatMap((c) => (c.kind === 'text' ? [c] : []));
const strokes = (cmds: readonly DrawCommand[]) =>
  cmds.flatMap((c) => (c.kind === 'path' && c.stroke && !c.fill ? [c] : []));

describe('drawPanel', () => {
  it('draws a check in the icon column for a checked row, and none for an unchecked one', () => {
    const on: MenuEntry = { kind: 'item', key: 'on', label: 'Grid', checked: true, run };
    const off: MenuEntry = { kind: 'item', key: 'off', label: 'Grid', checked: false, run };
    const checks = strokes(drawPanel(ctx, b, [on], null));
    expect(checks).toHaveLength(1);
    const path = checks[0]!.kind === 'path' ? checks[0]!.path : null;
    const xs = path?.kind === 'polygon' ? [...path.coords].filter((_, i) => i % 2 === 0) : [];
    expect(xs.length).toBeGreaterThan(0);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(b.x + m.padX);
    expect(Math.max(...xs)).toBeLessThanOrEqual(b.x + m.padX + m.iconSize);
    expect(strokes(drawPanel(ctx, b, [off], null))).toHaveLength(0);
  });

  it('draws a row\'s shortcut, formatted as the DOM menu formats it, at the row\'s end in the muted color', () => {
    const e: MenuEntry = { kind: 'item', key: 'redo', label: 'Redo', shortcut, run };
    const [label, chip] = texts(drawPanel(ctx, b, [e], null));
    expect(label!.runs.map((r) => r.text).join('')).toBe('Redo');
    expect(chip!.runs.map((r) => r.text).join('')).toBe(formatShortcut(shortcut));
    expect(chip!.align).toBe('right');
    expect(chip!.x + chip!.width!).toBe(b.x + b.w - m.padX);
    expect(JSON.stringify(chip!.runs)).toContain('#888');
  });

  it('draws a graded row\'s label in its grade\'s color, and a disabled one muted all the same', () => {
    const graded = { ...ctx, tokens: { ...ctx.tokens, '--wzl-danger': '#f00' } } as HudDrawCtx;
    const del: MenuEntry = { kind: 'item', key: 'del', label: 'Delete', grade: 'danger', run };
    const off: MenuEntry = { ...del, disabled: true };
    expect(JSON.stringify(texts(drawPanel(graded, b, [del], null))[0]!.runs)).toContain('#f00');
    expect(JSON.stringify(texts(drawPanel(graded, b, [off], null))[0]!.runs)).toContain('#888');
    const { '--wzl-danger': _, ...noGrade } = ctx.tokens as Record<string, string>;
    const ungraded = { ...ctx, tokens: noGrade } as never as HudDrawCtx;
    expect(JSON.stringify(texts(drawPanel(ungraded, b, [del], null))[0]!.runs)).toContain('#eee');
  });

  it('draws a string shortcut as written', () => {
    const e: MenuEntry = { kind: 'item', key: 'lock', label: 'Lock', shortcut: 'Hold L', run };
    const [, chip] = texts(drawPanel(ctx, b, [e], null));
    expect(chip!.runs.map((r) => r.text).join('')).toBe('Hold L');
  });

  it('widens the panel to fit a label and its shortcut', () => {
    const label = 'L'.repeat(30);
    const plain: MenuEntry = { kind: 'item', key: 'a', label, run };
    const chip: MenuEntry = { kind: 'item', key: 'a', label, shortcut, run };
    const text = formatShortcut(shortcut)!;
    const columns = m.padX * 2 + m.iconSize + m.gap * 2;
    expect(panelSize([chip], env).w).toBe(columns + label.length * 7 + text.length * 7);
    expect(panelSize([plain], env).w).toBe(columns + label.length * 7);
  });

  it('rounds the panel by --wzl-radius-md and casts a shadow in --wzl-shadow beneath it', () => {
    const e: MenuEntry = { kind: 'item', key: 'a', label: 'A', run };
    const cmds = drawPanel(ctx, b, [e], null);
    const shadow = cmds[0]!;
    const panel = cmds[1]!;
    expect(shadow.kind).toBe('group');
    expect(JSON.stringify(shadow)).toContain('rgba(0, 0, 0, 0.6)');
    expect(panel.kind === 'path' && panel.path.kind).toBe('polygon');
    if (panel.kind !== 'path' || panel.path.kind !== 'polygon') return;
    // The first point is the top-left corner's arc leaving the left edge, one radius down.
    expect(panel.path.coords[0]).toBeCloseTo(b.x);
    expect(panel.path.coords[1]).toBeCloseTo(b.y + 6);
    expect(panel.fill).toBeDefined();
    expect(panel.stroke).toBeDefined();
  });

  it("follows a theme's --wzl-bevel-raised in place of the default shadow, drawing inset layers over the face", () => {
    const e: MenuEntry = { kind: 'item', key: 'a', label: 'A', run };
    const beveled = {
      ...ctx,
      tokens: { ...ctx.tokens, '--wzl-radius-md': '0px', '--wzl-dark': '#000000',
        '--wzl-bevel-raised': 'inset -1px -1px 0 var(--wzl-dark), inset 1px 1px 0 #ffffff' },
    } as never as HudDrawCtx;
    const cmds = drawPanel(beveled, b, [e], null);
    const face = cmds.findIndex((c) => c.kind === 'path' && c.fill && c.stroke);
    expect(face).toBe(0);
    const [light, dark] = cmds.slice(1, 3);
    expect(JSON.stringify(dark)).toContain('#000000');
    expect(JSON.stringify(light)).toContain('#ffffff');
    expect(JSON.stringify(cmds)).not.toContain('rgba(0, 0, 0, 0.6)');
    // Clipped to the face less its 1px border.
    const clip = dark!.kind === 'group' ? dark!.clip : undefined;
    const coords = clip?.kind === 'polygon' ? [...clip.coords] : [];
    const xs = coords.filter((_, i) => i % 2 === 0);
    const ys = coords.filter((_, i) => i % 2 === 1);
    expect([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)])
      .toEqual([b.x + 1, b.y + 1, b.x + b.w - 1, b.y + b.h - 1]);
  });

  it("draws a row's icon from the registry in the icon column, in the row's color, and the check in its place", () => {
    const icons = { get: (ref: string) => (ref === 'test:dot' ? { body: '<circle cx="10" cy="10" r="4"/>', group: '', tags: [] } : undefined), getVersion: () => 1 };
    const plain: MenuEntry = { kind: 'item', key: 'a', label: 'A', icon: 'test:dot', run };
    const off: MenuEntry = { ...plain, disabled: true };
    const on: MenuEntry = { ...plain, checked: true };
    const glyphs = (e: MenuEntry) => drawPanel(ctx, b, [e], null, icons).filter((c) => c.kind === 'group' && c.transform);
    const [g] = glyphs(plain);
    expect(g).toBeDefined();
    const t = g!.kind === 'group' ? g!.transform! : [];
    // 16px, filling the icon column of the first row and centered on it.
    expect([t[0], t[6], t[7]]).toEqual([0.8, b.x + m.padX, b.y + m.padY + (m.rowHeight - 16) / 2]);
    expect(JSON.stringify(g)).toContain('#eee');
    expect(JSON.stringify(glyphs(off))).toContain('#888');
    expect(glyphs(on)).toHaveLength(0);
    expect(drawPanel(ctx, b, [plain], null).filter((c) => c.kind === 'group' && c.transform)).toHaveLength(0);
  });

  it('sizes a panel of a million rows without overflowing the call stack', () => {
    const one: MenuEntry = { kind: 'item', key: 'a', label: 'A', run };
    const many = Array.from({ length: 1_000_000 }, (): MenuEntry => one);
    expect(panelSize(many, env).w).toBe(panelSize([one], env).w);
  });

  it("writes a number row's value in the locale its values name, en-US without one", () => {
    const row: MenuEntry = { kind: 'number', key: 'gain', label: 'Gain', value: 2.5, step: 0.5, set: () => {} };
    const shown = (locale?: string) =>
      texts(drawPanel(ctx, b, [row], null, undefined, { number: () => 2.5, text: () => undefined, locale }))
        .map((t) => t.runs.map((r) => r.text).join(''));
    expect(shown('de-DE')).toContain('2,5');
    expect(shown()).toContain('2.5');
  });
});
