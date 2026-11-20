import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nearestOnPath } from './nearest';
import { pathFromD } from './paths/pathFromD';

const guide = readFileSync(resolve(__dirname, '../docs/guides/paths.md'), 'utf8');

describe("the paths guide's nearestOnPath example", () => {
  it('names the fields the result has, with their values', () => {
    const line = guide.split('\n').find((l) => l.startsWith('// { x: 50, y: 0, t: 0.5'));
    expect(line).toBeDefined();
    const written = Object.fromEntries(
      line!.slice(4, -2).trim().split(', ').map((kv) => kv.split(': ')).map(([k, v]) => [k, Number(v)]),
    );
    const triangle = pathFromD('M0 0 L100 0 L50 80 Z');
    expect(nearestOnPath(triangle.commands, triangle.coords, 50, -10)).toEqual(written);
  });

  it('names the hit tests\' flattening option as they take it', () => {
    expect(guide).not.toMatch(/take a `tolerance` option/);
  });
});
