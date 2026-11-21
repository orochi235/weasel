import { describe, expect, it } from 'vitest';
import { parseViewBoxAttr } from './viewBox';
import { turnsOf } from './glyphTurns';
import { mediaEnvironmentFor } from './media';

describe('parseViewBoxAttr', () => {
  it('reads numbers that abut, as a minifier writes them', () => {
    expect(parseViewBoxAttr('0-10 100 100')).toEqual({ x: 0, y: -10, width: 100, height: 100 });
    expect(parseViewBoxAttr('.5.5 10,10')).toEqual({ x: 0.5, y: 0.5, width: 10, height: 10 });
  });

  it('rejects a number with trailing junk', () => {
    expect(parseViewBoxAttr('10px 0 5 5')).toBeUndefined();
  });

  it('sizes the media environment from an abutting viewBox', () => {
    const ok = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0-0 40 20" width="80"/>', 'image/svg+xml').documentElement;
    expect(mediaEnvironmentFor(ok)).toMatchObject({ width: 80, height: 40 });
  });

  it('reads an abutting rotate list', () => {
    const el = new DOMParser().parseFromString('<text xmlns="http://www.w3.org/2000/svg" rotate="10-20">ab</text>', 'image/svg+xml').documentElement;
    expect(turnsOf(el, () => {})).toEqual([10, -20]);
  });
});
