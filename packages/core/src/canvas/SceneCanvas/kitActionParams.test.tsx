/**
 * Every tunable value of a bundled action is a lever in the last-operation panel: a leaf of the action's `params`
 * form, with a label, a range and, where it has one, a unit. Two checks hold the kit to it. The forms of every
 * action the kit sweep reaches are read for what each number leaf declares, and the source of every file that
 * defines an action is read for numbers that should be a leaf and are not, past the allowlist beside this file.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { prefLeaves, type PrefGroup, type PrefLeaf, type PrefNumber } from '@weasel-js/prefs';
import type { Action } from '@weasel-js/routing';
import { sweepKit } from './kitSweep.fixture';
import { ACTION_LITERALS } from './kitActionParams.allow';

const ROOT = join(__dirname, '../../../../..');

/** Params a function form is asked with, to reach each form it can answer: every kind of shape an insert makes,
 *  and a run naming every setting. */
const PROBES: readonly Readonly<Record<string, unknown>>[] = [
  {}, { kind: 'polygon' }, { kind: 'star' }, { shape: 'polygon' }, { shape: 'star' },
  new Proxy({}, { get: (_t, key) => (typeof key === 'string' ? 1 : undefined), has: () => true }),
];

function formsOf(action: Action): PrefGroup[] {
  const { params } = action;
  if (!params) return [];
  if (typeof params !== 'function') return [params];
  return [...new Set(PROBES.map((p) => params(p)).filter((f): f is PrefGroup => f !== null))];
}

const isNumber = (leaf: PrefLeaf): leaf is PrefNumber => leaf.kind === 'number';

/** What `leaf`, at `path` in an action's form, fails to declare. */
function numberLeafProblems(path: string, leaf: PrefNumber): string[] {
  if (leaf.hidden) return [];
  const key = path.split('.').at(-1)!;
  const out: string[] = [];
  if (!leaf.name) out.push('no label');
  const ends = (end: 'min' | 'max') => Number.isFinite(leaf[end]) || leaf.endless === end;
  if (!ends('min') || !ends('max')) out.push('no range');
  if (/Px$/.test(key) && leaf.unit?.suffix !== 'px') out.push('a screen-px key without PX_UNIT');
  if (!/Px$/.test(key) && leaf.unit?.suffix === 'px') out.push('a px unit on a key not named …Px');
  if (/angle|Angle|turn|Turn/.test(key) && leaf.unit?.suffix !== '°') out.push('an angle without a degree unit');
  return out;
}

describe('the params forms of every bundled action', () => {
  const sweep = sweepKit();

  it('give every number a label and a range, and a unit where its key names one', () => {
    const problems: string[] = [];
    let checked = 0;
    for (const [id, { action }] of sweep.actions) {
      for (const form of formsOf(action)) {
        for (const [path, leaf] of prefLeaves(form)) {
          if (!isNumber(leaf)) continue;
          checked++;
          for (const p of numberLeafProblems(path, leaf)) problems.push(`${id}: ${path} has ${p}`);
        }
      }
    }
    expect(checked).toBeGreaterThan(40);
    expect(problems).toEqual([]);
  });
});

/** Every source file under `dir`, tests and stories aside. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const at = join(dir, name);
    if (statSync(at).isDirectory()) return name === 'node_modules' || name === 'dist' ? [] : sources(at);
    return /\.tsx?$/.test(name) && !/\.(test|stories|fixture|typetest)\./.test(name) && !/TestUtils|\.d\.ts$/.test(name) ? [at] : [];
  });
}

const DEFINES_ACTION = /\binvoker:|\blivePathEdit\(/;

/** The trivial numbers no allowlist entry is asked to explain: zero, one, two and their negatives. */
const TRIVIAL = new Set(['0', '1', '2']);

/** Whether `node` is a params leaf's declaration: a `pref.*` call or a `kind: 'number'` literal. */
function isLeafDeclaration(node: ts.Node): boolean {
  if (ts.isCallExpression(node)) return /^pref\.\w+$/.test(node.expression.getText());
  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.some((p) => ts.isPropertyAssignment(p) && p.name.getText() === 'kind' && p.initializer.getText() === "'number'");
  }
  return false;
}

/** The numbers in `file` outside a params leaf, and outside a constant a leaf reads, by their text. */
function strayNumbers(file: string): Map<string, number> {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const inLeaves = new Set<string>();
  const leafNumbers = new Set<ts.Node>();
  const constants = new Map<string, ts.Node[]>();
  const visit = (node: ts.Node, inLeaf: boolean): void => {
    const leaf = inLeaf || isLeafDeclaration(node);
    if (leaf && ts.isIdentifier(node)) inLeaves.add(node.text);
    if (leaf && ts.isNumericLiteral(node)) leafNumbers.add(node);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const found: ts.Node[] = [];
      const collect = (n: ts.Node): void => { if (ts.isNumericLiteral(n)) found.push(n); else ts.forEachChild(n, collect); };
      collect(node.initializer);
      if (found.length > 0) constants.set(node.name.text, found);
    }
    ts.forEachChild(node, (child) => visit(child, leaf));
  };
  visit(source, false);
  for (const [name, nodes] of constants) if (inLeaves.has(name)) nodes.forEach((n) => leafNumbers.add(n));
  const out = new Map<string, number>();
  const count = (node: ts.Node): void => {
    if (ts.isNumericLiteral(node) && !TRIVIAL.has(node.text) && !leafNumbers.has(node)) out.set(node.text, (out.get(node.text) ?? 0) + 1);
    ts.forEachChild(node, count);
  };
  count(source);
  return out;
}

describe('the sources of every bundled action', () => {
  const files = ['packages', 'apps/draw/src', 'apps/chart/src']
    .flatMap((dir) => (dir === 'packages'
      ? readdirSync(join(ROOT, dir)).map((p) => join(ROOT, dir, p, 'src')).filter((p) => { try { return statSync(p).isDirectory(); } catch { return false; } })
      : [join(ROOT, dir)]))
    .flatMap(sources)
    .filter((f) => DEFINES_ACTION.test(readFileSync(f, 'utf8')));

  it('state no number outside a params leaf that the allowlist does not explain', () => {
    expect(files.length).toBeGreaterThan(100);
    const stray: string[] = [];
    for (const file of files) {
      const at = relative(ROOT, file);
      const allowed = ACTION_LITERALS[at] ?? {};
      for (const text of strayNumbers(file).keys()) if (!(text in allowed)) stray.push(`${at}: ${text}`);
    }
    expect(stray).toEqual([]);
  });

  it('keep no allowlist entry for a number its file no longer holds', () => {
    const stale: string[] = [];
    for (const [at, entries] of Object.entries(ACTION_LITERALS)) {
      const file = join(ROOT, at);
      const found = files.includes(file) ? strayNumbers(file) : new Map<string, number>();
      for (const text of Object.keys(entries)) if (!found.has(text)) stale.push(`${at}: ${text}`);
    }
    expect(stale).toEqual([]);
  });
});
