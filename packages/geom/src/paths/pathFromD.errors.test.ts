import { describe, expect, it } from 'vitest';
import { PATH_L, PATH_M } from '../commands';
import { pathFromD } from './pathFromD';

// SVG 2, "Path data errors": a path is rendered up to, but not including,
// the command containing the first error, and path data must begin with a
// moveto.
function read(d: string): { commands: number[]; coords: number[]; warnings: string[] } {
  const warnings: string[] = [];
  const path = pathFromD(d, (m) => warnings.push(m));
  return { commands: Array.from(path.commands), coords: Array.from(path.coords), warnings };
}

describe('pathFromD and path data in error', () => {
  it('draws nothing when the data does not begin with a moveto', () => {
    const out = read('L10 10 L20 0');
    expect(out.commands).toEqual([]);
    expect(out.warnings).toEqual([expect.stringMatching(/moveto/)]);
  });

  it('stops at a command with too few arguments', () => {
    const out = read('M0 0 L10 10 L 20 l5 5');
    expect(out.commands).toEqual([PATH_M, PATH_L]);
    expect(out.coords).toEqual([0, 0, 10, 10]);
    expect(out.warnings).toEqual([expect.stringMatching(/L.*argument/)]);
  });

  it('keeps the whole groups of a repeated command before a short one', () => {
    const out = read('M0 0 L10 10 20 20 30 Z');
    expect(out.commands).toEqual([PATH_M, PATH_L, PATH_L]);
    expect(out.coords).toEqual([0, 0, 10, 10, 20, 20]);
    expect(out.warnings).toHaveLength(1);
  });

  it('stops at an arc whose flag is not 0 or 1', () => {
    const out = read('M0 0 A5 5 0 2 1 10 10 L20 20');
    expect(out.commands).toEqual([PATH_M]);
    expect(out.warnings).toHaveLength(1);
  });

  it('stops at a moveto with one coordinate', () => {
    const out = read('M 10');
    expect(out.commands).toEqual([]);
    expect(out.warnings).toHaveLength(1);
  });

  it('reads well-formed data without a warning', () => {
    const out = read('M0 0 l10 0 a1 1 0 01 2 2 z m5 5 h1');
    expect(out.warnings).toEqual([]);
    expect(out.commands[0]).toBe(PATH_M);
  });
});
