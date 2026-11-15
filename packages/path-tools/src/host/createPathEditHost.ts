import type { PathEditHost } from '@weasel-js/core';
import { createEmitter } from '@weasel-js/registry';

/**
 * A {@link PathEditHost} that holds which path is open and which of its anchors are selected, and
 * says when either changes. One object serves as `<SceneCanvas pathEdit>`, as a `redrawOn` source,
 * and as what a panel over the open path reads (`useFilletControls`'s selection).
 */
export interface PathEditStore extends PathEditHost {
  selectedAnchors(): ReadonlySet<number>;
  setSelectedAnchors(next: ReadonlySet<number>): void;
  subscribe(listener: () => void): () => void;
}

/** The part of a mode registry (`@weasel-js/modes`' `ModeRegistry`) a path-edit host drives. */
export interface PathEditModes {
  current(): { id: string };
  setMode(id: string): void;
  subscribe(listener: () => void): () => void;
}

/** Options for {@link createPathEditHost}. */
export interface PathEditHostOptions {
  /** The path open at the start. Default none. */
  id?: string | null;
  /** Flat indices of the anchors selected in it at the start. */
  anchors?: Iterable<number>;
  /**
   * Makes path edit a mode: a path counts as open only while `modes` is in `mode`, opening one
   * enters it, and closing the open one leaves it for `exitMode`. A mode left some other way
   * keeps its target, so coming back to it reopens the same path.
   */
  modes?: PathEditModes;
  /** The path-edit mode's id. Default `'path-edit'`, as `@weasel-js/modes`' `PATH_EDIT`. */
  mode?: string;
  /** Where closing the open path leaves the registry. Default `'normal'`. */
  exitMode?: string;
}

/** A path-edit host that owns its state, optionally as a mode on `opts.modes`. */
export function createPathEditHost(opts: PathEditHostOptions = {}): PathEditStore {
  const { modes, mode = 'path-edit', exitMode = 'normal' } = opts;
  let id = opts.id ?? null;
  let anchors: ReadonlySet<number> = new Set(opts.anchors ?? []);
  const changed = createEmitter();
  const inMode = () => !modes || modes.current().id === mode;
  return {
    editingId: () => (inMode() ? id : null),
    setEditingId(next) {
      const wasOpen = inMode();
      const was = modes?.current().id;
      id = next;
      if (modes && next) modes.setMode(mode);
      else if (modes && wasOpen) modes.setMode(exitMode);
      // A mode switch has told every subscriber already.
      if (modes?.current().id === was) changed.emit();
    },
    selectedAnchors: () => anchors,
    setSelectedAnchors(next) {
      anchors = next;
      changed.emit();
    },
    subscribe(listener) {
      const off = changed.subscribe(listener);
      const offModes = modes?.subscribe(listener);
      return () => { off(); offModes?.(); };
    },
  };
}
