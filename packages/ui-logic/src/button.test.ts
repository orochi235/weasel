import { describe, expect, it } from 'vitest';
import { buttonParts, IDLE_PRESS, measureButton, pressStep } from './button';
import { exactly, UNBOUNDED, type MeasureEnv } from './measure';

/** A theme with round numbers and text 6px a character, ascent 10, descent 2. */
const TOKENS: Record<string, string> = {
  '--wzl-control-h': '28px', '--wzl-control-h-sm': '22px',
  '--wzl-space-3': '6px', '--wzl-space-4': '8px', '--wzl-space-6': '12px',
  '--wzl-font-size': '12px', '--wzl-font-size-sm': '11px', '--wzl-font-weight-medium': '500',
};
const env = (extra: Record<string, string> = {}): MeasureEnv => ({
  token: (n) => extra[n] ?? TOKENS[n],
  text: (t) => ({ width: t.length * 6, ascent: 10, descent: 2 }),
});

describe('buttonParts', () => {
  it('orders a spinner over the leading icon, then the label and trailing icon', () => {
    expect(buttonParts({ label: 'Go', leadingIcon: 'a', trailingIcon: 'b' })).toEqual(['leading', 'label', 'trailing']);
    expect(buttonParts({ label: 'Go', leadingIcon: 'a', loading: true })).toEqual(['spinner', 'label']);
    expect(buttonParts({ iconOnly: true, icon: 'a' })).toEqual(['icon']);
    expect(buttonParts({ iconOnly: true, icon: 'a', loading: true })).toEqual(['spinner']);
    expect(buttonParts({})).toEqual([]);
  });
});

describe('measureButton', () => {
  it('sizes a labeled button to its text plus padding, at the control height', () => {
    const m = measureButton({ label: 'Save' }, UNBOUNDED, env());
    expect([m.width, m.height]).toEqual([24 + 24, 28]);
    expect(m.layout.parts).toEqual([{ part: 'label', rect: { x: 12, y: 8, width: 24, height: 12 } }]);
    // Line box 12 tall at y 8; the 12px face sits in it with no half-leading: 8 + 0 + 10.
    expect(m.baseline).toBe(18);
  });

  it('adds icons and gaps, and reads the small size and the pad override', () => {
    const m = measureButton({ label: 'Go', size: 'sm', leadingIcon: 'x' }, UNBOUNDED, env({ '--wzl-button-pad-x': '4px' }));
    expect([m.width, m.height]).toEqual([12 + 6 + 12 + 8, 22]);
    expect(m.layout.parts.map((p) => p.rect.x)).toEqual([4, 22]);
  });

  it('is square when icon-only', () => {
    const m = measureButton({ iconOnly: true, icon: 'x' }, UNBOUNDED, env());
    expect([m.width, m.height]).toEqual([28, 28]);
    expect(m.layout.parts[0]!.rect).toEqual({ x: 7, y: 7, width: 14, height: 14 });
    expect(m.baseline).toBe(28);
  });

  it('centers its parts in a wider box and gives up label width in a narrower one', () => {
    const wide = measureButton({ label: 'Save' }, exactly(100, 28), env());
    expect(wide.layout.parts[0]!.rect.x).toBe(38);
    const narrow = measureButton({ label: 'Save' }, exactly(30, 28), env());
    expect(narrow.layout.parts[0]!.rect).toMatchObject({ x: 12, width: 6 });
  });
});

describe('pressStep', () => {
  it('presses on a release over the control it went down on', () => {
    let s = pressStep(IDLE_PRESS, { type: 'down' }).state;
    expect(s.held).toBe(true);
    const up = pressStep(s, { type: 'up', inside: true });
    expect(up).toEqual({ state: IDLE_PRESS, pressed: true });
    s = pressStep(pressStep(IDLE_PRESS, { type: 'down' }).state, { type: 'move', inside: false }).state;
    expect(s.held).toBe(false);
    expect(pressStep(s, { type: 'up', inside: false }).pressed).toBe(false);
  });

  it('tracks hover apart from the hold', () => {
    const s = pressStep(IDLE_PRESS, { type: 'enter' }).state;
    expect(s).toEqual({ hovered: true, held: false });
    expect(pressStep(s, { type: 'leave' }).state).toEqual(IDLE_PRESS);
  });
});
