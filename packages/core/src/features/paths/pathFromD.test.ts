/**
 * `pathFromD` — direct unit coverage for the core SVG path-data (`d`)
 * entry point. The svg package has its own end-to-end coverage through
 * `parseSvg`; here we exercise the function consumers actually call.
 */

import { describe, it, expect } from 'vitest';
import { pathFromD } from './pathFromD';
import { PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z } from './types';

function dump(d: string): { commands: number[]; coords: number[] } {
  const p = pathFromD(d);
  expect(p.kind).toBe('polygon');
  return { commands: Array.from(p.commands), coords: Array.from(p.coords) };
}

describe('pathFromD', () => {
  it('lowers M/L absolute', () => {
    const r = dump('M10 20 L30 40');
    expect(r.commands).toEqual([PATH_M, PATH_L]);
    expect(r.coords).toEqual([10, 20, 30, 40]);
  });

  it('resolves relative commands against the cursor', () => {
    const r = dump('m10 20 l5 5');
    expect(r.coords).toEqual([10, 20, 15, 25]);
  });

  it('expands H/V shorthands to lineTo', () => {
    const r = dump('M0 0 H50 V30');
    expect(r.commands).toEqual([PATH_M, PATH_L, PATH_L]);
    expect(r.coords).toEqual([0, 0, 50, 0, 50, 30]);
  });

  it('keeps cubic and quadratic curves', () => {
    expect(dump('M0 0 C10 10 20 10 30 0').commands).toEqual([PATH_M, PATH_C]);
    expect(dump('M0 0 Q10 10 20 0').commands).toEqual([PATH_M, PATH_Q]);
  });

  it('reflects the smooth-cubic control point', () => {
    const r = dump('M0 0 C10 10 20 10 30 0 S40 -10 50 0');
    expect(r.commands).toEqual([PATH_M, PATH_C, PATH_C]);
    expect(r.coords.slice(8, 10)).toEqual([40, -10]);
  });

  it('approximates arcs with cubics landing on the endpoint', () => {
    const r = dump('M20 50 A 30 20 0 0 1 80 50');
    expect(r.commands[0]).toBe(PATH_M);
    expect(r.commands.slice(1).every((c) => c === PATH_C)).toBe(true);
    const [ex, ey] = r.coords.slice(-2);
    expect(Math.round(ex)).toBe(80);
    expect(Math.round(ey)).toBe(50);
  });

  it('closes on Z (either case)', () => {
    expect(dump('M0 0 L10 0 L10 10 Z').commands).toEqual([PATH_M, PATH_L, PATH_L, PATH_Z]);
    expect(dump('M0 0 L10 0 L10 10 z').commands).toEqual([PATH_M, PATH_L, PATH_L, PATH_Z]);
  });

  it('treats trailing M coord pairs as implicit lineTo', () => {
    const r = dump('M0 0 10 10 20 0');
    expect(r.commands).toEqual([PATH_M, PATH_L, PATH_L]);
  });

  it('reports unknown command letters via onWarn and skips them', () => {
    const warnings: string[] = [];
    const r = pathFromD('M0 0 K5 5 L10 10', (m) => warnings.push(m));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/unknown path command: K/);
    expect(Array.from(r.commands)).toEqual([PATH_M, PATH_L]);
  });
});
