/**
 * The edit overlay's own undo. Every change to its text, its runs, or the node style it rewrote is a step; Undo and
 * Redo walk them and put the selection back as it stood. The browser's stack cannot serve: Chromium clears it the
 * moment a script writes the overlay's DOM, which every restyle, paste, and armed character does, so after one Cmd+B
 * nothing typed before it could be undone.
 */
import type { StyledRun, TextStyle } from '@weasel-js/text';
import type { TextEditSelection } from './textEditTypes';

/** What one step puts back: the runs less the caret holder, the selection, and the node style the edit holds. */
export interface OverlayState {
  runs: StyledRun[];
  selection: TextEditSelection;
  style: TextStyle | null;
}

/** How a change joins the one before it: typing and deleting each join a run of their own kind that the caret
 *  has not left, one composition joins itself, and anything else is a step alone. */
export type ChangeKind = 'type' | 'delete' | 'compose' | 'other';

/** The kind of change an `InputEvent` of `inputType` makes. A script's plain `beforeinput` `Event` has none. */
export function changeKind(inputType: string | undefined): ChangeKind {
  if (inputType === 'insertText') return 'type';
  if (inputType === 'insertCompositionText') return 'compose';
  return inputType?.startsWith('delete') ? 'delete' : 'other';
}

/** The history step an `InputEvent` of `inputType` asks for, or `null`. */
export function historyInput(inputType: string): 'undo' | 'redo' | null {
  return inputType === 'historyUndo' ? 'undo' : inputType === 'historyRedo' ? 'redo' : null;
}

export interface OverlayHistory {
  /** Note the overlay as it stands, before a change of `kind`. */
  before(kind: ChangeKind): void;
  /** The change `before` announced is made: a step, if it changed anything. */
  after(): void;
  /** The next change starts a step of its own. */
  seal(): void;
  undo(): void;
  redo(): void;
}

/** Steps kept; the oldest go first. */
const DEPTH = 200;

/** A history reading the overlay through `read` and putting a step back through `write`. */
export function overlayHistory(host: {
  read: () => OverlayState | null;
  write: (state: OverlayState) => void;
}): OverlayHistory {
  const undos: OverlayState[] = [];
  const redos: OverlayState[] = [];
  let pending: { kind: ChangeKind; state: OverlayState } | null = null;
  /** The last step's kind and the caret it left, which a change of that kind joins it from. */
  let open: { kind: ChangeKind; caret: TextEditSelection } | null = null;

  const step = (from: OverlayState[], to: OverlayState[]): void => {
    const target = from.pop();
    if (!target) return;
    const now = host.read();
    if (now) to.push(now);
    pending = null;
    open = null;
    host.write(target);
  };

  return {
    before(kind) {
      const state = host.read();
      pending = state ? { kind, state } : null;
    },
    after() {
      const p = pending;
      pending = null;
      const now = p && host.read();
      if (!p || !now || sameContent(p.state, now)) return;
      const joins = open !== null && open.kind === p.kind && p.kind !== 'other'
        && (p.kind === 'compose' || caretAt(p.state.selection, open.caret));
      if (!joins) {
        undos.push(p.state);
        if (undos.length > DEPTH) undos.shift();
      }
      redos.length = 0;
      open = { kind: p.kind, caret: now.selection };
    },
    seal() {
      open = null;
    },
    undo: () => step(undos, redos),
    redo: () => step(redos, undos),
  };
}

function sameContent(a: OverlayState, b: OverlayState): boolean {
  return JSON.stringify([a.runs, a.style]) === JSON.stringify([b.runs, b.style]);
}

/** Whether `sel` is a collapsed caret at `caret`'s. */
function caretAt(sel: TextEditSelection, caret: TextEditSelection): boolean {
  return sel.start === sel.end && caret.start === caret.end && sel.start === caret.start;
}
