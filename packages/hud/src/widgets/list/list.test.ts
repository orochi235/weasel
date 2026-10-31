import { describe, expect, it, vi } from 'vitest';
import { exactly, measureRowList } from '@weasel-js/headless';
import type { DrawCommand, TextDrawCommand } from '@weasel-js/core/renderer';
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
import { createList } from './list';
import { hudMeasureEnv } from '../../measureEnv';
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
    const l = createList({ id: 'l', x: 10, y: 20, w: 200, rows });
    expect(l.bounds).toEqual({ x: 10, y: 20, w: 200, h: rowH * 3 + 2 });
  });

  it('draws each label, the selected row filled, and a swatch in its leading slot', () => {
    const l = createList({ id: 'l', x: 0, y: 0, w: 200, rows, selection: 'single', onActivate: () => {} });
    const cmds = l.draw(ctx);
    expect(texts(cmds)).toEqual(['Apple', 'Banana', 'Cherry']);
    const fills = cmds.flatMap((c) => (c.kind === 'path' && c.fill && 'paint' in c.fill ? [(c.fill.paint as { color: string }).color] : []));
    expect(fills).toContain(tokens['--wzl-border']);
    expect(fills).toContain('#ff0000');
  });

  it('lays its parts where the shared measure puts them', () => {
    const l = createList({ id: 'l', x: 5, y: 7, w: 180, rows });
    const m = measureRowList({ rows: [...rows.slice(0, 2), { ...rows[2]!, leadingWidth: 12 }] }, exactly(180, l.bounds.h), hudMeasureEnv(ctx));
    const cherry = l.draw(ctx).filter((c): c is TextDrawCommand => c.kind === 'text')[2]!;
    expect(cherry.x).toBe(5 + m.layout.rows[2]!.label.x);
    expect(cherry.y).toBe(7 + m.layout.rows[2]!.rect.y);
  });

  it('activates the row pressed, and not one released elsewhere', () => {
    const onActivate = vi.fn();
    const l = createList({ id: 'l', x: 0, y: 0, w: 200, rows, onActivate });
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
    const l = createList({ id: 'l', x: 0, y: 0, w: 200, rows, selection: 'single', onActivate });
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
    const l = createList({ id: 'l', x: 0, y: 0, w: 200, rows, selection: 'single', onActivate: () => {} });
    const ring = () => l.draw(ctx).some((c) => c.kind === 'path' && !!c.stroke && c.stroke.width === 2);
    l.onFocusChange!(true);
    expect(ring()).toBe(false);
    l.onKey!(key('ArrowUp'));
    expect(ring()).toBe(true);
  });

  it('is a listbox of options to assistive tech, the keyboard row active', () => {
    const l = createList({ id: 'l', x: 0, y: 0, w: 200, rows, selection: 'multi', accessibleName: 'Fruit' });
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
    const empty = createList({ id: 'e', x: 0, y: 0, w: 200, rows: [] });
    const muted = createList({ id: 'm', x: 0, y: 0, w: 200, rows: [{ id: 'a', label: 'A', muted: true }] });
    for (const c of [...colors(empty.draw(ctx)), ...colors(muted.draw(ctx))]) expect(c).not.toContain('currentColor');
  });

  it('takes no focus and no keys when it neither selects nor activates', () => {
    const l = createList({ id: 'l', x: 0, y: 0, w: 200, rows });
    expect(l.focusable).toBe(false);
    expect(l.onKey!(key('ArrowDown'))).toBe(false);
    expect(l.accessibleTree!.read().children![0]!.role).toBe('listitem');
  });
});
