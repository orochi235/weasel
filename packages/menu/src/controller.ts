import { createEmitter } from '@weasel-js/registry';
import { createNumberValues } from './numberValues';
import { createHeldValues } from './heldValues';
import { entriesAt, isRow, type MenuColorEntry, type MenuEntry, type MenuNumberEntry, type MenuTextEntry } from './entries';
import { firstRow, type MenuStack } from './keys';
import { EMPTY_TYPEAHEAD, timerScheduler, type Scheduler, type TypeaheadBuffer } from '@weasel-js/ui-logic';
import { planKey } from './keyPlan';
import type { Point, Rect } from './placement';
import { inTriangle } from './triangle';

export { TYPEAHEAD_RESET_MS } from '@weasel-js/ui-logic';
export { timerScheduler };
/** How long the pointer rests on a submenu row before its panel opens, in milliseconds. */
export const SUBMENU_OPEN_MS = 200;
/** How long a move toward an open submenu keeps it open while the pointer crosses other rows, in milliseconds. */
export const DIAGONAL_GRACE_MS = 300;

/** Clock and timer, injected so tests and headless hosts control time. */
export type MenuScheduler = Scheduler;

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
  /** What a number row holds now: the last value set while the menu is open, else the one it opened with. */
  numberValue(e: MenuNumberEntry): number | undefined;
  /** Write a number row, held within its bounds. The menu stays open; subscribers hear it. */
  setNumber(e: MenuNumberEntry, value: number): void;
  /** Move a number row by a spin-button key: an arrow, Page Up or Down, Home or End. False for any other key. */
  spin(e: MenuNumberEntry, key: string): boolean;
  /** What a text row holds now: the last value set while the menu is open, else the one it opened with. */
  textValue(e: MenuTextEntry): string | undefined;
  /** Write a text row. The menu stays open; subscribers hear it. */
  setText(e: MenuTextEntry, value: string): void;
  /** What a color row holds now: the last value set while the menu is open, else the one it opened with. */
  colorValue(e: MenuColorEntry): string | undefined;
  /** Write a color row that has a `set`. The menu stays open; subscribers hear it. */
  setColor(e: MenuColorEntry, value: string): void;
  subscribe(fn: () => void): () => void;
  dispose(): void;
}

/** Heading from `from`, the point the deferral began, toward the near edge of the child of `level`'s panel. */
function headingIntoChild(
  panels: ReadonlyMap<number, Rect>, stack: MenuStack, from: Point | null, level: number, p: Point,
): boolean {
  const child = panels.get(level + 1);
  const parent = panels.get(level);
  if (!child || !parent || !from || stack.length <= level + 1) return false;
  const edge = child.x >= parent.x ? child.x : child.x + child.w;
  return inTriangle(p, from, { x: edge, y: child.y }, { x: edge, y: child.y + child.h });
}

/** Creates the controller that runs one open menu: highlight, keys, submenus and typeahead. */
export function createMenuController(opts: MenuControllerOptions): MenuController {
  const { entries: root, onClose } = opts;
  const sched = opts.scheduler ?? timerScheduler;
  let stack: MenuStack = [opts.highlightFirst ? firstRow(root) : null];
  let listeners = createEmitter();
  const panels = new Map<number, Rect>();
  let pending: (() => void) | null = null;
  let pendingKind: 'open' | 'diagonal' | null = null;
  let lastPoint: Point | null = null;
  let deferred: { level: number; index: number | null } | null = null;
  let typed: TypeaheadBuffer = EMPTY_TYPEAHEAD;
  let closed = false;
  const notify = () => listeners.emit();
  const numbers = createNumberValues(notify, () => closed);
  const set = (next: MenuStack) => {
    stack = next;
    for (const level of [...panels.keys()]) if (level >= next.length) panels.delete(level);
    notify();
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
    if (e.keepOpen) {
      // Highlighted, so a pointer press leaves the keyboard on the row it ran.
      if (stack[level] !== index || stack.length !== level + 1) set([...stack.slice(0, level), index]);
      e.run();
      notify();
      return;
    }
    finish();
    e.run();
  };

  const openAt = (level: number, index: number) => {
    const e = entryAt(level, index);
    const base = [...stack.slice(0, level), index];
    set(e?.kind === 'submenu' && !e.disabled ? [...base, null] : base);
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
      const plan = planKey(root, stack, typed, key, sched.now());
      if (!plan) return false;
      cancel();
      typed = plan.typed;
      if (plan.stack !== stack) set(plan.stack);
      const { effect } = plan;
      if (effect.kind === 'choose') choose(effect.level, effect.index);
      else if (effect.kind === 'close') finish();
      else if (effect.kind === 'edge') opts.onEdge?.(effect.dir);
      else if (effect.kind === 'step') {
        const e = entryAt(effect.level, effect.index);
        if (e?.kind === 'number') numbers.spin(e, effect.dir > 0 ? 'ArrowUp' : 'ArrowDown');
      }
      return true;
    },
    hover(level, index, point) {
      if (closed || level >= stack.length) return;
      if (index !== null && !isRowAt(level, index)) return;
      const sameRow = index === stack[level];
      if (point && !sameRow && headingIntoChild(panels, stack, lastPoint, level, point)) {
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
    ...numbers,
    ...createHeldValues(notify, () => closed),
    subscribe: (fn) => listeners.subscribe(fn),
    dispose() {
      closed = true;
      cancel();
      listeners = createEmitter();
    },
  };
}
