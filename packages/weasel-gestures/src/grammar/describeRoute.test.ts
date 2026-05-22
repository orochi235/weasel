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
