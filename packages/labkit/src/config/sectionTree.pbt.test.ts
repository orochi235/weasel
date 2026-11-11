/**
 * Property test of `sectionTree`, the rail's rearrangement of a resolved schema: each leaf the panel shows sits in
 * it exactly once, at a rail path `pathAt` maps back to its config path, with its config value at that rail path in
 * `values`, and no leaf the panel hides is there.
 */
import { isPrefLeaf, type PrefGroup } from '@weasel-js/prefs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  FLAGS,
  flagShape,
  leavesOf,
  type NodeSpec,
  own,
  runs,
  shapeOf,
  shapeSpec,
  tally,
  timeoutFor,
} from '../pbt.fixture';
import { f } from './builder';
import { valueAtPath } from './path';
import { resolveConfigSchema } from './resolve';
import { sectionTree } from './sectionTree';
import { isLeafVisible } from './visible';

const RUNS = 100;

const schemaOf = (spec: [string, NodeSpec][]) =>
  f.schema(own([...Object.entries(flagShape()), ...Object.entries(shapeOf(spec))]));

/** Every leaf of `group` by its rail path. */
function railLeaves(group: PrefGroup, at = ''): string[] {
  return Object.entries(group.children).flatMap(([k, child]) => {
    const p = at === '' ? k : `${at}.${k}`;
    return isPrefLeaf(child) ? [p] : railLeaves(child, p);
  });
}

describe('sectionTree', () => {
  it(
    'holds each shown leaf once, where pathAt maps it home, beside its value',
    () => {
      const t = tally();
      const flags = fc.tuple(...FLAGS.map(() => fc.boolean()));
      fc.assert(
        fc.property(shapeSpec, flags, fc.boolean(), (spec, set, showHidden) => {
          const schema = schemaOf(spec);
          const resolved = resolveConfigSchema(schema);
          const config = own<unknown>([
            ...Object.entries(schema.defaults()),
            ...FLAGS.map((k, i) => [k, set[i]] as const),
          ]);
          const tree = sectionTree(resolved, config, showHidden);
          const rail = railLeaves(tree.group);
          const home = rail.map((r) => [r, tree.pathAt(r)] as const);
          const all = [...FLAGS, ...leavesOf(spec).map((l) => l.path)];
          const shown = all.filter((p) => {
            const steps = p.split('.');
            return steps.every((_, i) =>
              isLeafVisible(resolved, steps.slice(0, i + 1).join('.'), config, showHidden),
            );
          });
          expect(home.map(([, p]) => p).sort()).toEqual([...shown].sort());
          for (const [r, p] of home)
            expect(valueAtPath(tree.values, r)).toEqual(valueAtPath(config, p));
          if (resolved.sections.some((s) => s.at === '')) t.count('root sections');
          if (resolved.sections.some((s) => s.at !== '')) t.count('nested sections');
          if (shown.length < all.length) t.count('some hidden');
        }),
        runs(RUNS),
      );
      t.atLeast('root sections', 30);
      t.atLeast('nested sections', 10);
      t.atLeast('some hidden', 30);
    },
    timeoutFor(RUNS, 40),
  );
});
