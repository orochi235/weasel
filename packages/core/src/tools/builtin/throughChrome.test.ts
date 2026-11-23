import { describe, expect, it } from 'vitest';
import { THROUGH_CHROME } from './throughChrome';

describe('THROUGH_CHROME', () => {
  const reaches = (hit: unknown) => THROUGH_CHROME.kindOf(hit, undefined);

  it('reaches through the document’s chrome, and over nothing at all', () => {
    expect(reaches({ kind: 'handle:top-left', strength: 'shared' })).toBe(true);
    expect(reaches({ kind: 'layer:diagram-ports', strength: 'exclusive' })).toBe(true);
    expect(reaches(null)).toBe(true);
  });

  it('does not reach through UI floating over the canvas, which takes the press under any tool', () => {
    expect(reaches({ kind: 'layer:weasel-hud', strength: 'exclusive', floats: true })).toBe(false);
  });
});
