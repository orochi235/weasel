import { type Still, stillFor } from './still';

/** A lab embedded bare: presenting, with no chrome, maybe held still, maybe on a color of its own. */
export interface Bare {
  /** Set by `?bare=still` or `?bare=still=<ms>`. */
  still: Still | null;
  /** The color behind the lab, `#` and 3, 4, 6 or 8 hex digits, from `bg`; `null` leaves it clear. */
  bg: string | null;
}

const HEX = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** The bare embed a page's query string asks for: `?bare`, `?bare=still`, `?bare=still=<ms>`,
 *  each with an optional `&bg=<hex>`. `search` defaults to the page's; `null` when it is not bare. */
export function bareOf(search?: string): Bare | null {
  const query = search ?? (typeof location === 'undefined' ? '' : location.search);
  const params = new URLSearchParams(query);
  if (!params.has('bare')) return null;
  const mode = params.get('bare') ?? '';
  const still = mode === 'still' ? {} : mode.startsWith('still=') ? stillFor(mode.slice(6)) : null;
  const hex = HEX.exec(params.get('bg') ?? '')?.[1];
  return { still, bg: hex ? `#${hex.toLowerCase()}` : null };
}
