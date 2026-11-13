import { compact, decimal } from './kinds/plain';
import { parseAs, present } from './present';
import type { Display } from './quantity';

/** Numbers that exercise every mark a locale writes: a sign, groups, a decimal, and a magnitude suffix. */
const PROBES = [-1_234_567.891, 0.5, 1_500, -0.25, 98_765_432.1, 40_000];
const PROBE_DISPLAYS: Display[] = [decimal({ maxPlaces: 20, grouping: false }), decimal(), compact({ places: 1 })];

const settled = new Map<string, string>();

/**
 * The locale a number field shows and reads numbers in, given the one it is
 * asked for: `requested` itself where every probe number it writes reads back
 * as that number; else `requested` with Latin digits (`-u-nu-latn`), for a
 * numbering system the reader does not know; else `en-US`. No tag, or one
 * `Intl` refuses, is `en-US`.
 *
 * A field shows and reads through this one locale, so text it shows never
 * commits as another number: in `de-DE`, `1.500` is 1500 both ways.
 */
export function fieldLocale(requested?: string): string {
  if (requested === undefined || requested === '') return 'en-US';
  const known = settled.get(requested);
  if (known !== undefined) return known;
  const chosen = [requested, latinOf(requested)].find((tag) => tag !== undefined && roundTrips(tag)) ?? 'en-US';
  settled.set(requested, chosen);
  return chosen;
}

function latinOf(tag: string): string | undefined {
  try {
    return new Intl.Locale(tag, { numberingSystem: 'latn' }).toString();
  } catch {
    return undefined;
  }
}

/** Whether every probe shown in `locale` reads back as itself, to the places it shows. */
function roundTrips(locale: string): boolean {
  try {
    Intl.getCanonicalLocales(locale);
    return PROBE_DISPLAYS.every((d) =>
      PROBES.every((v) => {
        const text = present(v, d, { locale }).text;
        return parseAs(text, d, { locale }) === parseAs(present(v, d, { locale: 'en-US' }).text, d);
      }),
    );
  } catch {
    return false;
  }
}
