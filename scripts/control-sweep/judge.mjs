/** The control sweep's pure parts: reading the registry, judging captures, the allowlist, and pruning runs. */
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Every demo in `apps/site/registry.ts`, in its order, as `{ id, path }`. */
export const demosIn = (registrySource) => {
  const out = [];
  for (const m of registrySource.matchAll(/^ {4}id: '([^']+)',[\s\S]*?^ {4}path: '([^']+)'/gm)) out.push({ id: m[1], path: m[2] });
  return out;
};

/** The keys whose values differ between two digests, a key present in only one included. */
export const differingKeys = (a, b) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].filter((k) => a[k] !== b[k]);
};

/**
 * Compares a capture after operating a control with two taken before it, a settle apart. What
 * changed between the two before captures moves by itself (an animation, a clock) and is left out.
 * Answers which canvases and how many DOM elements changed, and which canvases animate.
 */
export const compareCaptures = (before0, before1, after) => {
  const volatile = new Set(differingKeys(before0.dom, before1.dom));
  const domChanged = differingKeys(before1.dom, after.dom).filter((k) => !volatile.has(k));
  const animated = [];
  const canvasChanged = [];
  const count = Math.max(before1.canvases.length, after.canvases.length);
  for (let i = 0; i < count; i++) {
    if (before0.canvases[i] !== before1.canvases[i]) animated.push(i);
    else if (before1.canvases[i] !== after.canvases[i]) canvasChanged.push(i);
  }
  return { domChanged: domChanged.length, canvasChanged, animated, volatile: volatile.size };
};

/** `alive` when anything steady changed, `unsure` when only an animating canvas could have shown it, else `dead`. */
export const verdictOf = (cmp) => {
  if (cmp.domChanged > 0 || cmp.canvasChanged.length > 0) return { verdict: 'alive' };
  if (cmp.animated.length > 0) return { verdict: 'unsure', reason: `only animating canvases (${cmp.animated.join(', ')}) could show a change` };
  return { verdict: 'dead' };
};

/** Whether two captures agree on everything that holds still, as `before0`/`before1` tell it. */
export const sameSteadyState = (before0, before1, other) => {
  const cmp = compareCaptures(before0, before1, other);
  return cmp.domChanged === 0 && cmp.canvasChanged.length === 0;
};

/** A digest's own fingerprint, for the record: one hash over every element's. */
export const fingerprintOf = (capture, hash) => ({
  dom: hash(Object.entries(capture.dom).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}:${v}`).join('\n')),
  elements: Object.keys(capture.dom).length,
  canvases: capture.canvases,
});

/** The allowlist: `[{ demo, control, reason }]`, `control` being a control's label as the sweep prints it. */
export const readAllow = (path) => {
  if (!existsSync(path)) return [];
  const list = JSON.parse(readFileSync(path, 'utf8'));
  if (!Array.isArray(list)) throw new Error(`${path}: wants an array of { demo, control, reason }`);
  for (const e of list) {
    if (!e.demo || !e.control || !e.reason) throw new Error(`${path}: every entry needs demo, control and reason: ${JSON.stringify(e)}`);
  }
  return list;
};

export const waiverFor = (allow, demo, label) => allow.find((e) => e.demo === demo && e.control === label);

/**
 * Entries that waived nothing this run, among the demos it swept. The list only shrinks: these are
 * the ones to delete, and nothing ever adds one but a person.
 */
export const staleWaivers = (allow, swept, deadLabels) =>
  allow.filter((e) => swept.has(e.demo) && !deadLabels.has(`${e.demo}\u0000${e.control}`));

export const writeAllow = (path, list) => writeFileSync(path, `${JSON.stringify(list, null, 2)}\n`);

/** Run directories are named by their start time; the newest `keep` stay. Answers the ones deleted. */
export const RUN_NAME = /^\d{4}-\d\d-\d\dT[\w-]+$|^night-/;
export const pruneRuns = (parent, keep) => {
  if (!existsSync(parent)) return [];
  const runs = readdirSync(parent, { withFileTypes: true })
    .filter((e) => e.isDirectory() && RUN_NAME.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => (statTime(join(parent, a)) - statTime(join(parent, b))) || (a < b ? -1 : 1));
  const gone = runs.slice(0, Math.max(0, runs.length - keep));
  for (const name of gone) rmSync(join(parent, name), { recursive: true, force: true });
  return gone;
};

const statTime = (dir) => {
  const started = join(dir, 'started');
  return existsSync(started) ? Number(readFileSync(started, 'utf8')) || 0 : 0;
};

/** A plain-text table of the dead controls, columns padded to their widest cell. */
export const deadTable = (dead) => {
  if (dead.length === 0) return '';
  const rows = [['demo', 'control', 'kind', 'under'], ...dead.map((d) => [d.demo, d.label, d.kind, d.precondition ?? ''])];
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  return rows.map((r) => r.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd()).join('\n');
};

/** A filesystem-safe slug of a control's label. */
export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'control';
