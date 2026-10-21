/**
 * The bar `scripts/ci-run.mjs` draws in onto. Its unit is a second of expected wall time: each step
 * weighs what `scripts/ci-run.weights.json` says it took on the fleet, keyed by the step's run text
 * as ci-run prints it, and a step the table does not name weighs the median of the ones it does.
 */
import { readFileSync, writeFileSync } from 'node:fs';

export const WEIGHTS = new URL('../ci-run.weights.json', import.meta.url);
export const LABEL = 'ci';

export const readWeights = (url = WEIGHTS) => JSON.parse(readFileSync(url, 'utf8'));

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 1;
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** Each label's expected seconds, from `table`, or the table's median where it has none. */
export const planWeights = (labels, table) => {
  const fallback = median(Object.values(table));
  return labels.map((label) => table[label] ?? fallback);
};

/**
 * Tracks the bar through a run and prints its protocol lines with `emit`. Within a step the bar
 * creeps with elapsed time, every `every` ms, but never past `cap` of that step's weight, so a step
 * running long holds short of its end until it really finishes.
 */
export const createBar = (weights, emit, { every = 2000, cap = 0.95, now = () => Date.now() } = {}) => {
  const total = Math.max(1, Math.round(weights.reduce((sum, w) => sum + w, 0)));
  const samples = [];
  let started = 0;
  let done = 0;
  let shown = -1;
  let timer;

  const report = (value) => {
    const at = Math.min(total, Math.floor(value));
    if (at <= shown) return;
    shown = at;
    samples.push({ t: now() - started, frac: at / total });
    emit(`onto: progress ${at}/${total} ${LABEL}`);
  };
  const stopCreep = () => {
    clearTimeout(timer);
    timer = undefined;
  };
  const settle = (i) => {
    stopCreep();
    done += weights[i];
    report(done);
  };

  return {
    total,
    samples,
    start() {
      started = now();
      emit(`onto: plan 0/${total} ${LABEL}`);
      report(0);
    },
    begin(i) {
      const t0 = now();
      const creep = () => {
        report(done + Math.min((now() - t0) / 1000, cap * weights[i]));
        timer = setTimeout(creep, every);
      };
      timer = setTimeout(creep, every);
    },
    end: settle,
    skip: settle,
    finish() {
      stopCreep();
      report(total);
      return deviation(samples, now() - started);
    },
  };
};

/**
 * How far the bar the samples draw strays from a perfectly paced one, in points: its mean and its
 * worst, read at evenly spaced instants across `span` ms. Between samples the bar holds its last value.
 */
export const deviation = (samples, span, points = 1000) => {
  if (span <= 0 || samples.length === 0) return { mean: 0, worst: 0 };
  let sum = 0;
  let worst = 0;
  let k = 0;
  for (let i = 0; i < points; i++) {
    const t = ((i + 0.5) / points) * span;
    while (k + 1 < samples.length && samples[k + 1].t <= t) k++;
    const off = Math.abs(samples[k].frac - t / span) * 100;
    sum += off;
    worst = Math.max(worst, off);
  }
  return { mean: sum / points, worst };
};

const STEP = /ci-run:\s+\d+\/\d+ ok\s+([\d.]+)s\s+(?:\(plan[^)]*\)\s+)?(.+?)\s*$/;

/** Each step's measured seconds in a log of ci-run lines, a step run twice taking the mean of both. */
export const measured = (log) => {
  const runs = new Map();
  for (const line of log.split('\n')) {
    const [, secs, label] = STEP.exec(line) ?? [];
    if (label) runs.set(label, [...(runs.get(label) ?? []), Number(secs)]);
  }
  return Object.fromEntries([...runs].map(([label, s]) => [label, Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 10) / 10]));
};

/** `table` with every step `log` measured replaced by that measurement; steps it did not run keep theirs. */
export const calibrate = (table, log) => ({ ...table, ...measured(log) });

export const writeWeights = (table, url = WEIGHTS) => writeFileSync(url, `${JSON.stringify(table, null, 2)}\n`);
