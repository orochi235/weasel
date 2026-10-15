import { entriesAt, type MenuEntry } from './entries';
import { firstRow, keyStep, type MenuStack } from './keys';
import type { Point, Rect } from './placement';
import { inTriangle } from './triangle';
import { typeaheadMatch } from './typeahead';

export const SUBMENU_OPEN_MS = 200;
export const DIAGONAL_GRACE_MS = 300;
export const TYPEAHEAD_RESET_MS = 500;

/** Clock and timer, injected so tests and headless hosts control time. */
export interface MenuScheduler {
  now(): number;
  /** Run `fn` after `ms`; returns a cancel. */
  set(fn: () => void, ms: number): () => void;
}

export const timerScheduler: MenuScheduler = {
  now: () => Date.now(),
  set: (fn, ms) => {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  },
};

export interface MenuControllerOptions {
  entries: readonly MenuEntry[];
  /** Highlight the first row at open, as a keyboard open does. */
  highlightFirst?: boolean;
  /** The menu is done: an item was chosen, or it was dismissed. */
  onClose(): void;
  scheduler?: MenuScheduler;
}

/** One open menu's behavior, independent of what draws it. */
export interface MenuController {
  stack(): MenuStack;
  entriesAt(level: number): readonly MenuEntry[];
  /** Returns whether the key was the menu's. */
  key(key: string): boolean;
  /** The pointer is over row `index` of `level`, or over none of its rows. */
  hover(level: number, index: number | null, point?: Point): void;
  press(level: number, index: number): void;
  /** Where `level`'s panel is, for the diagonal allowance. */
  setPanel(level: number, rect: Rect): void;
  subscribe(fn: () => void): () => void;
  dispose(): void;
}

export function createMenuController(opts: MenuControllerOptions): MenuController {
  const { entries: root, onClose } = opts;
  const sched = opts.scheduler ?? timerScheduler;
  let stack: MenuStack = [opts.highlightFirst ? firstRow(root) : null];
  const listeners = new Set<() => void>();
  const panels = new Map<number, Rect>();
  let pending: (() => void) | null = null;
  let lastPoint: Point | null = null;
  let typed = '';
  let typedAt = -Infinity;
  let live = true;

  const set = (next: MenuStack) => {
    stack = next;
    for (const fn of listeners) fn();
  };
  const cancel = () => { pending?.(); pending = null; };
  const later = (fn: () => void, ms: number) => {
    cancel();
    pending = sched.set(() => { pending = null; if (live) fn(); }, ms);
  };

  const choose = (level: number, index: number) => {
    const e = entriesAt(root, stack, level)[index];
    if (e?.kind !== 'item' || e.disabled) return;
    cancel();
    onClose();
    e.run();
  };

  const openAt = (level: number, index: number) => {
    const e = entriesAt(root, stack, level)[index];
    const base = [...stack.slice(0, level), index];
    set(e?.kind === 'submenu' && !e.disabled ? [...base, null] : base);
  };

  /** Heading from the last point toward the open child's near edge. */
  const headingIntoChild = (level: number, p: Point): boolean => {
    const child = panels.get(level + 1);
    const parent = panels.get(level);
    if (!child || !parent || !lastPoint || stack.length <= level + 1) return false;
    const edge = child.x >= parent.x ? child.x : child.x + child.w;
    return inTriangle(p, lastPoint, { x: edge, y: child.y }, { x: edge, y: child.y + child.h });
  };

  const hoverNow = (level: number, index: number | null) => {
    if (index === null) {
      if (stack.length === level + 1) set([...stack.slice(0, level), null]);
      return;
    }
    const e = entriesAt(root, stack, level)[index];
    set([...stack.slice(0, level), index]);
    if (e?.kind === 'submenu' && !e.disabled) later(() => openAt(level, index), SUBMENU_OPEN_MS);
    else cancel();
  };

  return {
    stack: () => stack,
    entriesAt: (level) => entriesAt(root, stack, level),
    key(key) {
      const r = keyStep(root, stack, key);
      if (r.handled) {
        cancel();
        if (r.stack !== stack) set(r.stack);
        if (r.effect.kind === 'choose') choose(r.effect.level, r.effect.index);
        else if (r.effect.kind === 'close') onClose();
        return true;
      }
      if (key.length !== 1 || key === ' ') return false;
      const now = sched.now();
      typed = (now - typedAt < TYPEAHEAD_RESET_MS ? typed : '') + key;
      typedAt = now;
      const level = stack.length - 1;
      const hit = typeaheadMatch(entriesAt(root, stack, level), stack[level] ?? null, typed);
      if (hit !== null) set([...stack.slice(0, level), hit]);
      return true;
    },
    hover(level, index, point) {
      if (point && index !== stack[level] && headingIntoChild(level, point)) {
        lastPoint = point;
        later(() => hoverNow(level, index), DIAGONAL_GRACE_MS);
        return;
      }
      if (point) lastPoint = point;
      if (index === stack[level] && stack.length > level + 1) { cancel(); return; }
      hoverNow(level, index);
    },
    press(level, index) {
      const e = entriesAt(root, stack, level)[index];
      cancel();
      if (e?.kind === 'item') choose(level, index);
      else openAt(level, index);
    },
    setPanel(level, rect) { panels.set(level, rect); },
    subscribe(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    dispose() {
      live = false;
      cancel();
      listeners.clear();
    },
  };
}
