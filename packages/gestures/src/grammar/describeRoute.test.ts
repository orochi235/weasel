import { describe, it, expect } from 'vitest';
import { parseRoute } from './routeGrammar';
import { describeRoute } from './describeRoute';

describe('describeRoute — keyHeld', () => {
  it('phrases keyHeld as "holds {key}"', () => {
    expect(describeRoute(parseRoute('[initial] keyHeld(Space)'))).toBe(
      'Fires when the user holds Space, while the tool is idle.',
    );
  });

  it('combines modifiers into the keyHeld phrase', () => {
    expect(describeRoute(parseRoute('[initial] keyHeld(Space) +mod'))).toBe(
      'Fires when the user holds Mod and holds Space, while the tool is idle.',
    );
  });
});

describe('describeRoute wildcard args', () => {
  it('says "any" rather than printing the wildcard sentinel', () => {
    expect(describeRoute(parseRoute('[*:*] drop'))).toContain('drops any content');
    expect(describeRoute(parseRoute('[*:*] paste'))).toContain('pastes any content');
    expect(describeRoute(parseRoute('[initial] multiTouchTap'))).toContain('taps with multiple fingers');
    expect(describeRoute(parseRoute('[initial] keyDown'))).toContain('presses any key');
  });
  it('still names a concrete arg', () => {
    expect(describeRoute(parseRoute('[initial] keyDown(Delete)'))).toContain('presses Delete');
    expect(describeRoute(parseRoute('[initial] multiTouchTap(3)'))).toContain('taps with 3 fingers');
  });
  it('never emits the wildcard sentinel in prose', () => {
    for (const r of ['[*:*] drop', '[*:*] paste', '[initial] multiTouchTap', '[initial] keyDown', '[engaged] wheel']) {
      expect(describeRoute(parseRoute(r))).not.toContain('*');
    }
  });
});

describe('describeRoute — pinch', () => {
  it('phrases pinch by direction', () => {
    expect(describeRoute(parseRoute('[initial] pinch'))).toContain('the user pinches');
    expect(describeRoute(parseRoute('[initial] pinch(out)'))).toContain('the user pinches out');
    expect(describeRoute(parseRoute('[initial] pinch(in)'))).toContain('the user pinches in');
  });
});

describe('describeRoute — modifiers', () => {
  const action = (route: string) =>
    describeRoute(parseRoute(route), { capitalize: false, period: false })
      .replace(/^fires when /, '')
      .replace(/, while .*$/, '');

  it('reads a pointer gesture with no, one, two and three modifiers', () => {
    expect(action('[initial] drag')).toBe('the user drags anywhere');
    expect(action('[initial] drag +alt')).toBe('the user Alt-drags anywhere');
    expect(action('[initial] drag +mod +alt')).toBe('the user holds Mod and Alt and drags anywhere');
    expect(action('[initial] drag +mod +shift +alt')).toBe(
      'the user holds Mod, Shift, and Alt and drags anywhere',
    );
  });

  it('reads the same way for every targeted gesture', () => {
    expect(action('[initial] click => empty +shift')).toBe('the user Shift-clicks on empty canvas');
    expect(action('[initial] click => empty +mod +shift')).toBe(
      'the user holds Mod and Shift and clicks on empty canvas',
    );
    expect(action('[initial] dblTap +mod +alt')).toBe('the user holds Mod and Alt and double-taps anywhere');
    expect(action('[initial] pointerDown +shift +alt')).toBe('the user holds Shift and Alt and presses anywhere');
    expect(action('[initial] contextMenu +ctrl +meta')).toBe(
      'the user holds Ctrl and Meta and opens the context menu anywhere',
    );
    expect(action('[initial] longPress')).toBe('the user long-presses anywhere');
    expect(action('[initial] longPress +shift +alt')).toBe('the user holds Shift and Alt and long-presses anywhere');
    expect(action('[initial] wheel(up) +mod +shift')).toBe('the user holds Mod and Shift and scrolls up anywhere');
    expect(action('[initial] pinch(in) +alt')).toBe('the user Alt-pinches in anywhere');
  });

  it('reads keys with a "holds … and" lead at any count', () => {
    expect(action('[initial] keyDown(z)')).toBe('the user presses z');
    expect(action('[initial] keyDown(z) +mod')).toBe('the user holds Mod and presses z');
    expect(action('[initial] keyDown(z) +mod +shift')).toBe('the user holds Mod and Shift and presses z');
    expect(action('[initial] keyUp(z) +mod +shift +alt')).toBe('the user holds Mod, Shift, and Alt and releases z');
  });

  it('names modifiers on targetless gestures instead of dropping them', () => {
    expect(action('[initial] multiTouchTap(3) +shift')).toBe('the user Shift-taps with 3 fingers');
    expect(action('[*:*] drop +alt')).toBe('the user Alt-drops any content onto the canvas');
    expect(action('[*:*] paste +shift +alt')).toBe('the user holds Shift and Alt and pastes any content');
  });

  it('keeps optional modifiers in their own clause', () => {
    expect(describeRoute(parseRoute('[initial] drag +mod ?shift'))).toBe(
      'Fires when the user Mod-drags anywhere, while the tool is idle (Shift optional).',
    );
  });
});
