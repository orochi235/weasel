import { afterEach, describe, expect, it } from 'vitest';
import { hasFontOutlines, registerFontOutlines, _resetFontOutlinesForTests } from './outlineRegistry';
import { isCanvasFont, registerCanvasFont, _resetDynamicFontsForTests } from '../dynamic/dynamicAtlas';

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

  it('takes a canvas family out, and a repeated registration does nothing', () => {
    const drop = registerCanvasFont('Georgia');
    const again = registerCanvasFont('Georgia');
    again();
    expect(isCanvasFont('Georgia')).toBe(true);
    drop();
    expect(isCanvasFont('Georgia')).toBe(false);
  });
});
