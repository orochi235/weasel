import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calibrate, createBar, deviation, measured, planWeights } from './ci-progress.mjs';

const parse = (line: string) => {
  const [, kind, done, total] = /^onto: (plan|progress) (\d+)\/(\d+) ci$/.exec(line) ?? [];
  return { kind, done: Number(done), total: Number(total) };
};

/** Drives a bar over steps of known duration, in seconds, and returns every line it printed. */
const drive = (weights: number[], actual: number[], skipFrom = Infinity) => {
  const lines: string[] = [];
  const bar = createBar(weights, (line) => lines.push(line));
  bar.start();
  actual.forEach((secs, i) => {
    if (i >= skipFrom) return bar.skip(i);
    bar.begin(i);
    vi.advanceTimersByTime(secs * 1000);
    bar.end(i);
  });
  return { lines, score: bar.finish(), bar };
};

describe('planWeights', () => {
  it('gives a step the table does not name the median of those it does', () => {
    expect(planWeights(['a', 'z', 'b'], { a: 1, b: 10, c: 4 })).toEqual([1, 4, 10]);
    expect(planWeights(['z'], { a: 1, b: 3 })).toEqual([2]);
  });
});

describe('createBar', () => {
  beforeEach(() => vi.useFakeTimers({ now: 0 }));
  afterEach(() => vi.useRealTimers());

  it('plans the sum of the weights and reports each step at its full weight', () => {
    const { lines } = drive([10, 1, 5], [1, 1, 1]);
    expect(lines[0]).toBe('onto: plan 0/16 ci');
    expect(lines).toContain('onto: progress 10/16 ci');
    expect(lines).toContain('onto: progress 11/16 ci');
    expect(lines.at(-1)).toBe('onto: progress 16/16 ci');
  });

  it('creeps inside a long step every two seconds', () => {
    const { lines } = drive([100], [9]);
    expect(lines.map(parse).map((p) => p.done)).toEqual([0, 0, 2, 4, 6, 8, 100]);
  });

  it('never creeps past 95% of a step that runs long', () => {
    const { lines } = drive([10, 10], [60, 1]);
    const during = lines.map(parse).filter((p) => p.kind === 'progress' && p.done < 10);
    expect(Math.max(...during.map((p) => p.done))).toBe(Math.floor(0.95 * 10));
  });

  it('only ever moves forward', () => {
    const { lines } = drive([30, 2, 50, 1], [80, 0.1, 3, 20]);
    const done = lines.map(parse).filter((p) => p.kind === 'progress').map((p) => p.done);
    for (let i = 1; i < done.length; i++) expect(done[i]).toBeGreaterThan(done[i - 1]);
  });

  it('advances a skipped step by its weight, so the bar still ends full', () => {
    const { lines } = drive([5, 20, 30], [1, 1, 1], 1);
    expect(lines.slice(-2)).toEqual(['onto: progress 25/55 ci', 'onto: progress 55/55 ci']);
  });

  it('scores a bar whose weights match the run close to zero, and a lopsided one far from it', () => {
    expect(drive([40, 60], [40, 60]).score.mean).toBeLessThan(2);
    expect(drive([90, 10], [10, 90]).score.mean).toBeGreaterThan(30);
  });
});

describe('deviation', () => {
  it('measures a bar that jumps to full at the start as 50 points off on average', () => {
    expect(deviation([{ t: 0, frac: 1 }], 100).mean).toBeCloseTo(50, 1);
    expect(deviation([{ t: 0, frac: 1 }], 100).worst).toBeCloseTo(100, 0);
  });
});

describe('calibrate', () => {
  const log = [
    'ci-run: tree matches abc',
    'ci-run:  1/4 ok     97.1s  (plan  90.0s, 1.08×)  npm run build',
    'ci-run:  2/4 ok     14.8s  (plan  15.0s, 0.99×)  npm run check:manifests',
    'ci-run:  3/4 FAIL    3.0s  (plan  17.5s, 0.17×)  npm run test:smoke:consumer',
    'ci-run:  4/4 ok     15.2s  (plan  15.0s, 1.01×)  npm run check:manifests',
    'ci-run:  1/2 ok      6.5s  npm run build -w @weasel-js/ui',
  ].join('\n');

  it('reads every passing step, averaging a step run twice, from both line formats', () => {
    expect(measured(log)).toEqual({
      'npm run build': 97.1,
      'npm run check:manifests': 15,
      'npm run build -w @weasel-js/ui': 6.5,
    });
  });

  it('round-trips: a run printed from the table calibrates back to it', () => {
    const table = { 'npm ci': 103, 'npm run build': 97.1, 'npm run check:react-free': 0.2 };
    const printed = Object.entries(table)
      .map(([label, s], i) => `ci-run: ${i + 1}/3 ok ${s.toFixed(1).padStart(7)}s  (plan ${s.toFixed(1).padStart(5)}s, 1.00×)  ${label}`)
      .join('\n');
    expect(calibrate({ ...table, 'npm ci': 1, kept: 7 }, printed)).toEqual({ ...table, kept: 7 });
  });
});
