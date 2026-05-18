import { describe, it, expect } from 'vitest';
import { parseRoute, formatRoute } from './routeGrammar';

describe('parseRoute (v2 grammar)', () => {
  it('parses a click with target and modifiers', () => {
    expect(parseRoute('initial.click.empty:shift')).toEqual({
      phase: 'initial', gesture: 'click', arg: undefined, target: 'empty', modifiers: 'shift',
    });
  });

  it('parses a wheel with direction arg, no target', () => {
    expect(parseRoute('initial.wheel(up)')).toEqual({
      phase: 'initial', gesture: 'wheel', arg: 'up', target: undefined, modifiers: 'default',
    });
  });

  it('parses a wheel without arg as the descriptor default', () => {
    expect(parseRoute('initial.wheel')).toEqual({
      phase: 'initial', gesture: 'wheel', arg: '*', target: undefined, modifiers: 'default',
    });
  });

  it('parses keyDown with a key arg', () => {
    expect(parseRoute('initial.keyDown(ArrowDown)')).toEqual({
      phase: 'initial', gesture: 'keyDown', arg: 'ArrowDown', target: undefined, modifiers: 'default',
    });
  });

  it('parses contextMenu like click (target slot present)', () => {
    expect(parseRoute('initial.contextMenu.empty')).toEqual({
      phase: 'initial', gesture: 'contextMenu', arg: undefined, target: 'empty', modifiers: 'default',
    });
  });

  it('parses multiTouchTap with fingers arg, no target', () => {
    expect(parseRoute('initial.multiTouchTap(2)')).toEqual({
      phase: 'initial', gesture: 'multiTouchTap', arg: '2', target: undefined, modifiers: 'default',
    });
  });

  it('rejects an arg on a no-arg gesture', () => {
    expect(() => parseRoute('initial.click(foo).empty')).toThrow(/click.*does not take an argument/);
  });

  it('rejects a target on a no-target gesture', () => {
    expect(() => parseRoute('initial.wheel(up).foo')).toThrow(/wheel.*does not have a target/);
  });

  it('rejects an unknown enumerated arg value', () => {
    expect(() => parseRoute('initial.wheel(sideways)')).toThrow(/sideways.*not in.*up.*down/);
  });

  it('rejects an unknown gesture name', () => {
    expect(() => parseRoute('initial.bogus.empty')).toThrow(/unknown gesture/i);
  });
});

describe('formatRoute', () => {
  it('round-trips click', () => {
    const r = { phase: 'initial' as const, gesture: 'click' as const, arg: undefined, target: 'empty', modifiers: 'shift' as const };
    expect(parseRoute(formatRoute(r))).toEqual(r);
  });

  it('elides default arg for wheel', () => {
    expect(formatRoute({ phase: 'initial', gesture: 'wheel', arg: '*', target: undefined, modifiers: 'default' }))
      .toBe('initial.wheel');
  });

  it('keeps explicit arg for wheel(up)', () => {
    expect(formatRoute({ phase: 'initial', gesture: 'wheel', arg: 'up', target: undefined, modifiers: 'default' }))
      .toBe('initial.wheel(up)');
  });

  it('round-trips keyDown(ArrowDown)', () => {
    const r = { phase: 'initial' as const, gesture: 'keyDown' as const, arg: 'ArrowDown', target: undefined, modifiers: 'default' as const };
    expect(parseRoute(formatRoute(r))).toEqual(r);
  });
});
