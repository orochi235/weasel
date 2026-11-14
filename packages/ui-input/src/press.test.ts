import { describe, expect, it } from 'vitest';
import { IDLE_PRESS, isPressKey, pressStep } from './press';

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

  it('holds nothing for a move with no press down, and presses nothing on its release', () => {
    const moved = pressStep(IDLE_PRESS, { type: 'move', inside: true });
    expect(moved.state.held).toBe(false);
    expect(pressStep(moved.state, { type: 'up', inside: true }).pressed).toBe(false);
  });

  it('takes the hold back when a press dragged off comes back on', () => {
    let s = pressStep(IDLE_PRESS, { type: 'down' }).state;
    s = pressStep(s, { type: 'move', inside: false }).state;
    s = pressStep(s, { type: 'move', inside: true }).state;
    expect(s.held).toBe(true);
    expect(pressStep(s, { type: 'up', inside: true }).pressed).toBe(true);
  });

  it('tracks hover apart from the hold', () => {
    const s = pressStep(IDLE_PRESS, { type: 'enter' }).state;
    expect(s).toEqual({ hovered: true, held: false, down: false });
    expect(pressStep(s, { type: 'leave' }).state).toEqual(IDLE_PRESS);
  });
});

describe('isPressKey', () => {
  it('is Enter and Space, as a native button takes them', () => {
    expect(isPressKey('Enter')).toBe(true);
    expect(isPressKey(' ')).toBe(true);
    expect(isPressKey('Spacebar')).toBe(false);
    expect(isPressKey('a')).toBe(false);
  });
});
