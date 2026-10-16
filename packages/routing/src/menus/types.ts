import type { BodyTarget } from '@weasel-js/gestures';
import type { PrefGroup } from '@weasel-js/prefs';

/** Which canvas hit a menu answers. Every field given must match. */
export interface MenuWhen {
  bodyTarget?: BodyTarget | readonly BodyTarget[];
  bodyKind?: string | readonly string[];
}

/** A menu as data: a prefs schema drawn as a menu (`resolveSchemaMenu`).
 *  A def without `when` is opened only by id, from chrome. */
export interface MenuDef {
  id: string;
  when?: MenuWhen;
  schema: PrefGroup;
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
