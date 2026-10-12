import { describe, expect, it } from 'vitest';
import { presentRange, presentVector, rangeParts, vectorParts } from './composite';
import { textOf } from './kind';
import { decimal } from './kinds/plain';
import { fraction, percent } from './kinds/proportion';
import { unit } from './kinds/measure';
import { tag } from './quantity';

describe('presentRange', () => {
  it('joins two values with an en dash, each under its own display', () => {
    const range = presentRange(tag(1 / 64, fraction()), tag(1 / 2, fraction()));
    expect(range.text).toBe('1/64–1/2');
    expect(range.spoken).toBe('1 over 64 to 1 over 2');
  });

  it('uses the fallback display for bare numbers', () => {
    expect(presentRange(0.25, 0.5, percent()).text).toBe('25–50%');
    expect(presentRange(1, 2.5, decimal()).text).toBe('1–2.5');
  });

  it('writes a unit both ends share once, after the second', () => {
    const shared = presentRange(tag(2, unit('ft')), tag(5, unit('ft')));
    const mixed = presentRange(tag(6, unit('in')), tag(2, unit('ft')));
    expect(shared.text).toBe(textOf(rangeParts(tag(2, unit('ft')), tag(5, unit('ft')))));
    expect(shared.text.match(/ft/g)).toHaveLength(1);
    expect(shared.text).toBe('2–5ft');
    expect(mixed.text.match(/in|ft/g)).toEqual(['in', 'ft']);
  });

  it('spaces the dash from a negative end, so it does not read as a double sign', () => {
    expect(presentRange(-5, -2, decimal()).text).toBe('−5 – −2');
  });

  it('marks the range and its separator for styling, with a value on each end', () => {
    const { html } = presentRange(1, 2, decimal());
    expect(html).toBe(
      '<span data-composite="range"><data value="1"><span data-part="number">1</span></data>' +
        '<span data-part="separator">–</span>' +
        '<data value="2"><span data-part="number">2</span></data></span>',
    );
  });

  it('takes another separator and its spoken form', () => {
    const range = presentRange(1, 2, decimal(), { separator: ' → ', spokenSeparator: ' then ' });
    expect(range.text).toBe('1 → 2');
    expect(range.spoken).toBe('1 then 2');
  });
});

describe('presentVector', () => {
  it('lists its members, each under its own display', () => {
    expect(presentVector([3, tag(0.5, percent())], decimal()).text).toBe('3, 50%');
  });

  it('labels members, and speaks the labels', () => {
    const v = presentVector([3, -4], decimal(), { labels: ['x', 'y'] });
    expect(v.text).toBe('x 3, y −4');
    expect(v.spoken).toBe('x 3, y minus 4');
    expect(vectorParts([3, -4], decimal(), { labels: ['x', 'y'] }).map((p) => p.type)).toEqual([
      'label', 'literal', 'number', 'separator', 'label', 'literal', 'number',
    ]);
  });

  it('marks the vector and each member for styling', () => {
    expect(presentVector([1, 2], decimal(), { separator: ' × ' }).html).toBe(
      '<span data-composite="vector"><data value="1"><span data-part="number">1</span></data>' +
        '<span data-part="separator"> × </span>' +
        '<data value="2"><span data-part="number">2</span></data></span>',
    );
  });
});
