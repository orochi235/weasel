import { rowKey, treeKey, type RowKeyAction, type RowKeysShape, type TreeShape } from '@weasel-js/headless';
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { nudgeOf } from './nudgeKey';
import { modsOf, type PressModifiers } from './useReorderDragList';
import { useRemovedRowFocus, type FocusRow } from './useRemovedRowFocus';
import { useTypeahead } from './useTypeahead';

/** What a list that folds tells {@link useRowNavigation}, so Right and Left open, close, and walk it. */
export interface RowTree {
  /** Whether the row can open, children shown or not. */
  isBranch(id: string): boolean;
  isOpen(id: string): boolean;
  /** Open or close the row; `false` when it cannot be. */
  toggle(id: string): boolean;
}

/** What {@link useRowNavigation} reads. Every callback is optional: a key with none to call does what a plain move does, or nothing. */
export interface RowNavigationOptions<E extends HTMLElement> {
  /** Every row the keys walk, in drawn order. A tree names each row's parent. */
  rows: readonly FocusRow[];
  /** Which rows are selected: with no row focused yet, the first of them takes the tab stop. */
  isSelected?(id: string): boolean;
  /** The element that takes focus for a row. Default: the element under `rowRef`. */
  target?(id: string, els: ReadonlyMap<string, E>): HTMLElement | null | undefined;
  /** Re-anchor on every focus a range move did not cause, a pointer's included. Otherwise only the first focus anchors. */
  anchorOnFocus?: boolean;
  /** A plain move landed on `id`. The anchor is already there. */
  onReach?(id: string): void;
  /** Shift with Up, Down, Home, or End reached `to` from `from`; the anchor is unchanged. Unset, Shift moves as a plain move does. */
  onExtend?(to: string, from: string): void;
  /** Alt+Up (`-1`) or Alt+Down (`1`) on a row. Focus follows the row unless this returns `false`. Unset, Alt moves focus as a plain move does. */
  onNudge?(id: string, delta: -1 | 1): boolean | void;
  /** Enter or Space on a row, with the modifiers held. */
  onActivate?(id: string, mods: PressModifiers): void;
  /** Cmd/Ctrl+A. */
  onSelectAll?(): void;
  /** Set for a list that folds: Right opens a closed branch, then steps to its first child; Left closes an open branch, else steps to the parent. */
  tree?: RowTree;
  /** Each row's text. Set, typing moves focus to the next row whose text starts with what was typed. */
  textOf?(id: string): string;
}

/** What {@link useRowNavigation} hands back for the consumer to put on its rows. */
export interface RowNavigation<E extends HTMLElement> {
  /** The one row in the tab order: the one last focused, else the first selected, else the first. */
  tabStop: string | undefined;
  /** Where a range starts. A selection that keeps its own anchor reads and writes it here. */
  anchor: { current: string | null };
  els: { readonly current: Map<string, E> };
  /** Put on each row's element. */
  rowRef(id: string): (el: E | null) => void;
  focus(id: string): void;
  /** Focus `id` after the next render, if one comes within a frame: a move the consumer never draws must not pull focus on some later, unrelated render. */
  focusLater(id: string): void;
  /** Move focus from row `from` to the row at `index`, clamped, extending a range when `extend` and `onExtend` is set. */
  go(from: string, index: number, extend: boolean): void;
  /** Call when a row's own element takes focus. */
  onFocus(id: string): void;
  /** Call with a key pressed on a row's own element. Returns whether the key was handled; a handled key's default is prevented. */
  onKeyDown(id: string, e: KeyboardEvent): boolean;
}

/** Up and Down stop at the ends of a list of rows, every one of which takes focus. */
const ROWS = { wrap: false } as const;

/**
 * One row of a list in the tab order, and the keys that move between rows: Up/Down and Home/End, Shift to extend a
 * range, Alt+Up/Down to nudge, Enter/Space to activate, and optionally tree-style Right/Left, typeahead, and Cmd/Ctrl+A.
 * Focus stays in the list when the row holding it is removed.
 */
