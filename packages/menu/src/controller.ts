import { accessMatch } from './access';
import { entriesAt, isRow, type MenuEntry } from './entries';
import { firstRow, keyStep, type MenuStack } from './keys';
import type { Point, Rect } from './placement';
import { inTriangle } from './triangle';
import { typeaheadStep, type TypeaheadBuffer } from './typeahead';

export { TYPEAHEAD_RESET_MS } from './typeahead';
/** How long the pointer rests on a submenu row before its panel opens, in milliseconds. */
export const SUBMENU_OPEN_MS = 200;
/** How long a move toward an open submenu keeps it open while the pointer crosses other rows, in milliseconds. */
export const DIAGONAL_GRACE_MS = 300;

/** Clock and timer, injected so tests and headless hosts control time. */
export interface MenuScheduler {
  now(): number;
  /** Run `fn` after `ms`; returns a cancel. */
  set(fn: () => void, ms: number): () => void;
}

/** The real-time scheduler: `Date.now` and `setTimeout`. */
export const timerScheduler: MenuScheduler = {
  now: () => Date.now(),
  set: (fn, ms) => {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  },
};

/** What {@link createMenuController} needs: the entries, how to close, and optionally a clock. */
export interface MenuControllerOptions {
  entries: readonly MenuEntry[];
  /** Highlight the first row at open, as a keyboard open does. */
  highlightFirst?: boolean;
  /** The menu is done: an item was chosen, or it was dismissed. */
  onClose(): void;
  /** An arrow key ran off the menu: left from the first level (-1), or right from a row with no submenu (1). */
  onEdge?(dir: -1 | 1): void;
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

/** Creates the controller that runs one open menu: highlight, keys, submenus and typeahead. */
export function createMenuController(opts: MenuControllerOptions): MenuController {
  const { entries: root, onClose } = opts;
  const sched = opts.scheduler ?? timerScheduler;
  let stack: MenuStack = [opts.highlightFirst ? firstRow(root) : null];
  const listeners = new Set<() => void>();
  const panels = new Map<number, Rect>();
  let pending: (() => void) | null = null;
  let pendingKind: 'open' | 'diagonal' | null = null;
  let lastPoint: Point | null = null;
  let deferred: { level: number; index: number | null } | null = null;
  let typed: TypeaheadBuffer = { text: '', at: -Infinity };
  let closed = false;

  const set = (next: MenuStack) => {
    stack = next;
    for (const level of [...panels.keys()]) if (level >= next.length) panels.delete(level);
    for (const fn of listeners) fn();
  };
  const cancel = () => { pending?.(); pending = null; pendingKind = null; };
  const later = (kind: 'open' | 'diagonal', fn: () => void, ms: number) => {
    cancel();
    pendingKind = kind;
    pending = sched.set(() => { pending = null; pendingKind = null; if (!closed) fn(); }, ms);
  };
  const entryAt = (level: number, index: number) => entriesAt(root, stack, level)[index];
  const isRowAt = (level: number, index: number) => {
    const e = entryAt(level, index);
    return e !== undefined && isRow(e);
  };

  const finish = () => { closed = true; cancel(); onClose(); };
  const choose = (level: number, index: number) => {
    const e = entryAt(level, index);
    if (e?.kind !== 'item' || e.disabled) return;
    finish();
    e.run();
  };

  const openAt = (level: number, index: number) => {
    const e = entryAt(level, index);
    const base = [...stack.slice(0, level), index];
    set(e?.kind === 'submenu' && !e.disabled ? [...base, null] : base);
  };

  /** Heading from the point the deferral began toward the open child's near edge. */
  const headingIntoChild = (level: number, p: Point): boolean => {
    const child = panels.get(level + 1);
    const parent = panels.get(level);
    if (!child || !parent || !lastPoint || stack.length <= level + 1) return false;
    const edge = child.x >= parent.x ? child.x : child.x + child.w;
    return inTriangle(p, lastPoint, { x: edge, y: child.y }, { x: edge, y: child.y + child.h });
  };

  const hoverNow = (level: number, index: number | null) => {
    cancel();
    if (index === null && stack.length !== level + 1) return;
    const next = [...stack.slice(0, level), index];
    if (next.length !== stack.length || next[level] !== stack[level]) set(next);
    if (index === null) return;
    const e = entryAt(level, index);
    if (e?.kind === 'submenu' && !e.disabled) later('open', () => openAt(level, index), SUBMENU_OPEN_MS);
  };

  return {
    stack: () => stack,
    entriesAt: (level) => entriesAt(root, stack, level),
    key(key) {
      if (closed) return false;
      const r = keyStep(root, stack, key);
      if (r.handled) {
        cancel();
        if (r.stack !== stack) { typed = { text: '', at: -Infinity }; set(r.stack); }
        if (r.effect.kind === 'choose') choose(r.effect.level, r.effect.index);
        else if (r.effect.kind === 'close') finish();
        else if (r.effect.kind === 'edge') opts.onEdge?.(r.effect.dir);
        return true;
      }
      if (key.length !== 1 || key === ' ') return false;
      cancel();
      const level = stack.length - 1;
      const letter = accessMatch(entriesAt(root, stack, level), key);
      if (letter !== null) {
        const e = entryAt(level, letter);
        if (e?.kind === 'item' && !e.disabled) choose(level, letter);
        else if (e?.kind === 'submenu' && !e.disabled) {
          typed = { text: '', at: -Infinity };
          set([...stack.slice(0, level), letter, firstRow(e.entries)]);
        }
        return true;
      }
      const t = typeaheadStep(entriesAt(root, stack, level), stack[level] ?? null, typed, key, sched.now());
      typed = t.buffer;
      if (t.hit !== null) set([...stack.slice(0, level), t.hit]);
      return true;
    },
    hover(level, index, point) {
      if (closed || level >= stack.length) return;
      if (index !== null && !isRowAt(level, index)) return;
      const sameRow = index === stack[level];
      if (point && !sameRow && headingIntoChild(level, point)) {
        deferred = { level, index };
        if (pendingKind !== 'diagonal') {
          later('diagonal', () => { if (deferred) hoverNow(deferred.level, deferred.index); }, DIAGONAL_GRACE_MS);
        }
        return;
      }
      if (point) lastPoint = point;
      if (sameRow && stack.length > level + 1) { cancel(); return; }
      if (sameRow && pendingKind === 'open') return;
      hoverNow(level, index);
    },
    press(level, index) {
      if (closed || level >= stack.length || !isRowAt(level, index)) return;
      if (stack[level] === index && stack.length > level + 1) return;
      cancel();
      if (entryAt(level, index)?.kind === 'item') choose(level, index);
      else openAt(level, index);
    },
    setPanel(level, rect) { panels.set(level, rect); },
    subscribe(fn) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
    dispose() {
      closed = true;
      cancel();
      listeners.clear();
    },
  };
}
