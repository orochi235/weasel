import { describe, expect, it } from 'vitest';
import { rulerTicks } from '@weasel-js/ui/components/SpanStrip';
import { clockRuler, zoneOffsetAt } from './clock';

const MIN = 60_000;
const AT = Date.parse('2026-11-20T03:23:24Z');

describe('clockRuler', () => {
  it("reads a zone's offset from its own wall clock", () => {
    expect(zoneOffsetAt(AT, 'America/New_York')).toBe(-5 * 60 * MIN);
    expect(zoneOffsetAt(AT, 'Asia/Kolkata')).toBe(5.5 * 60 * MIN);
    expect(zoneOffsetAt(AT, 'UTC')).toBe(0);
  });

  it("labels ticks in the zone's local time, on its round minutes", () => {
    const ruler = clockRuler(AT, 'America/New_York');
    expect(String(ruler.format(AT))).toMatch(/^10:23/);
    const ticks = rulerTicks({ from: AT, to: AT + 60 * MIN }, 600, ruler);
    expect(ticks.map((t) => String(t.label).replace(/\s?[AP]M$/, ''))).toEqual(['10:30', '10:40', '10:50', '11:00', '11:10', '11:20']);
    const india = rulerTicks({ from: AT, to: AT + 60 * MIN }, 300, clockRuler(AT, 'Asia/Kolkata'));
    expect(india.map((t) => String(t.label).replace(/\s?[AP]M$/, ''))).toEqual(['9:00', '9:15', '9:30', '9:45']);
  });
});
