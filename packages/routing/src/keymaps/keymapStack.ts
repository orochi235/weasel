/**
 * The keymaps open on one surface, innermost last. A level opened by a held
 * leader stays open until that leader comes up; any other closes on the next
 * input. Closes made during one raw input apply when it ends, so the `key` and
 * `key-held` forms of a keystroke both see the keymap they arrived to.
 */
import { createEmitter } from '@weasel-js/registry';
import type { GestureBinding } from '../interactions/actions/binding';

/** What a key no open keymap binds does: `'modal'` swallows it and leaves the
 *  keymap open; `'cascade'` closes the keymap and dispatches it as if none were. */
export type KeymapUnbound = 'modal' | 'cascade';

/** One open level of a {@link KeymapStack}. */
export interface OpenKeymap {
  readonly id: string;
  readonly label: string;
  /** The keymap's bindings as declared, for a hint to list. */
  readonly bindings: readonly GestureBinding[];
  /** The gesture id of the leader holding this level open, while it is held. */
  readonly heldBy?: string;
  /** Whether input arrived while the leader was held, so its release closes the level. */
  readonly usedWhileHeld: boolean;
}

/** What the keymaps made of the raw input in progress: `'taken'` when one of
 *  them handled it, `'cascaded'` when it went on past them, `null` before either. */
export type KeymapVerdict = 'taken' | 'cascaded' | null;

/** The keymaps open on one surface, innermost last; a canvas's `keymaps` dep. */
export interface KeymapStack {
  /** Every open level, outermost first. */
  open(): readonly OpenKeymap[];
  innermost(): OpenKeymap | null;
  /** Open a level. `heldBy` names what holds it open; `bindings` are what a hint lists. */
  push(id: string, label: string, opts?: { heldBy?: string; bindings?: readonly GestureBinding[] }): void;
  /** Mark the levels the last raw input opened as held by `heldBy`: the key
   *  that opened them is still down. False when it opened none. */
  holdOpened(heldBy: string): boolean;
  /** The leader `heldBy` came up: close its level and those above it if
   *  input arrived meanwhile, else leave it open for one more input. */
  release(heldBy: string): void;
  /** Close the innermost level: Escape. */
  closeInnermost(): void;
  /** One of the keymaps took this input, or a pointer gesture went past them.
   *  Marks held levels used and closes once-levels down to the innermost held one. */
  inputSeen(): void;
  /** A key no keymap binds was swallowed: held levels count it as input, and nothing closes. */
  swallowed(): void;
  /** This input went on past the keymaps: as `inputSeen`, remembered as a cascade. */
  cascaded(): void;
  /** What the keymaps made of the input in progress. */
  verdict(): KeymapVerdict;
  closeAll(): void;
  /** Run `fn` as one raw input: closes made inside apply when it returns. Nests. */
  batch<T>(fn: () => T): T;
  subscribe(listener: () => void): () => void;
  getVersion(): number;
}

interface Level {
  id: string;
  label: string;
  bindings: readonly GestureBinding[];
  heldBy?: string;
  usedWhileHeld: boolean;
  openedIn: number;
}

/** An empty {@link KeymapStack}. `useGestureDispatcher` makes one per surface. */
export function createKeymapStack(): KeymapStack {
  let levels: Level[] = [];
  let version = 0;
  const changed = createEmitter();
  let depth = 0;
  let serial = 0;
  let pending: (() => void)[] = [];
  let verdict: KeymapVerdict = null;
  let snapshot: readonly OpenKeymap[] = [];

  const notify = (): void => {
    snapshot = levels.map(({ openedIn: _, ...rest }) => Object.freeze({ ...rest }));
    version++;
    changed.emit();
  };
  const later = (op: () => void): void => {
    if (depth > 0) pending.push(op);
    else op();
  };

  const settle = (): void => {
    const before = levels;
    // Levels opened by this very input are exempt: the leader that opened one
    // is part of the input, not the input it was opened for.
    const opened = (l: Level) => l.openedIn === serial && depth > 0;
    if (levels.some(opened)) return;
    for (const l of levels) if (l.heldBy !== undefined) l.usedWhileHeld = true;
    while (levels.length > 0 && levels.at(-1)!.heldBy === undefined) levels = levels.slice(0, -1);
    if (levels !== before) notify();
  };

  return {
    open: () => snapshot,
    innermost: () => snapshot.at(-1) ?? null,
    push: (id, label, opts) => {
      const heldBy = opts?.heldBy;
      const bindings = opts?.bindings ?? [];
      levels = [...levels, { id, label, bindings, ...(heldBy !== undefined ? { heldBy } : {}), usedWhileHeld: false, openedIn: serial }];
      if (depth > 0) verdict = 'taken';
      notify();
    },
    holdOpened: (heldBy) => {
      let held = false;
      levels = levels.map((l) => {
        if (l.openedIn !== serial || l.heldBy !== undefined) return l;
        held = true;
        return { ...l, heldBy };
      });
      if (held) notify();
      return held;
    },
    release: (heldBy) => {
      const i = levels.findIndex((l) => l.heldBy === heldBy);
      if (i === -1) return;
      const level = levels[i]!;
      if (level.usedWhileHeld) levels = levels.slice(0, i);
      else levels = levels.map((l) => (l === level ? { ...l, heldBy: undefined } : l)).map(dropUndefinedHeld);
      notify();
    },
    closeInnermost: () => {
      if (depth > 0) verdict = 'taken';
      later(() => {
        if (levels.length === 0) return;
        levels = levels.slice(0, -1);
        notify();
      });
    },
    inputSeen: () => {
      if (depth > 0) verdict ??= 'taken';
      later(settle);
    },
    cascaded: () => {
      if (depth > 0) verdict = 'cascaded';
      later(settle);
    },
    swallowed: () => {
      for (const l of levels) if (l.heldBy !== undefined) l.usedWhileHeld = true;
    },
    verdict: () => verdict,
    closeAll: () => {
      pending = [];
      if (levels.length === 0) return;
      levels = [];
      notify();
    },
    batch: (fn) => {
      if (depth === 0) { serial++; verdict = null; }
      depth++;
      try {
        return fn();
      } finally {
        depth--;
        if (depth === 0) {
          const ops = pending;
          pending = [];
          // Applied as part of this input, so a level it opened is still exempt.
          depth = 1;
          try { for (const op of ops) op(); } finally { depth = 0; }
          verdict = null;
        }
      }
    },
    subscribe: changed.subscribe,
    getVersion: () => version,
  };
}

function dropUndefinedHeld(l: Level): Level {
  if (l.heldBy !== undefined) return l;
  const { heldBy: _, ...rest } = l;
  return rest;
}
