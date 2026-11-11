/** Settling a definition entry's `by`s and seeds, and reading a ramp or scale entry into the values `derive` makes tokens of. */
import { isPlainObject } from '@weasel-js/registry';
import { isByAxis, pick, type Selection } from '../axes.ts';
import { DEFAULT_CONSTRAINTS, type Anchor, type Constraints } from './color/generate.ts';
import { categoricalRamp, lightnessRamp } from './ramps.ts';
import { scale } from './scales.ts';
import type { Issue } from './types.ts';

const SEED_REF = /^\{seeds\.([\w-]+)\}$/;
const HEX = /^#[0-9a-f]{6}$/i;
const has = (o: object, key: string) => Object.hasOwn(o, key);

export interface SettleContext {
  readonly sel: Selection;
  readonly seeds: Readonly<Record<string, number | string>>;
  /** Every seed the definition declares, whether or not it resolved at this selection. */
  readonly declaredSeeds: ReadonlySet<string>;
  readonly issues: Issue[];
}

interface Settled {
  readonly value: unknown;
  readonly ok: boolean;
}

/** `v` with every `by` picked and every `{seeds.name}` replaced, at any depth. What cannot settle is left undefined and clears `ok`. */
export function settle(v: unknown, path: string, ctx: SettleContext): Settled {
  if (isByAxis(v)) {
    const picked = pick(v, ctx.sel);
    if (!picked.ok) {
      ctx.issues.push({ kind: 'missing-axis-value', path, axis: picked.axis, value: picked.value });
      return { value: undefined, ok: false };
    }
    return settle(picked.value, path, ctx);
  }
  if (Array.isArray(v)) {
    let ok = true;
    const value = v.map((x, i) => {
      const s = settle(x, `${path}.${i}`, ctx);
      ok = s.ok && ok;
      return s.value;
    });
    return { value, ok };
  }
  if (typeof v === 'object' && v !== null) {
    let ok = true;
    const value: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      const s = settle(x, `${path}.${k}`, ctx);
      ok = s.ok && ok;
      value[k] = s.value;
    }
    return { value, ok };
  }
  if (typeof v === 'string') {
    const m = SEED_REF.exec(v.trim());
    if (!m) return { value: v, ok: true };
    if (has(ctx.seeds, m[1])) return { value: ctx.seeds[m[1]], ok: true };
    // A declared seed that did not resolve already reported its missing axis value.
    if (!ctx.declaredSeeds.has(m[1])) ctx.issues.push({ kind: 'invalid', path, message: `unknown seed "${m[1]}"` });
    return { value: undefined, ok: false };
  }
  return { value: v, ok: true };
}

/** Reads a settled entry, reporting every value of the wrong shape. */
class Reader {
  ok = true;
  private readonly issues: Issue[];

  constructor(issues: Issue[]) {
    this.issues = issues;
  }

  fail(path: string, message: string): void {
    this.issues.push({ kind: 'invalid', path, message });
    this.ok = false;
  }

  num(x: unknown, path: string): number {
    if (typeof x === 'number' && Number.isFinite(x)) return x;
    this.fail(path, 'expected a number');
    return Number.NaN;
  }

  optNum(x: unknown, path: string, fallback: number): number;
  optNum(x: unknown, path: string): number | undefined;
  optNum(x: unknown, path: string, fallback?: number): number | undefined {
    return x === undefined ? fallback : this.num(x, path);
  }

  optNums(x: unknown, path: string): number[] | undefined {
    if (x === undefined) return undefined;
    if (!Array.isArray(x)) {
      this.fail(path, 'expected an array of numbers');
      return undefined;
    }
    return x.map((v, i) => this.num(v, `${path}.${i}`));
  }

  record(x: unknown, path: string): Record<string, unknown> {
    if (x === undefined) return {};
    if (isPlainObject(x)) return x;
    this.fail(path, 'expected an object');
    return {};
  }
}

export const isRecord = isPlainObject;

export const stepNames = (x: unknown): string[] | undefined =>
  Array.isArray(x) && x.every((s) => typeof s === 'string') ? x : undefined;

