import { describe, expect, it, vi } from 'vitest';
import { exactly, measureRowList } from '@weasel-js/ui-logic';
import type { DrawCommand, TextDrawCommand } from '@weasel-js/core/renderer';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { createList } from './list';
import { hudMeasureEnv } from '../../measureEnv';
import { textWidth } from '../../menu/textWidth';
import type { HudKeyEvent } from '../../widget';

const tokens = resolveTheme(weaselTheme, { mode: 'dark' });
const ctx = { dims: { width: 400, height: 400 }, defaultFont: 'D', color: () => '#000000', tokens };
const rowH = Number.parseFloat(tokens['--wzl-control-h']);
const rows = [
  { id: 'a', label: 'Apple' },
  { id: 'b', label: 'Banana', selected: true },
  { id: 'c', label: 'Cherry', swatch: '#ff0000' },
];
const key = (k: string): HudKeyEvent => ({
  type: 'keydown', key: k, code: '', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
  repeat: false, native: null,
});
const texts = (cmds: DrawCommand[]) =>
  cmds.filter((c): c is TextDrawCommand => c.kind === 'text').map((c) => c.runs.map((r) => r.text).join(''));

describe('list widget', () => {
  it('is as tall as its rows, a pixel apart, when given no height', () => {
    const l = createList({ id: 'l', x: 10, y: 20, width: 200, rows });
    expect(l.bounds).toEqual({ x: 10, y: 20, width: 200, height: rowH * 3 + 2 });
  });

  it('keeps a height setBounds gives, and follows its rows again when setBounds leaves height out', () => {
    const l = createList({ id: 'l', x: 0, y: 0, width: 200, rows });
    l.setBounds({ x: 0, y: 0, width: 200, height: rowH });
    expect(l.bounds.height).toBe(rowH);
    l.setRows([...rows, { id: 'd', label: 'Date' }]);
    expect(l.bounds.height).toBe(rowH);
    l.setBounds({ x: 5, y: 0, width: 200 });
    expect(l.bounds).toEqual({ x: 5, y: 0, width: 200, height: rowH * 4 + 3 });
  });

  it('draws each label, the selected row filled, and a swatch in its leading slot', () => {
    const l = createList({ id: 'l', x: 0, y: 0, width: 200, rows, selectionMode: 'single', onActivate: () => {} });
    const cmds = l.draw(ctx);
    expect(texts(cmds)).toEqual(['Apple', 'Banana', 'Cherry']);
    const fills = cmds.flatMap((c) => (c.kind === 'path' && c.fill && 'paint' in c.fill ? [(c.fill.paint as { color: string }).color] : []));
    expect(fills).toContain(tokens['--wzl-border']);
    expect(fills).toContain('#ff0000');
  });

  it('lays its parts where the shared measure puts them', () => {
    const l = createList({ id: 'l', x: 5, y: 7, width: 180, rows });
    const m = measureRowList({ rows: [...rows.slice(0, 2), { ...rows[2]!, leadingWidth: 12 }] }, exactly(180, l.bounds.height), hudMeasureEnv(ctx));
    const cherry = l.draw(ctx).filter((c): c is TextDrawCommand => c.kind === 'text')[2]!;
    expect(cherry.x).toBe(5 + m.layout.rows[2]!.label.x);
    expect(cherry.y).toBe(7 + m.layout.rows[2]!.rect.y);
  });

  it('activates the row pressed, and not one released elsewhere', () => {
    const onActivate = vi.fn();
    const l = createList({ id: 'l', x: 0, y: 0, width: 200, rows, onActivate });
    const y = rowH * 1.5 + 1;
    l.onPointer({ type: 'down', x: 10, y, native: null });
    l.onPointer({ type: 'up', x: 10, y, native: null });
    expect(onActivate).toHaveBeenCalledWith('b', 1);
    l.onPointer({ type: 'down', x: 10, y, native: null });
    l.onPointer({ type: 'up', x: 10, y: 2, native: null });
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('moves with the arrows from the selected row, types ahead, and activates on Enter', () => {
    const onActivate = vi.fn();
    const l = createList({ id: 'l', x: 0, y: 0, width: 200, rows, selectionMode: 'single', onActivate });
    l.onFocusChange!(true);
    expect(l.active).toBe(1);
    expect(l.onKey!(key('ArrowDown'))).toBe(true);
    expect(l.active).toBe(2);
    expect(l.onKey!(key('a'))).toBe(true);
    expect(l.active).toBe(0);
    l.onKey!(key('Enter'));
    expect(onActivate).toHaveBeenCalledWith('a', 0);
    expect(l.onKey!(key('Tab'))).toBe(false);
  });

  it('rings the keyboard row only once a key has moved it', () => {
    const l = createList({ id: 'l', x: 0, y: 0, width: 200, rows, selectionMode: 'single', onActivate: () => {} });
    const ring = () => l.draw(ctx).some((c) => c.kind === 'path' && !!c.stroke && c.stroke.width === 2);
    l.onFocusChange!(true);
    expect(ring()).toBe(false);
    l.onKey!(key('ArrowUp'));
    expect(ring()).toBe(true);
  });

  it('is a listbox of options to assistive tech, the keyboard row active', () => {
    const l = createList({ id: 'l', x: 0, y: 0, width: 200, rows, selectionMode: 'multiple', accessibleName: 'Fruit' });
    l.onFocusChange!(true);
    const tree = l.accessibleTree!.read();
    expect(tree).toMatchObject({ role: 'listbox', label: 'Fruit', multiselectable: true });
    expect(tree.children!.map((c) => [c.role, c.selected, !!c.active])).toEqual([
      ['option', false, false], ['option', true, true], ['option', false, false],
    ]);
  });

  it('resolves the subtle color against the foreground, for muted rows and the empty state', () => {
    const colors = (cmds: DrawCommand[]) => cmds.filter((c): c is TextDrawCommand => c.kind === 'text')
      .map((c) => JSON.stringify(c.runs[0]!.fill));
    const empty = createList({ id: 'e', x: 0, y: 0, width: 200, rows: [] });
    const muted = createList({ id: 'm', x: 0, y: 0, width: 200, rows: [{ id: 'a', label: 'A', muted: true }] });
    for (const c of [...colors(empty.draw(ctx)), ...colors(muted.draw(ctx))]) expect(c).not.toContain('currentColor');
  });

  it('takes no focus and no keys when it neither selects nor activates', () => {
    const l = createList({ id: 'l', x: 0, y: 0, width: 200, rows });
    expect(l.focusable).toBe(false);
    expect(l.onKey!(key('ArrowDown'))).toBe(false);
    expect(l.accessibleTree!.read().children![0]!.role).toBe('listitem');
  });

  it('keeps the keyboard, hovered and pressed rows on their rows when setRows inserts or reorders', () => {
    const onActivate = vi.fn();
    const l = createList({ id: 'l', x: 0, y: 0, width: 200, rows, onActivate });
    l.onFocusChange!(true);
    l.onKey!(key('End'));
    expect(l.active).toBe(2);
    l.setRows([{ id: 'n', label: 'New' }, ...rows]);
    expect(l.active).toBe(3);
    l.onKey!(key('Enter'));
    expect(onActivate).toHaveBeenLastCalledWith('c', 3);

    const y = rowH * 0.5;
    l.onPointer({ type: 'down', x: 10, y, native: null });
    l.setRows([...rows, { id: 'n', label: 'New' }]);
    l.onPointer({ type: 'up', x: 10, y, native: null });
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it('puts the keyboard row on its neighbor when its row is removed', () => {
    const l = createList({ id: 'l', x: 0, y: 0, width: 200, rows, onActivate: () => {} });
    l.onFocusChange!(true);
    l.onKey!(key('Home'));
    l.onKey!(key('ArrowDown'));
    l.setRows(rows.filter((r) => r.id !== 'b'));
    expect(l.active).toBe(1);
    l.setRows([rows[0]!]);
    expect(l.active).toBe(0);
    l.setRows([]);
    expect(l.active).toBeNull();
  });

  it('ends a label too long for its row with an ellipsis, inside the row', () => {
    const l = createList({ id: 'l', x: 0, y: 0, width: 120, rows: [{ id: 'a', label: 'A very long layer name indeed' }] });
    const m = measureRowList({ rows: [{ id: 'a', label: 'A very long layer name indeed' }] }, exactly(120, l.bounds.height), hudMeasureEnv(ctx));
    const [label] = texts(l.draw(ctx));
    expect(label).toMatch(/…$/);
    expect(textWidth(label!, m.layout.metrics.font.size, 'D')).toBeLessThanOrEqual(m.layout.rows[0]!.label.width);
  });

  describe('shorter than its rows', () => {
    const eight = Array.from({ length: 8 }, (_, i) => ({ id: `r${i}`, label: `Row ${i}` }));
    const pitch = rowH + 1;
    const make = (onActivate = vi.fn()) =>
      createList({ id: 'l', x: 0, y: 0, width: 200, height: pitch * 2, rows: eight, onActivate });

    it('clips its rows to its bounds and draws none wholly outside them', () => {
      const cmds = make().draw(ctx);
      expect(cmds).toHaveLength(1);
      const group = cmds[0]!;
      expect(group).toMatchObject({ kind: 'group', clip: { kind: 'rect', x: 0, y: 0, width: 200, height: pitch * 2 } });
      expect(texts((group as { children: DrawCommand[] }).children)).toEqual(['Row 0', 'Row 1']);
    });

    it('scrolls the keyboard row into view, and draws and presses the rows it scrolled to', () => {
      const onActivate = vi.fn();
      const l = make(onActivate);
      l.onFocusChange!(true);
      l.onKey!(key('End'));
      expect(l.scrollTop).toBe(pitch * 8 - 1 - pitch * 2);
      const group = l.draw(ctx)[0] as { children: DrawCommand[] };
      expect(texts(group.children)).toContain('Row 7');
      const y = pitch * 2 - 2;
      l.onPointer({ type: 'down', x: 10, y, native: null });
      l.onPointer({ type: 'up', x: 10, y, native: null });
      expect(onActivate).toHaveBeenCalledWith('r7', 7);
      l.onKey!(key('Home'));
      expect(l.scrollTop).toBe(0);
    });

    it('hovers the row under a still pointer after the wheel scrolls', () => {
      const at = { x: 10, y: 5, native: null };
      const wheel = { type: 'wheel' as const, ...at, deltaX: 0, deltaY: pitch, native: null };
      const hovered = make();
      hovered.onPointer({ type: 'hovermove', ...at });
      hovered.onPointer(wheel);
      const fresh = make();
      fresh.onPointer(wheel);
      fresh.onPointer({ type: 'hovermove', ...at });
      expect(hovered.draw(ctx)).toEqual(fresh.draw(ctx));
    });

    it('scrolls by the wheel, within its rows, and claims the wheel only while it can scroll', () => {
      const l = make();
      expect(l.claims).toContain('wheel');
      l.onPointer({ type: 'wheel', x: 10, y: 10, deltaX: 0, deltaY: 30, native: null });
      expect(l.scrollTop).toBe(30);
      l.onPointer({ type: 'wheel', x: 10, y: 10, deltaX: 0, deltaY: 10_000, native: null });
      expect(l.scrollTop).toBe(pitch * 8 - 1 - pitch * 2);
      l.setRows(eight.slice(0, 2));
      expect(l.scrollTop).toBe(0);
      expect(l.claims).not.toContain('wheel');
    });
  });
});
