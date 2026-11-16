import { describe, expect, it } from 'vitest';
import { defineShellConfig } from '../config';
import { FOLLOW_APP } from './globals';

const options = [
  { value: 'a', label: 'A' },
  { value: 'b', label: 'B' },
];

describe('defineShellConfig', () => {
  it('accepts declarations that hold together', () => {
    const config = {
      globals: {
        mode: { label: 'Mode', options, default: FOLLOW_APP, follows: () => 'a' },
        density: { label: 'Density', options, default: 'b', under: 'mode' },
      },
      loupe: { modeGlobal: 'mode' },
    };
    expect(defineShellConfig(config)).toBe(config);
  });

  it('throws on an `under` naming a missing global', () => {
    expect(() => defineShellConfig({ globals: { d: { label: 'D', options, default: 'a', under: 'moed' } } })).toThrow(
      /globals\.d\.under names "moed", which is not a declared global/,
    );
  });

  it('throws on an `under` naming a nested global', () => {
    const globals = {
      top: { label: 'Top', options, default: 'a' },
      mid: { label: 'Mid', options, default: 'a', under: 'top' },
      low: { label: 'Low', options, default: 'a', under: 'mid' },
    };
    expect(() => defineShellConfig({ globals })).toThrow(/globals\.low\.under names "mid", which is itself under "top"/);
  });

  it('throws on a default no option offers', () => {
    expect(() => defineShellConfig({ globals: { d: { label: 'D', options, default: 'c' } } })).toThrow(/globals\.d\.default is "c"/);
    expect(() => defineShellConfig({ globals: { d: { label: 'D', options, default: FOLLOW_APP } } })).toThrow(/default is "app"/);
  });

  it("throws on an option valued 'lab'", () => {
    const globals = { d: { label: 'D', options: [{ value: 'lab', label: 'Lab' }], default: 'lab' } };
    expect(() => defineShellConfig({ globals })).toThrow(/offers the value 'lab'/);
  });

  it('throws on a loupe.modeGlobal naming no global', () => {
    expect(() => defineShellConfig({ globals: {}, loupe: { modeGlobal: 'theme' } })).toThrow(/loupe\.modeGlobal names "theme"/);
    expect(() => defineShellConfig({})).not.toThrow();
  });
});
