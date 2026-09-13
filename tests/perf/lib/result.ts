/**
 * The one result shape every benchmark under `tests/perf/` writes. The schema
 * is described in `tests/perf/README.md`; `validateResult` is its definition.
 *
 * TypeScript, not `.mjs`: a Playwright spec that imports a `.mjs` or `.js`
 * module hangs at "load tests". Node scripts import it as `./lib/result.ts`.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMA = 'weasel-perf-result/1';
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const DEFAULT_RESULTS_DIR = join(REPO_ROOT, 'tests/perf/results');

const SOFTWARE_GL = /swiftshader|llvmpipe|softpipe|software|basic render/i;

export interface Metric { value: number; unit: string; stat: string; samples?: number[] }
export interface Item { id: string; params?: Record<string, unknown>; metrics: Record<string, Metric> }
export interface Machine {
  glRenderer: string | null;
  softwareGl: boolean | null;
  browser: string | null;
  cpu: string | null;
  cores: number;
  os: string;
  node: string;
  loadavg: number[];
}
export interface PerfResult {
  schema: string;
  benchmark: string;
  git: { sha: string | null; dirty: boolean | null };
  timestamp: string;
  machine: Machine;
  params: Record<string, unknown>;
  items: Item[];
}

export function gitState(cwd = REPO_ROOT): PerfResult['git'] {
  const git = (...args: string[]) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    return { sha: git('rev-parse', 'HEAD').trim(), dirty: git('status', '--porcelain').trim() !== '' };
  } catch {
    return { sha: null, dirty: null };
  }
}

/** The host half of the fingerprint. GL and browser are filled in by whoever has them. */
export function hostFingerprint(): Machine {
  const cpus = os.cpus();
  return {
    glRenderer: null,
    softwareGl: null,
    browser: null,
    cpu: cpus[0]?.model?.trim() ?? null,
    cores: os.availableParallelism?.() ?? cpus.length,
    os: `${os.type()} ${os.release()} ${os.arch()}`,
    node: process.version,
    loadavg: os.loadavg().map((x) => +x.toFixed(2)),
  };
}

export const isSoftwareGl = (renderer: string): boolean => SOFTWARE_GL.test(renderer);

/**
 * @param unit  e.g. `ms`, `us`, `count`, `%`
 * @param stat  how `value` was reduced, e.g. `median of 3 runs`
 * @param samples  the per-round values behind it
 */
export function metric(value: number, unit: string, stat: string, samples?: number[]): Metric {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`metric value must be a finite number, got ${value}`);
  }
  if (!unit) throw new TypeError('metric needs a unit');
  if (!stat) throw new TypeError('metric needs the statistic it reports');
  return samples ? { value, unit, stat, samples: [...samples] } : { value, unit, stat };
}

/** Rounds to run: the benchmark's default, or `WEASEL_PERF_ROUNDS`. */
export function rounds(fallback: number, { min = 1 }: { min?: number } = {}): number {
  const raw = process.env.WEASEL_PERF_ROUNDS;
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min) {
    throw new Error(`WEASEL_PERF_ROUNDS=${raw}: this benchmark needs an integer >= ${min}`);
  }
  return n;
}

/**
 * Where a result goes: an explicit `out`, else `WEASEL_PERF_OUT`, else the
 * gitignored results directory. A path ending in `.json` is the file itself;
 * anything else is a directory that gets a timestamped name.
 */
export function resolveOutPath(
  result: Pick<PerfResult, 'benchmark' | 'timestamp'>,
  out: string | undefined = process.env.WEASEL_PERF_OUT,
): string {
  const target = out ? (isAbsolute(out) ? out : resolve(process.cwd(), out)) : DEFAULT_RESULTS_DIR;
  if (target.endsWith('.json')) return target;
  const stamp = result.timestamp.replace(/\.\d+Z$/, 'Z').replace(/:/g, '-');
  return join(target, `${result.benchmark}-${stamp}.json`);
}

