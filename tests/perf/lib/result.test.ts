import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_RESULTS_DIR, SCHEMA, metric, resolveOutPath, rounds, startRun, validateResult,
} from './result.ts';
import { addVitestBench } from './vitest-bench.ts';

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe('metric', () => {
  it('carries value, unit, statistic and a copy of the samples', () => {
    const samples = [1, 2, 3];
    const m = metric(2, 'ms', 'median of 3 runs', samples);
    samples.push(4);
    expect(m).toEqual({ value: 2, unit: 'ms', stat: 'median of 3 runs', samples: [1, 2, 3] });
  });

  it('refuses a value that is not a finite number, or one without unit or statistic', () => {
    expect(() => metric(Number.NaN, 'ms', 'x')).toThrow(/finite/);
    expect(() => metric(Infinity, 'ms', 'x')).toThrow(/finite/);
    expect(() => metric(1, '', 'x')).toThrow(/unit/);
    expect(() => metric(1, 'ms', '')).toThrow(/statistic/);
  });
});

describe('rounds', () => {
  it('uses the default unless WEASEL_PERF_ROUNDS is set', () => {
    delete process.env.WEASEL_PERF_ROUNDS;
    expect(rounds(3)).toBe(3);
    process.env.WEASEL_PERF_ROUNDS = '1';
    expect(rounds(3)).toBe(1);
  });

  it('rejects a count below what the benchmark needs', () => {
    process.env.WEASEL_PERF_ROUNDS = '2';
    expect(() => rounds(8, { min: 4 })).toThrow(/>= 4/);
    process.env.WEASEL_PERF_ROUNDS = 'many';
    expect(() => rounds(3)).toThrow(/integer/);
  });
});

describe('resolveOutPath', () => {
  const result = { benchmark: 'draw-loop', timestamp: '2026-09-13T21:04:05.123Z' } as never;

  it('defaults to a timestamped file in the results directory', () => {
    expect(resolveOutPath(result, undefined)).toBe(join(DEFAULT_RESULTS_DIR, 'draw-loop-2026-09-13T21-04-05Z.json'));
  });

  it('treats a .json path as the file and anything else as a directory', () => {
    expect(resolveOutPath(result, '/x/y/run.json')).toBe('/x/y/run.json');
    expect(resolveOutPath(result, '/x/y')).toBe('/x/y/draw-loop-2026-09-13T21-04-05Z.json');
  });

  it('reads WEASEL_PERF_OUT when no path is passed', () => {
    process.env.WEASEL_PERF_OUT = '/elsewhere';
    expect(resolveOutPath(result)).toBe('/elsewhere/draw-loop-2026-09-13T21-04-05Z.json');
  });
});

describe('startRun', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('records git state, a host fingerprint and the parameters up front', () => {
    const { result } = startRun('draw-loop', { n: 3 });
    expect(result.schema).toBe(SCHEMA);
    expect(result.git.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(typeof result.git.dirty).toBe('boolean');
    expect(Date.parse(result.timestamp)).not.toBeNaN();
    expect(result.machine.cores).toBeGreaterThan(0);
    expect(result.machine.loadavg).toHaveLength(3);
    expect(result.machine.glRenderer).toBeNull();
    expect(result.params).toEqual({ n: 3 });
  });

  it('flags a software GL backend from the renderer string', () => {
    const run = startRun('x');
    run.machine({ glRenderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)' });
    expect(run.result.machine.softwareGl).toBe(true);
    run.machine({ glRenderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, Unspecified Version)' });
    expect(run.result.machine.softwareGl).toBe(false);
  });

  it('rejects a duplicate item id, since compare joins on it', () => {
    const run = startRun('x');
    run.item('a', { t: metric(1, 'ms', 'once') });
    expect(() => run.item('a', { t: metric(2, 'ms', 'once') })).toThrow(/duplicate/);
  });

  it('writes a file that validates and round-trips', () => {
    dir = mkdtempSync(join(tmpdir(), 'perf-result-'));
    const run = startRun('x', { rounds: 1 });
    run.machine({ glRenderer: null, browser: 'chromium 1.2.3' });
    run.item('solid n=100', { perFrame: metric(0.5, 'ms', 'mean of 100 frames') }, { n: 100 });
    const path = run.write({ out: join(dir, 'one.json') });
    const back = JSON.parse(readFileSync(path, 'utf8'));
    expect(validateResult(back)).toEqual([]);
    expect(back.items).toEqual([
      { id: 'solid n=100', params: { n: 100 }, metrics: { perFrame: { value: 0.5, unit: 'ms', stat: 'mean of 100 frames' } } },
    ]);
  });
});

describe('validateResult', () => {
  it('names each structural problem', () => {
    const { result } = startRun('x');
    const bad = { ...result, items: [{ id: 'a', metrics: { t: { value: 1, stat: 'once' } } }, { id: 'a', metrics: {} }] };
    expect(validateResult(bad)).toEqual([
      'items[0] (a).t: unit missing',
      'items[1] (a): duplicate id',
      'items[1] (a): no metrics',
    ]);
    expect(validateResult({ schema: 'other' })[0]).toMatch(/schema/);
  });
});

describe('addVitestBench', () => {
  it('turns each vitest benchmark into an item with units and statistics', () => {
    const run = startRun('vitest-bench');
    addVitestBench(run, {
      files: [{
        filepath: join(DEFAULT_RESULTS_DIR, '../bench/tessellate.bench.ts'),
        groups: [{
          fullName: 'tests/perf/bench/tessellate.bench.ts > tessellate — curve count',
          benchmarks: [{ name: '8 cubics', median: 0.02, min: 0.01, mean: 0.03, rme: 1.5, sampleCount: 400 }],
        }],
      }],
    });
    expect(run.result.items).toEqual([{
      id: 'tests/perf/bench/tessellate.bench.ts > tessellate — curve count > 8 cubics',
      params: { file: 'tests/perf/bench/tessellate.bench.ts', group: 'tessellate — curve count', name: '8 cubics' },
      metrics: {
        median: { value: 0.02, unit: 'ms', stat: 'median of 400 samples' },
        min: { value: 0.01, unit: 'ms', stat: 'min of 400 samples' },
        mean: { value: 0.03, unit: 'ms', stat: 'mean of 400 samples' },
        rme: { value: 1.5, unit: '%', stat: 'relative margin of error on the mean' },
      },
    }]);
  });
});
