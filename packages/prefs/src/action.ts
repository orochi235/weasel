import type { PrefBase } from './schema';

/** What a {@link PrefAction}'s `run` is told. */
export interface PrefActionContext {
  /** The path the action sits at on the surface drawing it. */
  path: string;
}

/** How a schema-driven UI should present an action leaf. */
export type PrefActionControl = 'button' | 'icon';

/**
 * A leaf that holds no value: a button among the rows or in a bar. A store
 * neither reads nor writes one, and its path is not a {@link PrefPath}.
 *
 * It fires one of two things. `action` names an action the host registered,
 * by key, which keeps the leaf plain data: it survives JSON, so a layout
 * holding it can be saved and exported. `run` is code the schema carries.
 * A leaf with both fires `action`. While a promise `run` returned is
 * pending, the button is disabled.
 */
export interface PrefAction extends PrefBase<'action', undefined> {
  /** The key of a registered action to fire: its id, or `id:variant` for one
   *  variant of a parametric action. The leaf's `name` and `icon` are what
   *  the button shows, over the registered action's own. */
  action?: string;
  /** What to call when no `action` is named. */
  run?: (ctx: PrefActionContext) => void | Promise<void>;
  /** The button's text. Default: the leaf's `name`. */
  label?: string;
  /** `button` reads its label; `icon` is the icon alone, with the label in
   *  its tooltip. Unset: a button in a row, an icon in a bar. */
  control?: PrefActionControl;
}
