import { describe, it, expect } from 'vitest';
import { parseKeyRoute, formatKeyRoute, keyRouteToSpec } from './keyRouteGrammar';

describe('parseKeyRoute', () => {
  it('parses a bare key', () => {
    expect(parseKeyRoute('ArrowDown')).toEqual({ key: 'ArrowDown', optionalMods: [] });
  });

  it('parses one optional modifier', () => {
    expect(parseKeyRoute('ArrowDown?shift')).toEqual({ key: 'ArrowDown', optionalMods: ['shift'] });
  });

  it('parses multiple optional modifiers in input order', () => {
    expect(parseKeyRoute('ArrowDown?shift?alt')).toEqual({ key: 'ArrowDown', optionalMods: ['shift', 'alt'] });
  });

  it('rejects an unknown optional modifier', () => {
    expect(() => parseKeyRoute('ArrowDown?cape')).toThrow(/unknown optional modifier/i);
  });

  it('rejects duplicate optional modifiers', () => {
    expect(() => parseKeyRoute('ArrowDown?shift?shift')).toThrow(/duplicate optional modifier/i);
  });

  it('rejects empty key', () => {
    expect(() => parseKeyRoute('')).toThrow(/empty/i);
  });
});

describe('formatKeyRoute', () => {
  it('round-trips bare key', () => {
    const r = { key: 'Enter', optionalMods: [] };
    expect(parseKeyRoute(formatKeyRoute(r))).toEqual(r);
  });

  it('round-trips with optional mods', () => {
    const r = { key: 'ArrowDown', optionalMods: ['shift' as const, 'alt' as const] };
    expect(parseKeyRoute(formatKeyRoute(r))).toEqual(r);
  });
});

describe('keyRouteToSpec', () => {
  it('converts ?shift to mods.shift = "optional"', () => {
    expect(keyRouteToSpec({ key: 'ArrowDown', optionalMods: ['shift'] }))
      .toEqual({ kind: 'key', key: 'ArrowDown', mods: { shift: 'optional' } });
  });

  it('returns no mods for bare key', () => {
    expect(keyRouteToSpec({ key: 'Enter', optionalMods: [] }))
      .toEqual({ kind: 'key', key: 'Enter' });
  });
});
