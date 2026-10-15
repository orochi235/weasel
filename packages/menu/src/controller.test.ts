import { describe, expect, it, vi } from 'vitest';
import { createMenuController, type MenuScheduler } from './controller';
import type { MenuEntry } from './entries';

function fakeScheduler() {
  let now = 0;
  let timers: { at: number; fn: () => void }[] = [];
  const s: MenuScheduler = {
    now: () => now,
    set(fn, ms) {
      const t = { at: now + ms, fn };
      timers.push(t);
      return () => { timers = timers.filter((x) => x !== t); };
    },
  };
  const advance = (ms: number) => {
    now += ms;
    const due = timers.filter((t) => t.at <= now);
    timers = timers.filter((t) => t.at > now);
    for (const t of due) t.fn();
  };
  return { s, advance };
}

function setup(highlightFirst = false) {
  const ran: string[] = [];
  const run = (k: string) => () => { ran.push(k); };
  const entries: MenuEntry[] = [
    { kind: 'item', key: 'cut', label: 'Cut', run: run('cut') },
    { kind: 'item', key: 'off', label: 'Off', run: run('off'), disabled: true },
    { kind: 'submenu', key: 'arr', label: 'Arrange', entries: [
      { kind: 'item', key: 'fwd', label: 'Forward', run: run('fwd') },
    ] },
    { kind: 'item', key: 'del', label: 'Delete', run: run('del') },
  ];
  const onClose = vi.fn();
  const { s, advance } = fakeScheduler();
  const c = createMenuController({ entries, onClose, scheduler: s, highlightFirst });
  return { c, ran, onClose, advance };
}

describe('createMenuController', () => {
  it('starts with nothing highlighted on a pointer open, the first row on a keyboard open', () => {
    expect(setup().c.stack()).toEqual([null]);
    expect(setup(true).c.stack()).toEqual([0]);
  });

  it('closes before running a chosen item', () => {
    const { c, ran, onClose } = setup();
    c.press(0, 0);
    expect(onClose).toHaveBeenCalledOnce();
    expect(ran).toEqual(['cut']);
  });

  it('ignores a press on a disabled item', () => {
    const { c, ran, onClose } = setup();
    c.press(0, 1);
    expect(onClose).not.toHaveBeenCalled();
    expect(ran).toEqual([]);
  });

  it('opens a submenu on hover only after the delay', () => {
    const { c, advance } = setup();
    c.hover(0, 2, { x: 10, y: 50 });
    expect(c.stack()).toEqual([2]);
    advance(199);
    expect(c.stack()).toEqual([2]);
    advance(1);
    expect(c.stack()).toEqual([2, null]);
  });

  it('opens a submenu at once on press', () => {
    const { c } = setup();
    c.press(0, 2);
    expect(c.stack()).toEqual([2, null]);
  });

  it('keeps a submenu open while the pointer heads diagonally into it', () => {
    const { c, advance } = setup();
    c.setPanel(0, { x: 0, y: 0, w: 100, h: 100 });
    c.hover(0, 2, { x: 50, y: 50 });
    advance(200);
    c.setPanel(1, { x: 100, y: 40, w: 100, h: 60 });
    c.hover(0, 3, { x: 70, y: 60 });
    expect(c.stack()).toEqual([2, null]);
    c.hover(1, 0, { x: 110, y: 60 });
    expect(c.stack()).toEqual([2, 0]);
  });

  it('switches rows once the diagonal grace runs out', () => {
    const { c, advance } = setup();
    c.setPanel(0, { x: 0, y: 0, w: 100, h: 100 });
    c.hover(0, 2, { x: 50, y: 50 });
    advance(200);
    c.setPanel(1, { x: 100, y: 40, w: 100, h: 60 });
    c.hover(0, 3, { x: 70, y: 60 });
    advance(300);
    expect(c.stack()).toEqual([3]);
  });

  it('switches at once when the pointer moves away from the submenu', () => {
    const { c, advance } = setup();
    c.setPanel(0, { x: 0, y: 0, w: 100, h: 100 });
    c.hover(0, 2, { x: 50, y: 50 });
    advance(200);
    c.setPanel(1, { x: 100, y: 40, w: 100, h: 60 });
    c.hover(0, 3, { x: 30, y: 80 });
    expect(c.stack()).toEqual([3]);
  });

  it('typeahead accumulates within the reset window', () => {
    const { c, advance } = setup(true);
    c.key('d');
    expect(c.stack()).toEqual([3]);
    advance(600);
    c.key('c');
    expect(c.stack()).toEqual([0]);
  });

  it('Escape at the root closes', () => {
    const { c, onClose } = setup();
    c.key('Escape');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('notifies subscribers and stops timers on dispose', () => {
    const { c, advance } = setup();
    const fn = vi.fn();
    c.subscribe(fn);
    c.hover(0, 2, { x: 0, y: 0 });
    expect(fn).toHaveBeenCalled();
    c.dispose();
    advance(500);
    expect(c.stack()).toEqual([2]);
  });
});
