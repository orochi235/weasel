import { describe, it, expect, vi } from 'vitest';
import { createHud } from './hud';
import type { Widget } from './widget';

function widget(id: string, extra: Partial<Widget> = {}): Widget {
  return {
    id, bounds: { x: 0, y: 0, w: 10, h: 10 }, hidden: false,
    draw: () => [], hitTest: () => false, onPointer: () => {}, dispose: () => {},
    focusable: true,
    ...extra,
  };
}

describe('Hud focus', () => {
  it('starts with nothing focused', () => {
    const hud = createHud();
    expect(hud.focused).toBeNull();
    expect(hud.focusVisible).toBe(false);
  });

  it('focuses a focusable widget and blurs with null', () => {
    const hud = createHud();
    const a = widget('a');
    hud.add(a);
    expect(hud.focus(a)).toBe(true);
    expect(hud.focused).toBe(a);
    hud.focus(null);
    expect(hud.focused).toBeNull();
  });

  it('refuses a widget that is not focusable, hidden, or not in the HUD', () => {
    const hud = createHud();
    const plain = widget('plain', { focusable: undefined });
    const hidden = widget('hidden', { hidden: true });
    const stranger = widget('stranger');
    hud.add(plain);
    hud.add(hidden);
    for (const w of [plain, hidden, stranger]) {
      expect(hud.focus(w)).toBe(false);
      expect(hud.focused).toBeNull();
    }
  });

  it('tells the widgets that gain and lose focus', () => {
    const hud = createHud();
    const a = widget('a', { onFocusChange: vi.fn() });
    const b = widget('b', { onFocusChange: vi.fn() });
    hud.add(a);
    hud.add(b);
    hud.focus(a);
    hud.focus(b);
    expect(a.onFocusChange).toHaveBeenNthCalledWith(1, true);
    expect(a.onFocusChange).toHaveBeenNthCalledWith(2, false);
    expect(b.onFocusChange).toHaveBeenCalledWith(true);
  });

  it('notifies subscribers once per change, not on a repeat', () => {
    const hud = createHud();
    const a = widget('a');
    hud.add(a);
    const seen: (string | null)[] = [];
    const off = hud.subscribeFocus((w) => seen.push(w?.id ?? null));
    hud.focus(a);
    hud.focus(a);
    hud.focus(null);
    off();
    hud.focus(a);
    expect(seen).toEqual(['a', null]);
  });

  it('records whether focus should show a ring', () => {
    const hud = createHud();
    const a = widget('a');
    hud.add(a);
    hud.focus(a, { visible: true });
    expect(hud.focusVisible).toBe(true);
    hud.focus(a, { visible: false });
    expect(hud.focusVisible).toBe(false);
    hud.focus(null);
    expect(hud.focusVisible).toBe(false);
  });

  it('redraws when focus changes', () => {
    const hud = createHud();
    const host = { requestRedraw: vi.fn(), registerLayer: () => () => {}, subscribeFrame: () => () => {} };
    const a = widget('a');
    hud.add(a);
    hud.bind(host);
    host.requestRedraw.mockClear();
    hud.focus(a);
    expect(host.requestRedraw).toHaveBeenCalled();
  });

  it('blurs a focused widget that is removed or disposed', () => {
    const hud = createHud();
    const a = widget('a');
    hud.add(a);
    hud.focus(a);
    hud.remove(a);
    expect(hud.focused).toBeNull();

    const btn = hud.button({ id: 'b', x: 0, y: 0, w: 10, h: 10, label: 'b' });
    hud.focus(btn);
    btn.dispose();
    expect(hud.focused).toBeNull();
  });
});

describe('Hud tab order', () => {
  it('falls back to document order, skipping what cannot take focus', () => {
    const hud = createHud();
    const a = widget('a');
    const deco = widget('deco', { focusable: false });
    const b = widget('b');
    const gone = widget('gone', { hidden: true });
    for (const w of [a, deco, b, gone]) hud.add(w);
    expect(hud.tabOrder().map((w) => w.id)).toEqual(['a', 'b']);
  });

  it('puts a declared order first, ascending, ties in document order', () => {
    const hud = createHud();
    for (const w of [
      widget('plain1'),
      widget('second', { tabOrder: 2 }),
      widget('firstA', { tabOrder: 1 }),
      widget('plain2'),
      widget('firstB', { tabOrder: 1 }),
    ]) hud.add(w);
    expect(hud.tabOrder().map((w) => w.id))
      .toEqual(['firstA', 'firstB', 'second', 'plain1', 'plain2']);
  });

  it('moves forward from nothing to the first, and off the end to nothing', () => {
    const hud = createHud();
    const a = widget('a');
    const b = widget('b');
    hud.add(a);
    hud.add(b);
    expect(hud.moveFocus('next')).toBe(a);
    expect(hud.moveFocus('next')).toBe(b);
    expect(hud.moveFocus('next')).toBeNull();
    expect(hud.focused).toBeNull();
  });

  it('moves backward from nothing to the last, and off the start to nothing', () => {
    const hud = createHud();
    const a = widget('a');
    const b = widget('b');
    hud.add(a);
    hud.add(b);
    expect(hud.moveFocus('prev')).toBe(b);
    expect(hud.moveFocus('prev')).toBe(a);
    expect(hud.moveFocus('prev')).toBeNull();
  });

  it('shows the ring for keyboard moves by default', () => {
    const hud = createHud();
    hud.add(widget('a'));
    hud.moveFocus('next');
    expect(hud.focusVisible).toBe(true);
  });

  it('continues from a focused widget that has since been hidden', () => {
    const hud = createHud();
    const a = widget('a');
    let hidden = false;
    const b = { ...widget('b'), get hidden() { return hidden; } };
    const c = widget('c');
    for (const w of [a, b, c]) hud.add(w);
    hud.focus(b);
    hidden = true;
    expect(hud.moveFocus('next')).toBe(c);
  });
});
