/**
 * The CSS `applyOverlayDirection` writes, against a real layout engine: an
 * overlay told `auto` has to read each paragraph the way `layoutRuns` does
 * under a registered bidi engine, by its own first strong character, and one
 * told a direction has to read every paragraph that way.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { resolveTextStyle, type TextStyle } from '@weasel-js/text';
import { applyOverlayDirection } from './overlayDirection';

const HEBREW = 'שלום';
const WIDTH = 400;
let el: HTMLDivElement | null = null;

afterEach(() => { el?.remove(); el = null; });

function overlay(text: string, style: TextStyle): HTMLDivElement {
  el = document.createElement('div');
  el.style.cssText = `position:absolute;left:50px;top:50px;width:${WIDTH}px;font:20px sans-serif;white-space:pre-wrap;margin:0;padding:0`;
  el.textContent = text;
  applyOverlayDirection(el, resolveTextStyle(style));
  document.body.appendChild(el);
  return el;
}

/** Ink box of characters `[from, to)`, relative to the overlay's left edge. */
function ink(box: HTMLDivElement, from: number, to: number): { left: number; right: number } {
  const range = document.createRange();
  range.setStart(box.firstChild!, from);
  range.setEnd(box.firstChild!, to);
  const r = range.getBoundingClientRect();
  const origin = box.getBoundingClientRect().left;
  return { left: r.left - origin, right: r.right - origin };
}

describe('the overlay\'s direction, in a browser', () => {
  const TWO = `${HEBREW}\nhello`;
  const hebrew = (box: HTMLDivElement) => ink(box, 0, HEBREW.length);
  const latin = (box: HTMLDivElement) => ink(box, HEBREW.length + 1, TWO.length);

  it('sets each paragraph from its own start edge when no direction is stated', () => {
    const box = overlay(TWO, { align: 'start' });
    expect(hebrew(box).right).toBeCloseTo(WIDTH, 0);
    expect(latin(box).left).toBeCloseTo(0, 0);
  });

  it('sets each paragraph from its own end edge under `end`', () => {
    const box = overlay(TWO, { align: 'end' });
    expect(hebrew(box).left).toBeCloseTo(0, 0);
    expect(latin(box).right).toBeCloseTo(WIDTH, 0);
  });

  it('keeps an absolute edge whatever the text reads', () => {
    const box = overlay(TWO, { align: 'left' });
    expect(hebrew(box).left).toBeCloseTo(0, 0);
    expect(latin(box).left).toBeCloseTo(0, 0);
  });

  it('places a closing neutral by the paragraph\'s own direction', () => {
    const auto = overlay(`${HEBREW}!`, { align: 'left' });
    expect(ink(auto, HEBREW.length, HEBREW.length + 1).right)
      .toBeLessThanOrEqual(ink(auto, 0, HEBREW.length).left + 0.5);
    auto.remove();
    const ltr = overlay(`${HEBREW}!`, { align: 'left', direction: 'ltr' });
    expect(ink(ltr, HEBREW.length, HEBREW.length + 1).left)
      .toBeGreaterThanOrEqual(ink(ltr, 0, HEBREW.length).right - 0.5);
  });

  it('reads every paragraph the stated way', () => {
    const rtl = overlay(TWO, { align: 'start', direction: 'rtl' });
    expect(hebrew(rtl).right).toBeCloseTo(WIDTH, 0);
    expect(latin(rtl).right).toBeCloseTo(WIDTH, 0);
    rtl.remove();
    const ltr = overlay(TWO, { align: 'start', direction: 'ltr' });
    expect(hebrew(ltr).left).toBeCloseTo(0, 0);
    expect(latin(ltr).left).toBeCloseTo(0, 0);
  });

  it('justifies with each last line at its paragraph\'s start edge', () => {
    const box = overlay(TWO, { align: 'justify' });
    expect(hebrew(box).right).toBeCloseTo(WIDTH, 0);
    expect(latin(box).left).toBeCloseTo(0, 0);
  });
});
