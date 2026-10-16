import type { BodyTarget } from '@weasel-js/gestures';

/** One line of a declared menu: an action, a submenu, or every variant of an action. */
export type MenuDefEntry =
  | { action: string; params?: Record<string, unknown>; label?: string }
  | { submenu: string; label: string; sections: MenuDefEntry[][] }
  | { actionVariants: string };

/** Which canvas hit a menu answers. Every field given must match. */
export interface MenuWhen {
  bodyTarget?: BodyTarget | readonly BodyTarget[];
  bodyKind?: string | readonly string[];
}

/** A menu as data. Items reference actions by id; a separator is drawn
 *  between sections. A def without `when` is opened only by id, from chrome. */
export interface MenuDef {
  id: string;
  when?: MenuWhen;
  sections: MenuDefEntry[][];
}

/** What a right-click landed on. */
export interface MenuHit {
  bodyTarget?: BodyTarget;
  bodyKind?: string;
}

/** A def with who contributed it: a tool id, or `null` for ambient. */
export interface OwnedMenuDef {
  def: MenuDef;
  owner: string | null;
}
