import { describe, expect, it, vi } from 'vitest';
import type { OpenMenu } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import type { MenuColorEntry, MenuEntry, MenuItemEntry, MenuTextEntry, SubmenuEntry } from '@weasel-js/menu';
import type { HudDrawCtx, HudKeyEvent } from '../widget';
import { hexColor, withColorPickers } from './colorPicker';
import { createMenuWidget } from './menuWidget';

const fill = (color: string): MenuColorEntry => ({ kind: 'color', key: 'fill', label: 'Fill', value: color, set: vi.fn() });

describe('hexColor', () => {
  it('reads three, six and eight digits, with or without #, as the row writes them', () => {
    expect(hexColor('#ABC', false)).toBe('#aabbcc');
    expect(hexColor(' 336699 ', false)).toBe('#336699');
    expect(hexColor('#33669980', false)).toBe('#336699');
    expect(hexColor('#336699', true)).toBe('#336699ff');
    expect(hexColor('#336699', true, '#00000080')).toBe('#33669980');
    expect(hexColor('#33669940', true, '#00000080')).toBe('#33669940');
    expect(hexColor('red', false)).toBeUndefined();
    expect(hexColor('#12345', false)).toBeUndefined();
  });
});

describe('withColorPickers', () => {
  const ctrl = (held?: string) => ({ colorValue: (e: MenuColorEntry) => held ?? e.value, setColor: vi.fn() });

  it('makes a writable color row a submenu of swatches and a hex row, and leaves any other color row be', () => {
    const readOnly: MenuEntry = { kind: 'color', key: 'ro', label: 'RO', value: '#000000' };
    const off: MenuEntry = { ...fill('#000000'), key: 'off', disabled: true };
    const nested: MenuEntry = { kind: 'submenu', key: 'more', label: 'More', entries: [fill('#ff0000')] };
    const c = ctrl();
    const { entries, swatchOf } = withColorPickers([fill('#e53935'), readOnly, off, nested], ['#000000', '#e53935'], () => c);
    const picker = entries[0] as SubmenuEntry;
    expect(picker).toMatchObject({ kind: 'submenu', key: 'fill', label: 'Fill' });
    expect(picker.entries.map((e) => e.kind)).toEqual(['item', 'item', 'separator', 'text']);
    expect(picker.entries.map((e) => (e as MenuItemEntry).checked)).toEqual([false, true, undefined, undefined]);
    expect(swatchOf(picker)).toBe('#e53935');
    expect(swatchOf(picker.entries[0]!)).toBe('#000000');
    expect(entries[1]).toBe(readOnly);
    expect(entries[2]).toBe(off);
    expect((entries[3] as SubmenuEntry).entries[0]!.kind).toBe('submenu');
  });

  it('writes a swatch and typed hex through the controller, keeping alpha', () => {
    const row = { ...fill('#00000080'), alpha: true };
    const c = ctrl();
    const picker = withColorPickers([row], ['#1e88e5'], () => c).entries[0] as SubmenuEntry;
    expect(picker.entries[0]).toMatchObject({ keepOpen: true });
    (picker.entries[0] as MenuItemEntry).run();
    expect(c.setColor).toHaveBeenCalledWith(row, '#1e88e580');
    c.setColor.mockClear();
    const hex = picker.entries[2] as MenuTextEntry;
    expect(hex.value).toBe('#00000080');
    hex.set('nope');
    expect(c.setColor).not.toHaveBeenCalled();
    hex.set('#fff');
    expect(c.setColor).toHaveBeenCalledWith(row, '#ffffff80');
  });
});

const keydown = (key: string): HudKeyEvent => ({
  type: 'keydown', key, code: key, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, repeat: false, native: null,
});
const ctx = {
  dims: { width: 800, height: 600 }, defaultFont: 'Inter',
  tokens: {
    '--wzl-surface-popover': '#222', '--wzl-surface-hover': '#333', '--wzl-fg': '#eee',
    '--wzl-fg-muted': '#888', '--wzl-border': '#444', '--wzl-shadow': '#0008', '--wzl-radius-md': '6px',
  },
  color: () => undefined,
} as never as HudDrawCtx;

function widget(entries: MenuEntry[]) {
  const close = vi.fn();
  const open: OpenMenu = { seq: 1, source: 'pointer', client: { x: 100, y: 100 }, entries };
  const w = createMenuWidget({
    open, close, toCanvas: (p) => p, canvasSize: () => ({ width: 800, height: 600 }),
    measure: (t) => t.length * 7, palette: ['#000000', '#1e88e5'], onChange: () => {},
  });
  const type = (keys: readonly string[]) => { for (const k of keys) w.onKey!(keydown(k)); };
  return { w, close, type };
}
const draws = (w: ReturnType<typeof widget>['w'], color: string) =>
  (w.draw(ctx) as DrawCommand[]).some((c) => c.kind === 'path' && JSON.stringify(c.fill ?? null).includes(color));

describe('createMenuWidget: a color row', () => {
  it('opens a picker whose swatch writes the color and keeps the menu open', () => {
    const row = fill('#336699');
    const { w, close, type } = widget([row]);
    expect(draws(w, '#336699')).toBe(true);
    expect(w.accessibleTree!.read().children![0]).toMatchObject({ label: 'Fill: #336699', expanded: false });
    type(['ArrowDown', 'ArrowRight']);
    expect(draws(w, '#1e88e5')).toBe(true);
    type(['ArrowDown', 'Enter']);
    expect(row.set).toHaveBeenCalledWith('#1e88e5');
    expect(close).not.toHaveBeenCalled();
    expect(w.accessibleTree!.read().children![0]).toMatchObject({ label: 'Fill: #1e88e5' });
  });

  it('takes typed hex in the picker and writes it without closing', () => {
    const row = fill('#336699');
    const { w, close, type } = widget([row]);
    type(['ArrowDown', 'ArrowRight', 'End', 'Enter', 'Backspace', 'Backspace', 'Backspace', 'Backspace', 'Backspace', 'Backspace', 'f', '0', '0', 'Enter']);
    expect(row.set).toHaveBeenCalledWith('#ff0000');
    expect(close).not.toHaveBeenCalled();
    expect(w.accessibleTree!.read().children![0]).toMatchObject({ label: 'Fill: #ff0000' });
  });
});
