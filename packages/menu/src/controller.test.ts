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
    { kind: 'separator', key: 'sep' },
    { kind: 'item', key: 'clone', label: 'Clone', run: run('clone') },
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

  it('runs an item that keeps the menu open without closing, and tells subscribers', () => {
    const run = vi.fn();
    const onClose = vi.fn();
    const c = createMenuController({ entries: [{ kind: 'item', key: 'k', label: 'K', keepOpen: true, run }], onClose });
    const heard = vi.fn();
    c.subscribe(heard);
    c.press(0, 0);
    c.key('Enter');
    expect(run).toHaveBeenCalledTimes(2);
    expect(onClose).not.toHaveBeenCalled();
    expect(heard).toHaveBeenCalled();
    expect(c.stack()).toEqual([0]);
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
    c.key('c');
    expect(c.stack()).toEqual([5]);
    advance(100);
    c.key('u');
    expect(c.stack()).toEqual([0]);
  });

  it('typeahead starts over after the reset window', () => {
    const { c, advance } = setup(true);
    c.key('c');
    advance(600);
    c.key('u');
    expect(c.stack()).toEqual([5]);
  });

  it('a repeated letter cycles instead of searching for the doubled letters', () => {
    const { c } = setup(true);
    c.key('c');
    expect(c.stack()).toEqual([5]);
    c.key('c');
    expect(c.stack()).toEqual([0]);
  });

  it('a key that moves the highlight clears the typeahead buffer', () => {
    const { c } = setup(true);
    c.key('c');
    c.key('ArrowUp');
    c.key('u');
    expect(c.stack()).toEqual([3]);
  });

  it('a typeahead key cancels a pending submenu open', () => {
    const { c, advance } = setup();
    c.hover(0, 2, { x: 0, y: 0 });
    c.key('d');
    advance(300);
    expect(c.stack()).toEqual([3]);
  });

  it('hovering the same submenu row repeatedly still opens it after the delay', () => {
    const { c, advance } = setup();
    c.hover(0, 2, { x: 0, y: 0 });
    advance(100);
    c.hover(0, 2, { x: 1, y: 0 });
    advance(100);
    expect(c.stack()).toEqual([2, null]);
  });

  it('leaving a submenu row before the delay does not open it', () => {
    const { c, advance } = setup();
    c.hover(0, 2, { x: 0, y: 0 });
    advance(100);
    c.hover(0, null, { x: 0, y: 200 });
    advance(300);
    expect(c.stack()).toEqual([null]);
  });

  it('measures the diagonal grace from its first in-triangle move', () => {
    const { c, advance } = setup();
    c.setPanel(0, { x: 0, y: 0, w: 100, h: 100 });
    c.hover(0, 2, { x: 50, y: 50 });
    advance(200);
    c.setPanel(1, { x: 100, y: 40, w: 100, h: 60 });
    c.hover(0, 3, { x: 70, y: 60 });
    advance(100);
    c.hover(0, 3, { x: 75, y: 65 });
    advance(100);
    c.hover(0, 3, { x: 80, y: 70 });
    advance(100);
    expect(c.stack()).toEqual([3]);
  });

  it('switches to the row under the pointer when the diagonal grace ends', () => {
    const { c, advance } = setup();
    c.setPanel(0, { x: 0, y: 0, w: 100, h: 100 });
    c.hover(0, 2, { x: 50, y: 50 });
    advance(200);
    c.setPanel(1, { x: 100, y: 40, w: 100, h: 60 });
    c.hover(0, 3, { x: 70, y: 60 });
    advance(100);
    c.hover(0, 5, { x: 80, y: 70 });
    advance(200);
    expect(c.stack()).toEqual([5]);
  });

  it('runs an item once however many presses arrive', () => {
    const { c, ran, onClose } = setup();
    c.press(0, 0);
    c.press(0, 0);
    expect(ran).toEqual(['cut']);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('ignores keys after closing', () => {
    const { c, ran } = setup(true);
    expect(c.key('Enter')).toBe(true);
    expect(c.key('Enter')).toBe(false);
    expect(ran).toEqual(['cut']);
  });

  it('ignores hover and press after dispose', () => {
    const { c, ran } = setup();
    c.dispose();
    c.hover(0, 3);
    c.press(0, 3);
    expect(c.stack()).toEqual([null]);
    expect(ran).toEqual([]);
  });

  it('ignores a level that is not open and a row that is a separator', () => {
    const { c, ran, onClose } = setup();
    c.hover(1, 0);
    c.press(1, 0);
    c.hover(0, 4);
    c.press(0, 4);
    expect(c.stack()).toEqual([null]);
    expect(ran).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('pressing a submenu row whose child is open keeps the child highlight', () => {
    const { c } = setup();
    c.press(0, 2);
    c.hover(1, 0);
    expect(c.stack()).toEqual([2, 0]);
    c.press(0, 2);
    expect(c.stack()).toEqual([2, 0]);
  });

  it('forgets the panel of a level that closed', () => {
    const { c, advance } = setup();
    c.setPanel(0, { x: 0, y: 0, w: 100, h: 100 });
    c.hover(0, 2, { x: 50, y: 50 });
    advance(200);
    c.setPanel(1, { x: 100, y: 40, w: 100, h: 60 });
    c.hover(0, 0, { x: 30, y: 80 });
    expect(c.stack()).toEqual([0]);
    c.hover(0, 2, { x: 50, y: 50 });
    advance(200);
    c.hover(0, 3, { x: 70, y: 60 });
    expect(c.stack()).toEqual([3]);
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

describe('access letters and edges', () => {
  const run = () => {};
  const make = (entries: MenuEntry[], onEdge?: (d: -1 | 1) => void) => {
    const onClose = vi.fn();
    const c = createMenuController({ entries, onClose, onEdge, scheduler: fakeScheduler().s });
    return { c, onClose };
  };

  it('access letter runs its item and closes', () => {
    const spy = vi.fn();
    const { c, onClose } = make([{ kind: 'item', key: 'save', label: 'Save', access: 's', run: spy }]);
    expect(c.key('S')).toBe(true);
    expect(spy).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('access letter opens its submenu with the first row highlighted', () => {
    const { c } = make([
      { kind: 'item', key: 'a', label: 'A', run },
      { kind: 'submenu', key: 'x', label: 'More', access: 'x', entries: [
        { kind: 'separator', key: 'sep' },
        { kind: 'item', key: 'b', label: 'B', run },
      ] },
    ]);
    c.key('x');
    expect(c.stack()).toEqual([1, 1]);
  });

  it('access letter wins over typeahead', () => {
    const spy = vi.fn();
    const { c } = make([
      { kind: 'item', key: 'save', label: 'Save', run },
      { kind: 'item', key: 'export', label: 'Export', access: 's', run: spy },
    ]);
    c.key('s');
    expect(spy).toHaveBeenCalledOnce();
  });

  it("a disabled row's letter does nothing and does not fall to typeahead", () => {
    const spy = vi.fn();
    const { c, onClose } = make([
      { kind: 'item', key: 'save', label: 'Save', run },
      { kind: 'item', key: 'export', label: 'Export', access: 's', disabled: true, run: spy },
    ]);
    c.hover(0, 0);
    expect(c.key('s')).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(c.stack()).toEqual([0]);
  });

  it('a disabled row letter clears the typeahead buffer', () => {
    const { c } = make([
      { kind: 'item', key: 'cat', label: 'Cat', run },
      { kind: 'item', key: 'cob', label: 'Cob', run },
      { kind: 'item', key: 'x', label: 'Xray', access: 'x', disabled: true, run },
    ]);
    c.key('c');
    c.key('x');
    c.key('o');
    expect(c.stack()).toEqual([0]);
  });

  it('with a submenu open a letter matches that menu, not the root', () => {
    const inner = vi.fn();
    const rootSpy = vi.fn();
    const { c, onClose } = make([
      { kind: 'item', key: 'r', label: 'Root', access: 'r', run: rootSpy },
      { kind: 'submenu', key: 's', label: 'Sub', entries: [
        { kind: 'item', key: 'i', label: 'Inner', access: 'i', run: inner },
      ] },
    ]);
    c.press(0, 1);
    c.key('r');
    expect(rootSpy).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    c.key('i');
    expect(inner).toHaveBeenCalledOnce();
    expect(rootSpy).not.toHaveBeenCalled();
  });

  it('an undeclared letter falls back to typeahead', () => {
    const { c } = make([
      { kind: 'item', key: 'a', label: 'Alpha', access: 'a', run },
      { kind: 'item', key: 'b', label: 'Beta', run },
    ]);
    c.key('b');
    expect(c.stack()).toEqual([1]);
  });

  it('an edge key calls onEdge and leaves the menu open', () => {
    const onEdge = vi.fn();
    const { c, onClose } = make([{ kind: 'item', key: 'a', label: 'A', run }], onEdge);
    c.hover(0, 0);
    c.key('ArrowRight');
    expect(onEdge).toHaveBeenCalledWith(1);
    c.key('ArrowLeft');
    expect(onEdge).toHaveBeenLastCalledWith(-1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
