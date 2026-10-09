import { describe, expect, it } from 'vitest';
import { cssFamilyName } from './cssFamily';

describe('cssFamilyName', () => {
  it('leaves generic keywords bare, in any case', () => {
    expect(cssFamilyName('sans-serif')).toBe('sans-serif');
    expect(cssFamilyName('ui-monospace')).toBe('ui-monospace');
    expect(cssFamilyName('Serif')).toBe('Serif');
  });

  it('quotes a named family', () => {
    expect(cssFamilyName('Inter')).toBe('"Inter"');
    expect(cssFamilyName('Font 3D')).toBe('"Font 3D"');
  });

  it('passes a family list or an already-quoted name through', () => {
    expect(cssFamilyName('system-ui, sans-serif')).toBe('system-ui, sans-serif');
    expect(cssFamilyName('"Comic Sans MS"')).toBe('"Comic Sans MS"');
  });
});
