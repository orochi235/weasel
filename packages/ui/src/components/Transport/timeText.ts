import { decimal, present } from '@weasel-js/quantity';

/** `value` at exactly `places` decimals, ungrouped, in `locale`: shown and spoken. */
function fixed(value: number, places: number, locale: string): { text: string; spoken: string } {
  const { text, spoken } = present(value, decimal({ places, grouping: false }), { locale });
  return { text, spoken };
}

/** `ms` as seconds at `places` decimals in `locale`: `1.50s`, spoken `1.50 seconds`. Every time the playback
 *  controls write goes through here or {@link millisecondsText}, so a readout and a ruler beside it agree. */
export function secondsText(ms: number, places: number, locale: string): { text: string; spoken: string } {
  const n = fixed(ms / 1000, places, locale);
  return { text: `${n.text}s`, spoken: `${n.spoken} seconds` };
}

/** `ms` at `places` decimals in `locale`: `250ms`. */
export function millisecondsText(ms: number, places: number, locale: string): string {
  return `${fixed(ms, places, locale).text}ms`;
}
