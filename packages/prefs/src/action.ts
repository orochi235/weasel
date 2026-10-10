import type { PrefBase } from './schema';

/** What a {@link PrefAction}'s `run` is told. */
export interface PrefActionContext {
  /** The path the action sits at on the surface drawing it. */
  path: string;
}

/**
 * A leaf that holds no value: a button among the rows, which calls `run`.
 * A store neither reads nor writes one, and its path is not a
 * {@link PrefPath}. While a promise `run` returned is pending, the button
 * is disabled.
 */
export interface PrefAction extends PrefBase<'action', undefined> {
  run: (ctx: PrefActionContext) => void | Promise<void>;
  /** The button's text. Default: the leaf's `name`. */
  label?: string;
}
