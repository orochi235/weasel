import { describe, it, expect } from 'vitest';
import { withOverride } from './override';

describe('withOverride', () => {
  it('leaves an overlay that is off, off, under an override that shows nothing', () => {
    expect(withOverride(false, {})).toBe(false);
    expect(withOverride(false, { bounds: false, highlight: [] })).toBe(false);
  });

  it('turns an overlay that is off on for an override that shows something', () => {
    expect(withOverride(false, { bounds: true })).toEqual({ bounds: true });
    expect(withOverride(false, { highlight: ['a'] })).toEqual({ highlight: ['a'] });
  });

  it('lays an override that turns a feature off over an overlay that is on', () => {
    expect(withOverride({ bounds: true, fps: true }, { bounds: false })).toEqual({ bounds: false, fps: true });
  });
});
