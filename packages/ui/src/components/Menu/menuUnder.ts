import type { OpenMenu } from '@weasel-js/routing';
import type { MenuEntry, MenuSide } from '@weasel-js/menu';

/** `entries` as a menu open from `el`: placed on `side` of it (default below), flipping and aligning as `placeMenuUnder` does. */
export function menuUnder(el: Element, entries: ReadonlyArray<MenuEntry>, source: OpenMenu['source'], seq: number, side?: MenuSide): OpenMenu {
  const r = el.getBoundingClientRect();
  return { seq, entries, client: { x: r.left, y: r.bottom }, under: { x: r.left, y: r.top, width: r.width, height: r.height }, ...(side ? { side } : {}), source };
}
