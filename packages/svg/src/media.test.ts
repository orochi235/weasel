import { describe, it, expect } from 'vitest';
import { evaluateMediaQuery, mediaEnvironmentFor, DEFAULT_MEDIA_ENVIRONMENT, type SvgMediaEnvironment } from './media';

const env: SvgMediaEnvironment = { ...DEFAULT_MEDIA_ENVIRONMENT, width: 800, height: 600 };
const q = (query: string, over: Partial<SvgMediaEnvironment> = {}): boolean =>
  evaluateMediaQuery(query, { ...env, ...over });

function root(svg: string): Element {
  return new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
}

describe('evaluateMediaQuery: media types', () => {
  it('matches an empty list, all, and the environment type', () => {
    expect(q('')).toBe(true);
    expect(q('all')).toBe(true);
    expect(q('screen')).toBe(true);
    expect(q('SCREEN')).toBe(true);
    expect(q('print')).toBe(false);
    expect(q('print', { type: 'print' })).toBe(true);
  });
  it('matches no deprecated or unknown type', () => {
    expect(q('tv')).toBe(false);
    expect(q('handheld')).toBe(false);
    expect(q('nonsense')).toBe(false);
  });
  it('honors only and not', () => {
    expect(q('only screen')).toBe(true);
    expect(q('not print')).toBe(true);
    expect(q('not screen')).toBe(false);
    expect(q('not all')).toBe(false);
  });
  it('is true when any query in a comma list matches', () => {
    expect(q('print, screen')).toBe(true);
    expect(q('print, tv')).toBe(false);
    expect(q('print, (min-width: 100px)')).toBe(true);
  });
  it('treats a malformed query as not all without spoiling its neighbors', () => {
    expect(q('screen and')).toBe(false);
    expect(q('screen and, all')).toBe(true);
    expect(q('only (width)')).toBe(false);
    expect(q('screen or (width)')).toBe(false);
    expect(q('and')).toBe(false);
    expect(q('print, , screen')).toBe(true);
    expect(q(',')).toBe(false);
  });
});

describe('evaluateMediaQuery: conditions', () => {
  it('combines a type with and-ed features', () => {
    expect(q('screen and (min-width: 500px)')).toBe(true);
    expect(q('screen and (min-width: 900px)')).toBe(false);
    expect(q('screen and (min-width: 500px) and (max-height: 700px)')).toBe(true);
    expect(q('not screen and (min-width: 900px)')).toBe(true);
    expect(q('print and (min-width: 500px)')).toBe(false);
  });
  it('rejects or directly after a media type', () => {
    expect(q('screen and (width) or (height)')).toBe(false);
    expect(q('screen and ((width) or (height))')).toBe(true);
  });
  it('evaluates and / or / not conditions with nesting', () => {
    expect(q('(min-width: 900px) or (orientation: landscape)')).toBe(true);
    expect(q('(min-width: 900px) and (orientation: landscape)')).toBe(false);
    expect(q('not (min-width: 900px)')).toBe(true);
    expect(q('not ((min-width: 900px) or (max-width: 100px))')).toBe(true);
    expect(q('(not (hover)) and (width > 0)')).toBe(true);
  });
  it('rejects mixing and with or at one level', () => {
    expect(q('(width) and (height) or (color)')).toBe(false);
  });
  it('evaluates unknown features false, including under not', () => {
    expect(q('(frobnicate)')).toBe(false);
    expect(q('(frobnicate: 1)')).toBe(false);
    expect(q('not (frobnicate)')).toBe(false);
    expect(q('(frobnicate) or (width)')).toBe(true);
    expect(q('(width) and (frobnicate)')).toBe(false);
    expect(q('screen and (frobnicate)')).toBe(false);
    expect(q('foo(bar)')).toBe(false);
  });
  it('evaluates an invalid value for a known feature false', () => {
    expect(q('(orientation: sideways)')).toBe(false);
    expect(q('(min-width: red)')).toBe(false);
    expect(q('(min-orientation: portrait)')).toBe(false);
  });
});

