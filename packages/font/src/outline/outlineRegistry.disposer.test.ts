import { afterEach, describe, expect, it } from 'vitest';
import { hasFontOutlines, registerFontOutlines, _resetFontOutlinesForTests } from './outlineRegistry';
import { isCanvasFont, registerCanvasFont, unregisterCanvasFont, _resetDynamicFontsForTests } from '../dynamic/dynamicAtlas';

afterEach(() => { _resetFontOutlinesForTests(); _resetDynamicFontsForTests(); });

describe('registration disposers', () => {
  it('drops the outline registration it returned from', () => {
    const drop = registerFontOutlines('Face', { weight: 700 }, new ArrayBuffer(0));
    expect(hasFontOutlines('Face', 700)).toBe(true);
    drop();
    expect(hasFontOutlines('Face', 700)).toBe(false);
  });

  it('leaves a registration that replaced its own', () => {
    const drop = registerFontOutlines('Face', {}, new ArrayBuffer(0));
    registerFontOutlines('Face', {}, new ArrayBuffer(0));
    drop();
    expect(hasFontOutlines('Face')).toBe(true);
  });

  it('takes a canvas family out when the last of its holders releases it', () => {
    const drop = registerCanvasFont('Georgia');
    const again = registerCanvasFont('Georgia');
    drop();
    drop();
    expect(isCanvasFont('Georgia')).toBe(true);
    again();
    expect(isCanvasFont('Georgia')).toBe(false);
  });

  it('leaves a later registration alone when a release from before an unregister runs', () => {
    const stale = registerCanvasFont('Georgia');
    unregisterCanvasFont('Georgia');
    registerCanvasFont('Georgia');
    stale();
    expect(isCanvasFont('Georgia')).toBe(true);
  });
});