/** Structural problems with a parsed result, empty when it is well formed. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateResult(r: any): string[] {
  const problems: string[] = [];
  if (!r || typeof r !== 'object') return ['not an object'];
  if (r.schema !== SCHEMA) problems.push(`schema is ${JSON.stringify(r.schema)}, expected ${SCHEMA}`);
  if (typeof r.benchmark !== 'string' || !r.benchmark) problems.push('benchmark id missing');
  if (!r.git || !('sha' in r.git) || !('dirty' in r.git)) problems.push('git.sha / git.dirty missing');
  if (typeof r.timestamp !== 'string' || Number.isNaN(Date.parse(r.timestamp))) problems.push('timestamp is not ISO');
  const m = r.machine;
  if (!m || typeof m !== 'object') problems.push('machine missing');
  else {
    for (const k of ['glRenderer', 'softwareGl', 'browser', 'cpu', 'cores', 'os', 'node', 'loadavg']) {
      if (!(k in m)) problems.push(`machine.${k} missing`);
    }
  }
  if (!r.params || typeof r.params !== 'object') problems.push('params missing');
  if (!Array.isArray(r.items)) return [...problems, 'items is not an array'];
  const seen = new Set<string>();
  for (const [i, item] of r.items.entries()) {
    const where = `items[${i}]${item?.id ? ` (${item.id})` : ''}`;
    if (typeof item?.id !== 'string' || !item.id) { problems.push(`${where}: id missing`); continue; }
    if (seen.has(item.id)) problems.push(`${where}: duplicate id`);
    seen.add(item.id);
    const metrics = Object.entries(item.metrics ?? {}) as Array<[string, Partial<Metric> | undefined]>;
    if (metrics.length === 0) problems.push(`${where}: no metrics`);
    for (const [name, mt] of metrics) {
      if (typeof mt?.value !== 'number' || !Number.isFinite(mt.value)) problems.push(`${where}.${name}: value not finite`);
      if (typeof mt?.unit !== 'string' || !mt.unit) problems.push(`${where}.${name}: unit missing`);
      if (typeof mt?.stat !== 'string' || !mt.stat) problems.push(`${where}.${name}: stat missing`);
    }
  }
  return problems;
}

export interface PerfRun {
  result: PerfResult;
  machine(m: { glRenderer?: string | null; browser?: string | null }): void;
  /** Parameters only known once the run is under way. */
  params(extra: Record<string, unknown>): void;
  /** `id` is unique within the run; `perf:compare` joins on it. */
  item(id: string, metrics: Record<string, Metric>, itemParams?: Record<string, unknown>): void;
  /** Validates, writes, prints the path, and returns it. */
  write(opts?: { out?: string }): string;
}

/**
 * Start a run. Call before measuring: the timestamp and load average are
 * taken here.
 * @param benchmark  stable id, normally the file's stem
 */
export function startRun(benchmark: string, params: Record<string, unknown> = {}): PerfRun {
  const result: PerfResult = {
    schema: SCHEMA,
    benchmark,
    git: gitState(),
    timestamp: new Date().toISOString(),
    machine: hostFingerprint(),
    params: { ...params },
    items: [],
  };
  const ids = new Set<string>();

  return {
    result,
    machine({ glRenderer, browser }) {
      if (glRenderer !== undefined) {
        result.machine.glRenderer = glRenderer;
        result.machine.softwareGl = glRenderer === null ? null : isSoftwareGl(glRenderer);
      }
      if (browser !== undefined) result.machine.browser = browser;
    },
    params(extra) {
      Object.assign(result.params, extra);
    },
    item(id, metrics, itemParams) {
      if (ids.has(id)) throw new Error(`${benchmark}: duplicate item id ${JSON.stringify(id)}`);
      if (Object.keys(metrics).length === 0) throw new Error(`${benchmark}: item ${id} has no metrics`);
      ids.add(id);
      result.items.push(itemParams ? { id, params: itemParams, metrics } : { id, metrics });
    },
    write({ out } = {}) {
      const problems = validateResult(result);
      if (problems.length) throw new Error(`${benchmark}: malformed result:\n  ${problems.join('\n  ')}`);
      const path = resolveOutPath(result, out);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`);
      const rel = relative(process.cwd(), path);
      console.log(`perf result: ${rel && !rel.startsWith('..') ? rel : path}`);
      return path;
    },
  };
}