describe('evaluateMediaQuery: range features', () => {
  it('compares width and height with min-/max- prefixes', () => {
    expect(q('(width: 800px)')).toBe(true);
    expect(q('(min-width: 800px)')).toBe(true);
    expect(q('(max-width: 799px)')).toBe(false);
    expect(q('(min-height: 600px)')).toBe(true);
    expect(q('(max-height: 599.5px)')).toBe(false);
  });
  it('converts length units', () => {
    expect(q('(min-width: 50em)')).toBe(true);
    expect(q('(min-width: 51em)')).toBe(false);
    expect(q('(width: 50rem)')).toBe(true);
    expect(q('(width: 8.333333in)')).toBe(false);
    expect(q('(min-width: 8in)')).toBe(true);
    expect(q('(width: 600pt)')).toBe(true);
    expect(q('(min-width: 21cm)')).toBe(true);
    expect(q('(min-width: 0)')).toBe(true);
    expect(q('(min-width: 500)')).toBe(false);
  });
  it('evaluates level-4 range syntax', () => {
    expect(q('(width > 799px)')).toBe(true);
    expect(q('(width > 800px)')).toBe(false);
    expect(q('(width >= 800px)')).toBe(true);
    expect(q('(width < 801px)')).toBe(true);
    expect(q('(width <= 799px)')).toBe(false);
    expect(q('(width = 800px)')).toBe(true);
    expect(q('(900px > width)')).toBe(true);
    expect(q('(800px <= width)')).toBe(true);
    expect(q('(400px < width < 1000px)')).toBe(true);
    expect(q('(400px < width <= 800px)')).toBe(true);
    expect(q('(400px < width < 800px)')).toBe(false);
    expect(q('(1000px > width > 400px)')).toBe(true);
    expect(q('(400px < width > 1000px)')).toBe(false);
    expect(q('(400px = width = 800px)')).toBe(false);
  });
  it('compares aspect-ratio as a ratio or a number', () => {
    expect(q('(aspect-ratio: 4/3)')).toBe(true);
    expect(q('(aspect-ratio: 4 / 3)')).toBe(true);
    expect(q('(min-aspect-ratio: 16/9)')).toBe(false);
    expect(q('(max-aspect-ratio: 16/9)')).toBe(true);
    expect(q('(aspect-ratio > 1)')).toBe(true);
    expect(q('(1/1 < aspect-ratio < 2/1)')).toBe(true);
  });
  it('reads orientation from the viewport', () => {
    expect(q('(orientation: landscape)')).toBe(true);
    expect(q('(orientation: portrait)')).toBe(false);
    expect(q('(orientation: portrait)', { width: 100, height: 100 })).toBe(true);
  });
  it('treats device-width and device-height as the viewport', () => {
    expect(q('(min-device-width: 800px)')).toBe(true);
    expect(q('(device-aspect-ratio: 4/3)')).toBe(true);
  });
  it('compares resolution, color and monochrome', () => {
    expect(q('(resolution: 1dppx)')).toBe(true);
    expect(q('(resolution: 96dpi)')).toBe(true);
    expect(q('(min-resolution: 2x)')).toBe(false);
    expect(q('(min-resolution: 2x)', { resolution: 2 })).toBe(true);
    expect(q('(color)')).toBe(true);
    expect(q('(min-color: 8)')).toBe(true);
    expect(q('(monochrome)')).toBe(false);
    expect(q('(monochrome: 0)')).toBe(true);
  });
  it('is true in a boolean context for a nonzero value', () => {
    expect(q('(width)')).toBe(true);
    expect(q('(width)', { width: 0 })).toBe(false);
    expect(q('(aspect-ratio)')).toBe(true);
  });
});

describe('evaluateMediaQuery: discrete features', () => {
  it('reads prefers-color-scheme', () => {
    expect(q('(prefers-color-scheme: light)')).toBe(true);
    expect(q('(prefers-color-scheme: dark)')).toBe(false);
    expect(q('(prefers-color-scheme: dark)', { prefersColorScheme: 'dark' })).toBe(true);
    expect(q('(prefers-color-scheme)')).toBe(true);
  });
  it('has no hover and no pointer by default', () => {
    expect(q('(hover)')).toBe(false);
    expect(q('(hover: none)')).toBe(true);
    expect(q('(any-hover: hover)')).toBe(false);
    expect(q('(hover: hover)', { hover: 'hover' })).toBe(true);
    expect(q('(pointer: none)')).toBe(true);
    expect(q('(any-pointer: fine)', { pointer: 'fine' })).toBe(true);
    expect(q('(pointer)')).toBe(false);
  });
  it('reads prefers-reduced-motion and update', () => {
    expect(q('(prefers-reduced-motion: no-preference)')).toBe(true);
    expect(q('(prefers-reduced-motion)')).toBe(false);
    expect(q('(update: none)')).toBe(true);
    expect(q('(update)')).toBe(false);
  });
  it('rejects a range comparison on a discrete feature', () => {
    expect(q('(hover > none)')).toBe(false);
  });
});

describe('mediaEnvironmentFor', () => {
  it('defaults to a light, hoverless screen', () => {
    const e = mediaEnvironmentFor(root('<svg width="10" height="20"/>'));
    expect(e).toMatchObject({ type: 'screen', prefersColorScheme: 'light', hover: 'none', width: 10, height: 20 });
  });
  it('takes the viewport from width and height, converting absolute units', () => {
    expect(mediaEnvironmentFor(root('<svg width="1in" height="72pt" viewBox="0 0 5 5"/>')))
      .toMatchObject({ width: 96, height: 96 });
  });
  it('falls back to the viewBox, keeping its aspect ratio for a missing side', () => {
    expect(mediaEnvironmentFor(root('<svg viewBox="0 0 400 200"/>'))).toMatchObject({ width: 400, height: 200 });
    expect(mediaEnvironmentFor(root('<svg width="100" viewBox="0 0 400 200"/>'))).toMatchObject({ width: 100, height: 50 });
    expect(mediaEnvironmentFor(root('<svg width="50%" viewBox="0 0 400 200"/>'))).toMatchObject({ width: 400, height: 200 });
  });
  it('falls back to the replaced-element default of 300 by 150', () => {
    expect(mediaEnvironmentFor(root('<svg/>'))).toMatchObject({ width: 300, height: 150 });
  });
  it('lets overrides win over everything derived', () => {
    expect(mediaEnvironmentFor(root('<svg width="10" height="20"/>'), { width: 1200, prefersColorScheme: 'dark' }))
      .toMatchObject({ width: 1200, height: 20, prefersColorScheme: 'dark' });
  });
});
