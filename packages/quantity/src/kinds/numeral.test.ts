import { describe, expect, it } from 'vitest';
import { parseAs } from '../present';
import { integer } from './plain';
import { ordinal, roman } from './numeral';

describe('whole-number kinds read a typed fraction alike', () => {
  it('rounds a typed decimal in a roman field, as integer and ordinal do', () => {
    expect(parseAs('2.5', roman())).toBe(parseAs('2.5', integer()));
    expect(parseAs('2.4', roman())).toBe(2);
    expect(parseAs('2.5', ordinal())).toBe(3);
    expect(parseAs('XIV', roman())).toBe(14);
  });
});
