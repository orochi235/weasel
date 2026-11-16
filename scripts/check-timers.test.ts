import { describe, expect, it } from 'vitest';
import { timerOffenders } from './check-timers';

const lines = (source: string) => timerOffenders('x.ts', source).map((o) => o.line);

describe('timerOffenders', () => {
  it('passes a delay fixed in the source', () => {
    expect(lines('setTimeout(f, 0);\nsetTimeout(f);\nsetTimeout(f, WAIT_MS);\nsetTimeout(f, RETRIES_MS[0]);\nsetTimeout(f, 2 * SECOND_MS);\nwindow.setTimeout(f, -1);\n')).toEqual([]);
  });

  it('catches a delay from an option, a sum, or a call', () => {
    expect(lines('setTimeout(f, ms);\nwindow.setTimeout(f, opts.delay);\nsetTimeout(f, linger * 1000);\nsetTimeout(f, wait());\n')).toEqual([1, 2, 3, 4]);
  });

  it('catches a call split across lines, by the line of its delay', () => {
    expect(lines('setTimeout(() => {\n  run();\n}, delayMs);\n')).toEqual([3]);
  });

  it('ignores the name in a comment or a string', () => {
    expect(lines('// setTimeout(f, ms)\nconst s = "setTimeout(f, ms)";\nclearTimeout(t);\n')).toEqual([]);
  });
});
