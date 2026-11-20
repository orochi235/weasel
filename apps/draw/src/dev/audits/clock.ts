/** The lanes' clock axis: local times, at round steps of local time. */
import type { SpanStripsRuler } from '@weasel-js/ui/components/SpanStrip';

const MIN = 60_000;

/** How far `timeZone`'s wall clock (the viewer's, when not given) runs ahead of UTC at `at`, in ms. */
export function zoneOffsetAt(at: number, timeZone?: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
    ...(timeZone ? { timeZone } : {}),
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wall = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'));
  return wall - Math.floor(at / MIN) * MIN;
}

/** A ruler of clock times, `9:40 PM` or `21:40` as the locale has it, ticked on whole 5, 10, 15 or 30 minutes of the
 *  zone's own clock, or on the hour. `timeZone` defaults to the viewer's. */
export function clockRuler(at: number, timeZone?: string): SpanStripsRuler {
  const format = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', ...(timeZone ? { timeZone } : {}) });
  return {
    steps: [5, 10, 15, 30, 60].map((m) => m * MIN),
    origin: -zoneOffsetAt(at, timeZone),
    format: (ms) => format.format(ms),
  };
}
