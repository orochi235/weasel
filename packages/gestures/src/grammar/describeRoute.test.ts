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
