import { describe, expect, it } from 'vitest';
import { formatShortcut } from '@weasel-js/gestures';
import type { DrawCommand } from '@weasel-js/core/renderer';
import type { MenuEntry } from '@weasel-js/menu';
import type { HudDrawCtx } from '../widget';
import { DEFAULT_MENU_METRICS as m, drawPanel, panelSize } from './drawPanel';

const ctx = {
  dims: { width: 800, height: 600 }, defaultFont: 'Inter',
  tokens: {
    '--wzl-surface-popover': '#222', '--wzl-surface-hover': '#333', '--wzl-fg': '#eee',
    '--wzl-fg-muted': '#888', '--wzl-border': '#444', '--wzl-shadow': 'rgba(0, 0, 0, 0.6)', '--wzl-radius-md': '6px',
  },
  color: () => undefined,
} as never as HudDrawCtx;

const run = () => {};
const b = { x: 100, y: 50, w: 240, h: 80 };
const measure = (t: string) => t.length * 7;
const shortcut = { key: 'z', mod: true, alt: false, shift: true };

const texts = (cmds: readonly DrawCommand[]) =>
  cmds.flatMap((c) => (c.kind === 'text' ? [c] : []));
const strokes = (cmds: readonly DrawCommand[]) =>
  cmds.flatMap((c) => (c.kind === 'path' && c.stroke && !c.fill ? [c] : []));

describe('drawPanel', () => {
  it('draws a check in the icon column for a checked row, and none for an unchecked one', () => {
    const on: MenuEntry = { kind: 'item', key: 'on', label: 'Grid', checked: true, run };
    const off: MenuEntry = { kind: 'item', key: 'off', label: 'Grid', checked: false, run };
    const checks = strokes(drawPanel(ctx, b, [on], null, m));
    expect(checks).toHaveLength(1);
    const path = checks[0]!.kind === 'path' ? checks[0]!.path : null;
    const xs = path?.kind === 'polygon' ? [...path.coords].filter((_, i) => i % 2 === 0) : [];
    expect(xs.length).toBeGreaterThan(0);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(b.x + m.padX);
    expect(Math.max(...xs)).toBeLessThanOrEqual(b.x + m.padX + m.rowHeight);
    expect(strokes(drawPanel(ctx, b, [off], null, m))).toHaveLength(0);
  });

  it('draws a row\'s shortcut, formatted as the DOM menu formats it, at the row\'s end in the muted color', () => {
    const e: MenuEntry = { kind: 'item', key: 'redo', label: 'Redo', shortcut, run };
    const [label, chip] = texts(drawPanel(ctx, b, [e], null, m));
    expect(label!.runs.map((r) => r.text).join('')).toBe('Redo');
    expect(chip!.runs.map((r) => r.text).join('')).toBe(formatShortcut(shortcut));
    expect(chip!.align).toBe('right');
    expect(chip!.x + chip!.width!).toBe(b.x + b.w - m.padX);
    expect(JSON.stringify(chip!.runs)).toContain('#888');
  });

  it('widens the panel to fit a label and its shortcut', () => {
    const label = 'L'.repeat(30);
    const plain: MenuEntry = { kind: 'item', key: 'a', label, run };
    const chip: MenuEntry = { kind: 'item', key: 'a', label, shortcut, run };
    const text = formatShortcut(shortcut)!;
    expect(panelSize([chip], m, measure).w).toBe(
      label.length * 7 + m.padX + text.length * 7 + m.padX * 2 + m.rowHeight,
    );
    expect(panelSize([plain], m, measure).w).toBe(label.length * 7 + m.padX * 2 + m.rowHeight * 2);
  });

  it('rounds the panel by --wzl-radius-md and casts a shadow in --wzl-shadow beneath it', () => {
    const e: MenuEntry = { kind: 'item', key: 'a', label: 'A', run };
    const cmds = drawPanel(ctx, b, [e], null, m);
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
    const cmds = drawPanel(beveled, b, [e], null, m);
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
    const glyphs = (e: MenuEntry) => drawPanel(ctx, b, [e], null, m, icons).filter((c) => c.kind === 'group' && c.transform);
    const [g] = glyphs(plain);
    expect(g).toBeDefined();
    const t = g!.kind === 'group' ? g!.transform! : [];
    // 16px, centered in the icon column of the first row.
    expect([t[0], t[6], t[7]]).toEqual([0.8, b.x + m.padX + m.rowHeight / 2 - 8, b.y + m.padY + m.rowHeight / 2 - 8]);
    expect(JSON.stringify(g)).toContain('#eee');
    expect(JSON.stringify(glyphs(off))).toContain('#888');
    expect(glyphs(on)).toHaveLength(0);
    expect(drawPanel(ctx, b, [plain], null, m).filter((c) => c.kind === 'group' && c.transform)).toHaveLength(0);
  });
});

