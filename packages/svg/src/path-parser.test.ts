/**
 * Path-command coverage: exercise every SVG `d=` command letter at least
 * once, including the relative variants and the arc (A/a). We don't
 * pixel-compare; instead we sanity-check the resulting weasel command
 * stream length and the final cursor position.
 */

import { describe, it, expect } from 'vitest';
import { parseSvg } from './index';
import { PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z } from '@weasel-js/core';

function pathFromSvg(d: string): { commands: number[]; coords: number[] } {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`;
  const { nodes } = parseSvg(svg);
  expect(nodes).toHaveLength(1);
  const n = nodes[0];
  expect(n.kind).toBe('path');
  if (n.kind !== 'path') throw new Error();
  expect(n.path.kind).toBe('polygon');
  if (n.path.kind !== 'polygon') throw new Error();
  return { commands: Array.from(n.path.commands), coords: Array.from(n.path.coords) };
}

describe('SVG path commands', () => {
  it('M and L (absolute)', () => {
    const r = pathFromSvg('M10 20 L30 40');
    expect(r.commands).toEqual([PATH_M, PATH_L]);
    expect(r.coords).toEqual([10, 20, 30, 40]);
  });

  it('m and l (relative)', () => {
    const r = pathFromSvg('m10 20 l5 5');
    expect(r.commands).toEqual([PATH_M, PATH_L]);
    expect(r.coords).toEqual([10, 20, 15, 25]);
  });

  it('H and V', () => {
    const r = pathFromSvg('M0 0 H50 V30');
    expect(r.commands).toEqual([PATH_M, PATH_L, PATH_L]);
    expect(r.coords).toEqual([0, 0, 50, 0, 50, 30]);
  });

  it('h and v (relative)', () => {
    const r = pathFromSvg('M10 10 h20 v15');
    expect(r.coords).toEqual([10, 10, 30, 10, 30, 25]);
  });

  it('C (cubic)', () => {
    const r = pathFromSvg('M0 0 C10 10 20 10 30 0');
    expect(r.commands).toEqual([PATH_M, PATH_C]);
    expect(r.coords).toEqual([0, 0, 10, 10, 20, 10, 30, 0]);
  });

  it('S reflects prior cubic control', () => {
    const r = pathFromSvg('M0 0 C10 10 20 10 30 0 S40 -10 50 0');
    // Second control of the C is (20, 10); reflecting about (30, 0) → (40, -10).
    expect(r.commands).toEqual([PATH_M, PATH_C, PATH_C]);
    // Verify the reflected control of the implicit cubic.
    expect(r.coords.slice(8, 10)).toEqual([40, -10]);
  });

  it('Q (quadratic)', () => {
    const r = pathFromSvg('M0 0 Q10 10 20 0');
    expect(r.commands).toEqual([PATH_M, PATH_Q]);
    expect(r.coords).toEqual([0, 0, 10, 10, 20, 0]);
  });

  it('T reflects prior quad control', () => {
    const r = pathFromSvg('M0 0 Q10 10 20 0 T40 0');
    expect(r.commands).toEqual([PATH_M, PATH_Q, PATH_Q]);
    // Prior quad ctrl was (10, 10); reflect about (20, 0) → (30, -10).
    expect(r.coords.slice(6, 8)).toEqual([30, -10]);
  });

  it('A (arc) emits cubic segments', () => {
    const r = pathFromSvg('M20 50 A 30 20 0 0 1 80 50');
    // 60-unit horizontal span; arc with rx=30,ry=20,sweep=1,largeArc=0.
    // We expect a moveto + at least one cubic landing exactly at (80, 50).
    expect(r.commands[0]).toBe(PATH_M);
    expect(r.commands.slice(1).every((c) => c === PATH_C)).toBe(true);
    const last2 = r.coords.slice(-2);
    expect(Math.round(last2[0])).toBe(80);
    expect(Math.round(last2[1])).toBe(50);
  });

  it('a (relative arc)', () => {
    const r = pathFromSvg('M20 50 a 30 20 0 0 1 60 0');
    const last2 = r.coords.slice(-2);
    expect(Math.round(last2[0])).toBe(80);
    expect(Math.round(last2[1])).toBe(50);
  });

  it('Z closes', () => {
    const r = pathFromSvg('M0 0 L10 0 L10 10 Z');
    expect(r.commands).toEqual([PATH_M, PATH_L, PATH_L, PATH_Z]);
  });

  it('lowercase z closes', () => {
    const r = pathFromSvg('M0 0 L10 0 L10 10 z');
    expect(r.commands).toEqual([PATH_M, PATH_L, PATH_L, PATH_Z]);
  });

  it('implicit L after M', () => {
    const r = pathFromSvg('M0 0 10 10 20 0');
    expect(r.commands).toEqual([PATH_M, PATH_L, PATH_L]);
    expect(r.coords).toEqual([0, 0, 10, 10, 20, 0]);
  });
});
