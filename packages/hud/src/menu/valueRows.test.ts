import { describe, expect, it, vi } from 'vitest';
import type { OpenMenu } from '@weasel-js/core';
import { percent } from '@weasel-js/quantity';
import type { DrawCommand } from '@weasel-js/core/renderer';
import type { MenuEntry, MenuNumberEntry } from '@weasel-js/menu';
import type { HudDrawCtx, HudKeyEvent } from '../widget';
import { DEFAULT_MENU_METRICS as m, drawPanel, panelSize } from './drawPanel';
import { createMenuWidget } from './menuWidget';
import { numberChips } from './valueRows';

const ctx = {
  dims: { width: 800, height: 600 }, defaultFont: 'Inter',
  tokens: {
    '--wzl-surface-popover': '#222', '--wzl-surface-hover': '#333', '--wzl-fg': '#eee',
    '--wzl-fg-muted': '#888', '--wzl-border': '#444', '--wzl-shadow': '#0008', '--wzl-radius-md': '6px',
  },
  color: () => undefined,
} as never as HudDrawCtx;

const b = { x: 100, y: 50, w: 240, h: 80 };
const measure = (t: string) => t.length * 7;
const textOf = (cmds: readonly DrawCommand[]) =>
  cmds.flatMap((c) => (c.kind === 'text' ? [c.runs.map((r) => r.text).join('')] : []));

function zoomRow(extra: Partial<MenuNumberEntry> = {}): MenuNumberEntry {
  return { kind: 'number', key: 'zoom', label: 'Magnification', value: 8, min: 2, max: 16, step: 1, suffix: '×', set: vi.fn(), ...extra };
}
const color: MenuEntry = { kind: 'color', key: 'color', label: 'Color', value: '#336699' };

describe('drawPanel: value rows', () => {
  it('draws a number row as its label, its value and unit, and a step chip either side', () => {
    const cmds = drawPanel(ctx, b, [zoomRow()], null, m);
    expect(textOf(cmds)).toEqual(['Magnification', '8×']);
    const chips = numberChips(b.w, m);
    // One mark per chip: the minus and the plus.
    const marks = cmds.filter((c) => c.kind === 'path' && c.stroke && !c.fill);
    expect(marks).toHaveLength(2);
    expect(chips.minus.x + chips.minus.w).toBeLessThanOrEqual(chips.plus.x);
    expect(chips.plus.x + chips.plus.w).toBe(b.w - m.padX);
  });

  it('draws what it is given to show over what the row opened with', () => {
    expect(textOf(drawPanel(ctx, b, [zoomRow()], null, m, undefined, () => 12))).toContain('12×');
    expect(textOf(drawPanel(ctx, b, [zoomRow({ value: undefined })], null, m))).toContain('—');
    expect(textOf(drawPanel(ctx, b, [zoomRow({ value: 0.5, suffix: undefined, display: percent() })], null, m))).toContain('50%');
  });

  it('draws a color row as its label, a swatch of the color in the icon column, and the hex, muted', () => {
    const cmds = drawPanel(ctx, b, [color], null, m);
    expect(textOf(cmds)).toEqual(['Color', '#336699']);
    expect(JSON.stringify(cmds)).toContain('"color":"#336699"');
    expect(JSON.stringify(cmds.filter((c) => c.kind === 'text')[0])).toContain('#888');
  });

  it('widens the panel for a number row\'s chips and a color row\'s swatch and hex', () => {
    const label = 'L'.repeat(30);
    const chips = numberChips(0, m);
    expect(panelSize([zoomRow({ label })], m, measure).w).toBe(label.length * 7 + m.padX + chips.width + m.padX * 2 + m.rowHeight);
    expect(panelSize([{ ...color, label } as MenuEntry], m, measure).w)
      .toBe(label.length * 7 + m.padX + 7 * 7 + m.padX * 2 + m.rowHeight);
  });
});

const keydown = (key: string): HudKeyEvent => ({
  type: 'keydown', key, code: key, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, repeat: false, native: null,
});

function widget(entries: MenuEntry[]) {
  const close = vi.fn();
  const open: OpenMenu = { seq: 1, source: 'pointer', client: { x: 100, y: 100 }, entries };
  const w = createMenuWidget({
    open, close, toCanvas: (p) => p, canvasSize: () => ({ width: 800, height: 600 }), measure, onChange: () => {},
  });
  const click = (x: number, y: number) => {
    w.onPointer({ type: 'down', x, y, native: null });
    w.onPointer({ type: 'up', x, y, native: null });
  };
  return { w, close, click };
}

describe('createMenuWidget: value rows', () => {
  it('steps a number row from its chips, redraws the value, and stays open', () => {
    const row = zoomRow();
    const { w, close, click } = widget([row, color]);
    const p = w.bounds;
    const chips = numberChips(p.w, m);
    const y = p.y + m.padY + m.rowHeight / 2;
    click(p.x + chips.plus.x + chips.plus.w / 2, y);
    click(p.x + chips.plus.x + chips.plus.w / 2, y);
    click(p.x + chips.minus.x + chips.minus.w / 2, y);
    expect(vi.mocked(row.set).mock.calls).toEqual([[9], [10], [9]]);
    expect(textOf(w.draw(ctx) as DrawCommand[])).toContain('9×');
    click(p.x + 20, y);
    click(p.x + 20, y + m.rowHeight);
    expect(close).not.toHaveBeenCalled();
    expect(row.set).toHaveBeenCalledTimes(3);
  });

  it('steps a highlighted number row with + and -', () => {
    const row = zoomRow();
    const { w } = widget([row]);
    w.onKey!(keydown('ArrowDown'));
    w.onKey!(keydown('+'));
    expect(row.set).toHaveBeenLastCalledWith(9);
  });

  it('names a number row and a color row by label and value in its tree', () => {
    const row = zoomRow();
    const { w } = widget([row, color]);
    w.onKey!(keydown('ArrowDown'));
    w.onKey!(keydown('-'));
    expect(w.accessibleTree!.read().children).toEqual([
      { role: 'menuitem', key: 'zoom', label: 'Magnification: 7×', active: true },
      { role: 'menuitem', key: 'color', label: 'Color: #336699', disabled: true },
    ]);
  });
});