export function rampColors(name: string, r: Record<string, unknown>, steps: readonly string[], ctx: SettleContext): Record<string, string> | undefined {
  const path = `ramps.${name}`;
  const read = new Reader(ctx.issues);

  if (r.kind === 'lightness') {
    const l = r.lightness;
    let lightness: [number, number] = [0, 0];
    if (Array.isArray(l) && l.length === 2) lightness = [read.num(l[0], `${path}.lightness.0`), read.num(l[1], `${path}.lightness.1`)];
    else read.fail(`${path}.lightness`, 'expected two numbers');
    const chroma = read.record(r.chroma, `${path}.chroma`);
    const atLeastZero = (v: number, at: string) => {
      if (v < 0) read.fail(at, 'expected a number ≥ 0');
      return v;
    };
    const peak = r.chroma === undefined ? 0 : atLeastZero(read.num(chroma.peak, `${path}.chroma.peak`), `${path}.chroma.peak`);
    const anchor: Record<string, string> = {};
    for (const [step, v] of Object.entries(read.record(r.anchor, `${path}.anchor`))) {
      if (typeof v === 'string' && HEX.test(v)) anchor[step] = v;
      else read.fail(`${path}.anchor.${step}`, 'expected a hex color');
    }
    const params = {
      steps,
      lightness,
      curve: read.optNum(r.curve, `${path}.curve`, 0),
      hue: read.optNum(r.hue, `${path}.hue`, 0),
      peak,
      lightBias: atLeastZero(read.optNum(chroma.lightBias, `${path}.chroma.lightBias`, 0), `${path}.chroma.lightBias`),
      darkBias: atLeastZero(read.optNum(chroma.darkBias, `${path}.chroma.darkBias`, 0), `${path}.chroma.darkBias`),
      anchor,
    };
    return read.ok ? lightnessRamp(params) : undefined;
  }

  if (r.kind === 'categorical') {
    const gates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(read.record(r.gates, `${path}.gates`))) {
      const at = `${path}.gates.${k}`;
      if (!has(DEFAULT_CONSTRAINTS, k) || k === 'count' || k === 'anchors') read.fail(at, 'unknown gate');
      else if (k === 'surface') {
        if (typeof v === 'string' && HEX.test(v)) gates[k] = v;
        else read.fail(at, 'expected a hex color');
      } else if (k === 'order') {
        if (v === 'hue' || v === 'farthest') gates[k] = v;
        else read.fail(at, 'expected "hue" or "farthest"');
      } else gates[k] = read.num(v, at);
    }
    const anchors: Anchor[] = [];
    const rawAnchors = r.anchors ?? [];
    if (!Array.isArray(rawAnchors)) read.fail(`${path}.anchors`, 'expected a list');
    else {
      rawAnchors.forEach((a, i) => {
        const at = `${path}.anchors.${i}`;
        const o = read.record(a, at);
        if (typeof o.name !== 'string') read.fail(`${at}.name`, 'expected a string');
        anchors.push({
          name: String(o.name),
          hue: read.num(o.hue, `${at}.hue`),
          lightness: read.num(o.lightness, `${at}.lightness`),
          chroma: read.optNum(o.chroma, `${at}.chroma`),
        });
      });
    }
    if (!read.ok) return undefined;
    const { colors, feasible } = categoricalRamp(steps, gates as Partial<Constraints>, anchors);
    if (!feasible) ctx.issues.push({ kind: 'infeasible-ramp', ramp: name });
    return colors;
  }

  read.fail(`${path}.kind`, 'expected "lightness" or "categorical"');
  return undefined;
}

export function scaleValues(name: string, s: Record<string, unknown>, steps: readonly string[], issues: Issue[]): { values: Record<string, string>; rule: string } | undefined {
  const path = `scales.${name}`;
  const read = new Reader(issues);
  const base = read.num(s.base, `${path}.base`);
  const step = read.optNum(s.step, `${path}.step`);
  const ratio = read.optNum(s.ratio, `${path}.ratio`);
  const factors = read.optNums(s.factors, `${path}.factors`);
  if (!read.ok) return undefined;
  try {
    const rule = factors !== undefined ? 'factors' : step !== undefined ? 'linear' : 'geometric';
    return { values: scale(steps, { base, step, ratio, factors }), rule };
  } catch (e) {
    issues.push({ kind: 'invalid', path, message: (e as Error).message });
    return undefined;
  }
}
