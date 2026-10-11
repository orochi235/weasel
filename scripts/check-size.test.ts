import { describe, expect, it } from 'vitest';
import { measure, verdict } from './check-size.mjs';

const CAPS = { lines: 400, fn: 120 };
const fnOf = (n: number) => `function f() {\n${'  x();\n'.repeat(n - 2)}}\n`;

describe('measure', () => {
  it('counts lines the way wc does', () => {
    expect(measure('a;\nb;\n').lines).toBe(2);
    expect(measure('a;\nb;').lines).toBe(2);
  });

  it('measures the longest function, nested ones included', () => {
    expect(measure(fnOf(10)).longestFunction).toBe(10);
    expect(measure(`const o = {\n  start() {\n    a();\n    b();\n  },\n};\n`).longestFunction).toBe(4);
    expect(measure(`const f = () => {\n  a();\n};\n`).longestFunction).toBe(3);
  });

  it('does not count a signature with no body', () => {
    expect(measure('interface A {\n  f(\n    a: number,\n  ): void;\n}\n').longestFunction).toBe(0);
  });

  it('parses tsx', () => {
    expect(measure('const A = () => (\n  <div />\n);\n', 'a.tsx').longestFunction).toBe(3);
  });
});

describe('verdict', () => {
  it('passes a file under both caps with no entry', () => {
    expect(verdict({ lines: 400, longestFunction: 120 }, undefined, CAPS)).toBe('ok');
  });

  it('fails a file over a cap with no entry', () => {
    expect(verdict({ lines: 401, longestFunction: 10 }, undefined, CAPS)).toBe('over');
    expect(verdict({ lines: 10, longestFunction: 121 }, undefined, CAPS)).toBe('over');
  });

  it('lets an allowlisted file stay at its recorded size', () => {
    expect(verdict({ lines: 900, longestFunction: 300 }, { lines: 900, longestFunction: 300 }, CAPS)).toBe('ok');
  });

  it('fails an allowlisted file that grew', () => {
    expect(verdict({ lines: 901, longestFunction: 10 }, { lines: 900 }, CAPS)).toBe('over');
    expect(verdict({ lines: 900, longestFunction: 121 }, { lines: 900 }, CAPS)).toBe('over');
  });

  it('fails an entry the file has shrunk below, so the gain is kept', () => {
    expect(verdict({ lines: 700, longestFunction: 10 }, { lines: 900 }, CAPS)).toBe('stale');
    expect(verdict({ lines: 100, longestFunction: 10 }, { lines: 900 }, CAPS)).toBe('stale');
    expect(verdict({ lines: 900, longestFunction: 200 }, { lines: 900, longestFunction: 300 }, CAPS)).toBe('stale');
  });
});
