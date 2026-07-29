/**
 * Tests for `resolveTextStyle` + `fontString`. Default fill-in for
 * `TextStyle` is load-bearing: the renderer never sees `undefined`
 * fields, and the text overlay relies on `caretColor` / `selectionBackground`
 * being deterministic derivatives of `fill` when not specified.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveTextStyle,
  fontString,
  DEFAULT_TEXT_STYLE,
  type TextStyle,
} from './textStyle';

describe('resolveTextStyle', () => {
  it('returns DEFAULT_TEXT_STYLE for undefined input', () => {
    expect(resolveTextStyle()).toBe(DEFAULT_TEXT_STYLE);
  });

  it('empty style fills every field from defaults', () => {
    const r = resolveTextStyle({});
    expect(r.fontSize).toBe(DEFAULT_TEXT_STYLE.fontSize);
    expect(r.fontFamily).toBe(DEFAULT_TEXT_STYLE.fontFamily);
    expect(r.fontWeight).toBe(DEFAULT_TEXT_STYLE.fontWeight);
    expect(r.fontStyle).toBe(DEFAULT_TEXT_STYLE.fontStyle);
    expect(r.align).toBe(DEFAULT_TEXT_STYLE.align);
    expect(r.lineHeight).toBe(DEFAULT_TEXT_STYLE.lineHeight);
    expect(r.fill).toEqual(DEFAULT_TEXT_STYLE.fill);
  });

  it('caretColor defaults to the fill\'s color', () => {
    const r = resolveTextStyle({ fill: { fill: 'solid', color: '#ff0000' } });
    expect(r.caretColor).toBe('#ff0000');
  });

  it('caretColor falls back to #000 for non-solid fills', () => {
    // A pattern-paint shape (no `color` field) triggers the fallback.
    const patternPaint = { fill: 'pattern', pattern: 'whatever' } as unknown as TextStyle['fill'];
    const r = resolveTextStyle({ fill: patternPaint });
    expect(r.caretColor).toBe('#000');
  });

  it('explicit caretColor overrides the fill-derived default', () => {
    const r = resolveTextStyle({
      fill: { fill: 'solid', color: '#ff0000' },
      caretColor: '#00ff00',
    });
    expect(r.caretColor).toBe('#00ff00');
  });

  it('selectionBackground defaults to a 25% color-mix of caretColor', () => {
    const r = resolveTextStyle({ fill: { fill: 'solid', color: '#abcdef' } });
    expect(r.selectionBackground).toBe('color-mix(in srgb, #abcdef 25%, transparent)');
  });

  it('explicit selectionBackground passes through', () => {
    const r = resolveTextStyle({ selectionBackground: 'rgba(0,0,255,0.4)' });
    expect(r.selectionBackground).toBe('rgba(0,0,255,0.4)');
  });

  it('selectionBackground=\'none\' resolves to null (opt-out)', () => {
    const r = resolveTextStyle({ selectionBackground: 'none' });
    expect(r.selectionBackground).toBeNull();
  });

  it('selectionColor defaults to null (browser uses text color)', () => {
    expect(resolveTextStyle({}).selectionColor).toBeNull();
  });

  it('explicit selectionColor passes through', () => {
    expect(resolveTextStyle({ selectionColor: '#fff' }).selectionColor).toBe('#fff');
  });

  it('individual style fields override their defaults', () => {
    const r = resolveTextStyle({
      fontSize: 24,
      fontFamily: 'Inter',
      fontWeight: 700,
      fontStyle: 'italic',
      align: 'center',
      lineHeight: 1.5,
    });
    expect(r.fontSize).toBe(24);
    expect(r.fontFamily).toBe('Inter');
    expect(r.fontWeight).toBe(700);
    expect(r.fontStyle).toBe('italic');
    expect(r.align).toBe('center');
    expect(r.lineHeight).toBe(1.5);
  });
});

describe('fontString', () => {
  it('returns the canonical CSS font shorthand', () => {
    const s = resolveTextStyle({
      fontSize: 18, fontFamily: 'Helvetica', fontWeight: 600, fontStyle: 'italic',
    });
    expect(fontString(s)).toBe('italic 600 18px Helvetica');
  });

  it('uses defaults when none specified', () => {
    expect(fontString(DEFAULT_TEXT_STYLE)).toBe('normal 400 16px sans-serif');
  });
});

describe('new typography keys', () => {
  it('defaults letterSpacing to 0 and decoration to off', () => {
    const s = resolveTextStyle({});
    expect(s.letterSpacing).toBe(0);
    expect(s.underline).toBe(false);
    expect(s.strikethrough).toBe(false);
  });

  it('passes explicit values through', () => {
    const s = resolveTextStyle({ letterSpacing: 1.5, underline: true, strikethrough: true });
    expect(s.letterSpacing).toBe(1.5);
    expect(s.underline).toBe(true);
    expect(s.strikethrough).toBe(true);
  });
});
