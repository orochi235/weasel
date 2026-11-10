import { describe, expect, it } from 'vitest';
import { readCssNumber } from './cssNumber';

describe('readCssNumber', () => {
  it('reads a number with a sign or an exponent, as CSS does', () => {
    expect(readCssNumber('+4px')).toEqual({ value: 4, unit: 'px' });
    expect(readCssNumber('1e1px')).toEqual({ value: 10, unit: 'px' });
    expect(readCssNumber('-2.5E-1')).toEqual({ value: -0.25, unit: '' });
    expect(readCssNumber('.5e+2%')).toEqual({ value: 50, unit: '%' });
  });

  it('reads an e that starts a unit as the unit', () => {
    expect(readCssNumber('2em')).toEqual({ value: 2, unit: 'em' });
    expect(readCssNumber('3ex')).toEqual({ value: 3, unit: 'ex' });
  });

  it('refuses text that is not one number', () => {
    expect(readCssNumber('calc(1px + 2px)')).toBeUndefined();
    expect(readCssNumber('+-1px')).toBeUndefined();
    expect(readCssNumber('1px 2px')).toBeUndefined();
  });
});
