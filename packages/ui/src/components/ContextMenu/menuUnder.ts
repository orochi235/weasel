import type { OpenMenu } from '@weasel-js/core';
import type { MenuEntry } from '@weasel-js/menu';

/** `entries` as a menu open under `el`: placed below it, flipping above and right-aligning as `placeMenuUnder` does, or above it first with `above`. */
export function menuUnder(el: Element, entries: ReadonlyArray<MenuEntry>, source: OpenMenu['source'], seq: number, above = false): OpenMenu {
  const r = el.getBoundingClientRect();
  return { seq, entries, client: { x: r.left, y: r.bottom }, under: { x: r.left, y: r.top, w: r.width, h: r.height }, ...(above ? { above } : {}), source };
}