export function useRowNavigation<E extends HTMLElement>(opts: RowNavigationOptions<E>): RowNavigation<E> {
  const { rows } = opts;
  const [focusId, setFocusId] = useState<string | null>(null);
  const anchor = useRef<string | null>(null);
  /** The row a range move is focusing, whose focus must not re-anchor. */
  const extending = useRef<string | null>(null);
  const pending = useRef<string | null>(null);
  const pendingFrame = useRef(0);
  const typeahead = useTypeahead();

  const targetIn = (id: string, map: ReadonlyMap<string, E>) => (opts.target ? opts.target(id, map) : map.get(id));
  const { els, rowRef } = useRemovedRowFocus<E>(rows, (id, map) => targetIn(id, map)?.focus());
  const targetOf = (id: string) => targetIn(id, els.current);
  const focus = (id: string) => targetOf(id)?.focus();

  useLayoutEffect(() => {
    const id = pending.current;
    if (id == null) return;
    pending.current = null;
    const el = targetOf(id);
    if (el && document.activeElement !== el) el.focus();
  });
  useEffect(() => () => cancelAnimationFrame(pendingFrame.current), []);

  const focusLater = (id: string) => {
    pending.current = id;
    cancelAnimationFrame(pendingFrame.current);
    pendingFrame.current = requestAnimationFrame(() => { pending.current = null; });
  };

  const tabStop = rows.some((r) => r.id === focusId)
    ? (focusId ?? undefined)
    : (rows.find((r) => opts.isSelected?.(r.id)) ?? rows[0])?.id;

  const go = (from: string, index: number, extend: boolean) => {
    const to = rows[Math.max(0, Math.min(rows.length - 1, index))];
    if (!to) return;
    if (extend && opts.onExtend) {
      extending.current = to.id;
      focus(to.id);
      extending.current = null;
      opts.onExtend(to.id, from);
      return;
    }
    anchor.current = to.id;
    focus(to.id);
    opts.onReach?.(to.id);
  };

  const handle = rowKeyHandler({ rows, opts, typeahead, focus, focusLater, go });

  return {
    tabStop,
    anchor,
    els,
    rowRef,
    focus,
    focusLater,
    go,
    onFocus: (id) => {
      setFocusId(id);
      if (!opts.anchorOnFocus) anchor.current ??= id;
      else if (extending.current !== id) anchor.current = id;
    },
    onKeyDown: (id, e) => {
      const handled = handle(id, e);
      if (handled) e.preventDefault();
      return handled;
    },
  };
}

interface KeyCtx {
  rows: readonly FocusRow[];
  opts: RowNavigationOptions<HTMLElement>;
  typeahead: ReturnType<typeof useTypeahead>;
  focus(id: string): void;
  focusLater(id: string): void;
  go(from: string, index: number, extend: boolean): void;
}

/** What a key on a row does; the returned function says whether it handled the key. */
function rowKeyHandler({ rows, opts, typeahead, focus, focusLater, go }: KeyCtx): (id: string, e: KeyboardEvent) => boolean {
  const typeAhead = (key: string, from: number): boolean => {
    const hit = typeahead.type(rows, from, key, { label: (r) => opts.textOf!(r.id) });
    if (hit === null) return false;
    focus(rows[hit]!.id);
    return true;
  };

  const tree = opts.tree;
  const treeShape: TreeShape<FocusRow> | undefined = tree && {
    isBranch: (r) => tree.isBranch(r.id),
    isOpen: (r) => tree.isOpen(r.id),
    isChildOf: (child, parent) => child.parentId === parent.id,
  };
  const shape: RowKeysShape<FocusRow> = {
    ...ROWS,
    ...(treeShape ? { tree: treeShape } : {}),
    selectAll: !!opts.onSelectAll,
    activate: !!opts.onActivate,
    typeahead: !!opts.textOf,
  };

  const apply = (id: string, i: number, e: KeyboardEvent, act: RowKeyAction | null): boolean => {
    if (!act) return false;
    switch (act.kind) {
      case 'selectAll': opts.onSelectAll!(); return true;
      case 'move': if (act.at !== null) go(id, act.at, act.extend); return true;
      case 'activate': opts.onActivate!(id, modsOf(e)); return true;
      case 'type': return typeAhead(e.key, i) || act.held;
      case 'toggle': {
        if (tree!.toggle(id) || e.key !== 'ArrowLeft') return true;
        // A branch that would not close: Left steps to the parent instead.
        const t = treeKey(rows, i, e.key, { ...treeShape!, canToggle: (r) => r.id !== id });
        return apply(id, i, e, t.handled && !('toggle' in t) ? { kind: 'move', at: t.at, extend: false } : null);
      }
    }
  };

  return (id, e) => {
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) return false;
    const delta = nudgeOf(e);
    if (delta !== null && opts.onNudge) {
      if (opts.onNudge(id, delta) !== false) focusLater(id);
      return true;
    }
    return apply(id, i, e, rowKey(rows, i, e, shape, opts.textOf ? typeahead.searching() : false));
  };
}
