/**
 * Property tests of a schema built with `f`: its defaults and its resolved tree hold every node at the path its
 * keys name, a trip through `prefsFromConfig` and `f.prefs` resolves to the schema it left, and visibility and
 * enablement match a brute-force reading of every condition above a node. Keys every object inherits are drawn
 * as often as ordinary ones.
 */
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  FLAGS,
  flagShape,
  groupsOf,
  holds,
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
import { configFromPrefs } from './fromPrefs';
import { hasConfigPath, schemaNodeAtPath, valueAtPath } from './path';
import { resolveConfigSchema } from './resolve';
import { prefsFromConfig } from './toPrefs';
import type { ResolvedConfig } from './types';
import { isLeafEnabled, isLeafVisible } from './visible';

const RUNS = 100;

const schemaOf = (spec: [string, NodeSpec][]) =>
  f.schema(own([...Object.entries(flagShape()), ...Object.entries(shapeOf(spec))]));

/** `resolved`'s sections grouped by where they stand, in their order there. */
const sectionsByAt = (resolved: ResolvedConfig) => {
  const out = new Map<string, unknown[]>();
  for (const s of resolved.sections) out.set(s.at, [...(out.get(s.at) ?? []), s]);
  return [...out].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
};

describe('a schema built with f', () => {
  it(
    'holds each leaf’s default at its path, and resolves each node there',
    () => {
      const t = tally();
      fc.assert(
        fc.property(shapeSpec, (spec) => {
          const schema = schemaOf(spec);
          const defaults = schema.defaults();
          const resolved = resolveConfigSchema(schema);
          for (const { path, leaf } of leavesOf(spec)) {
            if (path.split('.').includes('__proto__')) t.count('under __proto__');
            expect(hasConfigPath(defaults, path)).toBe(true);
            expect(valueAtPath(defaults, path)).toEqual(leaf.default);
            const node = schemaNodeAtPath(resolved.group, path) as PrefLeaf | undefined;
            expect(node?.kind).toBe(leaf.kind === 'list' ? 'list' : leaf.kind);
            expect(node?.default).toEqual(leaf.default);
            expect(node?.hidden ?? false).toBe(leaf.hidden ?? false);
            if (leaf.label !== undefined) expect(node?.name).toBe(leaf.label);
          }
          for (const { path, group } of groupsOf(spec)) {
            const node = schemaNodeAtPath(resolved.group, path) as PrefGroup | undefined;
            expect(node && 'children' in node).toBe(true);
            expect(Object.keys(node?.children ?? {}).sort()).toEqual(
              group.children.map(([k]) => k).sort(),
            );
            expect(resolved.resettable?.has(path)).toBe(group.resettable ?? false);
          }
          expect(Object.keys(resolved.group.children).sort()).toEqual(
            [...FLAGS, ...spec.map(([k]) => k)].sort(),
          );
        }),
        runs(RUNS),
      );
      t.atLeast('under __proto__', 30);
    },
    timeoutFor(RUNS, 20),
  );

  it(
    'reads back through prefsFromConfig and f.prefs as the schema it came from',
    () => {
      const t = tally();
      fc.assert(
        fc.property(shapeSpec, (spec) => {
          const schema = schemaOf(spec);
          const resolved = resolveConfigSchema(schema);
          const back = configFromPrefs(prefsFromConfig(resolved));
          const again = resolveConfigSchema(back);
          expect(again.group).toEqual(resolved.group);
          expect(sectionsByAt(again)).toEqual(sectionsByAt(resolved));
          expect([...again.showIf].sort()).toEqual([...resolved.showIf].sort());
          expect([...(again.enableIf ?? [])].sort()).toEqual([...(resolved.enableIf ?? [])].sort());
          expect(again.resettable).toEqual(resolved.resettable);
          expect(back.defaults()).toEqual(schema.defaults());
          if (resolved.sections.length > 0) t.count('sectioned');
          if (groupsOf(spec).length > 0) t.count('grouped');
        }),
        runs(RUNS),
      );
      t.atLeast('sectioned', 30);
      t.atLeast('grouped', 30);
    },
    timeoutFor(RUNS, 30),
  );

  it(
    'shows and enables a node exactly when every condition on it and on each group above it holds',
    () => {
      const t = tally();
      const flags = fc.tuple(...FLAGS.map(() => fc.boolean()));
      fc.assert(
        fc.property(shapeSpec, flags, fc.boolean(), (spec, set, showHidden) => {
          const resolved = resolveConfigSchema(schemaOf(spec));
          const config = own<unknown>([
            ...Object.entries(schemaOf(spec).defaults()),
            ...FLAGS.map((k, i) => [k, set[i]] as const),
          ]);
          for (const { path, leaf, above } of leavesOf(spec)) {
            const chain = [...above, leaf];
            const shown =
              (showHidden || !leaf.hidden) &&
              chain.every((n) => n.show === undefined || holds(n.show, config));
            const enabled = chain.every((n) => n.enable === undefined || holds(n.enable, config));
            t.count(shown ? 'shown' : 'not shown');
            t.count(enabled ? 'enabled' : 'disabled');
            if (above.some((g) => g.show && !holds(g.show, config))) t.count('hidden by a group');
            expect(isLeafVisible(resolved, path, config, showHidden)).toBe(shown);
            expect(isLeafEnabled(resolved, path, config)).toBe(enabled);
          }
        }),
        runs(RUNS),
      );
      for (const what of ['shown', 'not shown', 'enabled', 'disabled', 'hidden by a group'])
        t.atLeast(what, 30);
    },
    timeoutFor(RUNS, 40),
  );
});
