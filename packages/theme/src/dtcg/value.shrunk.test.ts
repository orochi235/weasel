import { describe, expect, it } from 'vitest';
import { parseTokenValue, serializeTokenValue } from './value';

describe('font stacks, shrunk counterexamples', () => {
  it('unwraps only a family quoted at both ends, so parsing what it wrote changes nothing', () => {
    const once = parseTokenValue('fontFamily', '""!');
    expect(once).toEqual(['""!']);
    expect(parseTokenValue('fontFamily', serializeTokenValue('fontFamily', once))).toEqual(once);
    expect(parseTokenValue('fontFamily', `"Open Sans", 'Inter'`)).toEqual(['Open Sans', 'Inter']);
  });
});
