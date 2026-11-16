/**
 * The selection contract core keeps and an editing layer fills: the options `<SceneCanvas selectionOptions>`
 * takes, and the factory a preset hands the canvas to build its own selection over the scene's store.
 */
import type { SelectionStore as Store } from '@weasel-js/select';
import type { SelectionApi, SelectionExtendKey, SelectionMode } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';

/** Somewhere selection lives. `Scene` satisfies it; so does any store with the same three methods. */
export type SelectionStore = Store<NodeId>;

/** How a selection answers a click, and what it starts holding. */
export interface SelectionOptions {
  /** Default `'single'`. */
  mode?: SelectionMode;
  /** The key that adds or removes the pressed id. Default Cmd on Apple platforms, Ctrl
   *  elsewhere. Ignored in single-mode. */
  extend?: SelectionExtendKey;
  /** The key that selects everything from the last pressed id to this one,
   *  along `order` or what the click hands `applyClick`. Default `'shift'`,
   *  unless `extend` is `'shift'`, which leaves nothing ranging. It beats
   *  `extend` when both name one key. Ignored in single-mode. */
  range?: SelectionExtendKey;
  /** The sequence a range walks: a layer panel's rows, a timeline's tracks.
   *  Default is the order the store paints in, back to front, where it is a
   *  scene; otherwise the range key replaces. */
  order?: () => Iterable<NodeId>;
  /** What an empty store is seeded with. Default `[]`. */
  initial?: readonly NodeId[];
  /** When `true`, every mutator (`set`/`add`/`remove`/`toggle`/`clear`/
   *  `applyClick`) is a no-op. Undo, redo and other writers of the store
   *  still move it. */
  lock?: boolean;
}

/**
 * Builds a selection api over `store`, reading `options()` live. Not a hook: a canvas calls it once per store, and
 * re-renders on the store's changes itself.
 */
export type SelectionFactory = (store: SelectionStore, options: () => SelectionOptions) => SelectionApi;
