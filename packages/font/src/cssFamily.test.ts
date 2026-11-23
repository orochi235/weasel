import { describe, expect, it } from 'vitest';
import { cssFamilyName, isGenericFamily } from './cssFamily';

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

  it('quotes a name holding a quote that does not open it', () => {
    expect(cssFamilyName("Hoefler's Text")).toBe('"Hoefler\'s Text"');
    expect(cssFamilyName('a "quoted" face')).toBe('"a \\"quoted\\" face"');
  });

  it('passes a family list or an already-quoted name through', () => {
    expect(cssFamilyName('system-ui, sans-serif')).toBe('system-ui, sans-serif');
    expect(cssFamilyName('"Comic Sans MS"')).toBe('"Comic Sans MS"');
  });
});

describe('isGenericFamily', () => {
  it('answers for a generic keyword in any case and spacing, and no named family', () => {
    expect(['sans-serif', ' System-UI ', 'ui-sans-serif'].map(isGenericFamily)).toEqual([true, true, true]);
    expect(['Inter', 'sans serif', '"sans-serif"'].map(isGenericFamily)).toEqual([false, false, false]);
  });
});
