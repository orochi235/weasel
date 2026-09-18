# Auto (unpinned) controls — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A labkit control can be shift-clicked to *auto* — the reader stops pinning a value and the instrument decides — with the control drawing ghosted at the resolved value.

**Architecture:** `auto` is a unique symbol accepted anywhere a config value is written, normalized at the store boundary into a per-trial set of unpinned paths. A schema leaf may attach a resolver with `.auto(fn)`; `resolveAutoConfig` turns the raw config plus that set into the config the instrument reads. `@weasel-js/ui` rows gain `auto` / `onAutoChange` props and the ghosted styling; labkit owns every bit of the state.

**Tech Stack:** TypeScript, React 19, zustand (labkit store), vitest (`labkit` and `weasel-ui` projects), Storybook for the visual check, CSS modules (weasel-ui) and Less (labkit).

**Spec:** `docs/superpowers/specs/2026-09-17-auto-controls-design.md`

**Branch:** `auto-controls`, in the worktree `/Users/mike/src/weasel-auto-controls`. Every path below is relative to that worktree.

---

## Orientation for someone new to this repo

Read these before Task 1. They are short and everything downstream assumes them.

- **The schema builder** is `packages/labkit/src/config/builder.ts`. `f.number(12)` makes a `NumberNode extends BaseNode<number>`. Every chaining method clones (`this.ann(...)` for display annotations, `this.opt(...)` for `NodeOptions`) so a node can be reused as a base without bleeding into the next leaf.
- **Resolution** is `packages/labkit/src/config/resolve.ts`. It walks the builder tree into a `PrefGroup` of `PrefLeaf`s — the vocabulary `@weasel-js/ui` renders — collecting sections, `showIf` predicates and per-node renderers on the side into a `ResolvedConfig`. Extra keys on a leaf survive at runtime; `ControlPanel` reads them back with its local `extra<T>(leaf, key)` helper.
- **Values** live in the zustand store, `packages/labkit/src/state/store.ts`, one `TrialRecord` per trial. `updateTrialConfig(id, path, value)` writes by dotted path through `withValueAtPath`.
- **Rows** are `@weasel-js/ui`'s `PropertyRow` and friends, all in `packages/ui/src/components/Properties/PropertyPanel.tsx` with styles in `Properties.module.css`. **`PropertyRow` renders a `<label>`** — that single fact drives the whole gesture design.

**Test commands** (run from the worktree root, never from inside a package):

- labkit: `npx vitest run --project=labkit`
- weasel-ui: `npx vitest run --project=weasel-ui`
- one file: `npx vitest run --project=labkit packages/labkit/src/config/autoConfig.test.ts`
- typecheck: `npx tsc --noEmit` **from the root**. Running `tsc -p packages/core/tsconfig.json` exits 1 with 31 pre-existing `TS6059` errors on a clean tree; those are not yours.

**Committing:** run `npx biome check --write <files>` before each commit. Commit subjects are imperative present tense, written for someone with no session context.

---

## File structure

**Create**

| Path | Responsibility |
|---|---|
| `packages/labkit/src/config/auto.ts` | The `auto` symbol, its type, and `isAuto`. Nothing else, so every layer can import it without pulling in the builder. |
| `packages/labkit/src/config/auto.test.ts` | Tests for the above. |
| `packages/labkit/src/config/autoConfig.ts` | `autoPathsOf(schema)` and `resolveAutoConfig(...)` — pure functions over a schema, a raw config and a path set. |
| `packages/labkit/src/config/autoConfig.test.ts` | Tests for the above. |
| `packages/labkit/src/config/useResolvedConfig.ts` | The hook both `Trial` and `useTrialState` use, so resolution happens in exactly one place. |
| `packages/ui/src/components/Properties/PinDot.tsx` | The pin/auto affordance button. Its own file because it is the only new *element* in the row and it carries its own a11y contract. |
| `packages/ui/src/components/Properties/PinDot.test.tsx` | Tests for the above. |
| `packages/labkit/src/controls/AutoControls.stories.tsx` | The browser-only check for the ghost and the desaturation. |
| `.changeset/auto-controls.md` | Release note. |

**Modify**

| Path | Change |
|---|---|
| `packages/labkit/src/config/types.ts` | `NodeOptions` grows `autoResolve`, `unpinned`, `manual`. |
| `packages/labkit/src/config/builder.ts` | `BaseNode` grows `.auto()`, `.initial()`, `.manual()`. |
| `packages/labkit/src/config/resolve.ts` | Reject manual-plus-unpinned; carry the three onto the resolved leaf. |
| `packages/labkit/src/config/index.ts`, `packages/labkit/src/index.ts` | Export the new surface. |
| `packages/labkit/src/state/types.ts` | `TrialRecord.auto`; `TrialStateHandle` grows `raw` and `auto`; `setConfig` widens. |
| `packages/labkit/src/state/store.ts` | Normalize the sentinel in `updateTrialConfig`; seed `auto` in `addTrial`. |
| `packages/labkit/src/state/useTrialState.ts` | Return the resolved config, plus `raw` and `auto`. |
| `packages/labkit/src/trial/Trial.tsx` | Instrument reads resolved; `ControlPanel` reads raw. |
| `packages/ui/src/components/Properties/PropertyPanel.tsx` | `auto` / `onAutoChange` on `PropertyRow` and the seven row kinds. |
| `packages/ui/src/components/Properties/Properties.module.css` | `.pin`, `.pinAuto`, `.rowAuto` and the muted accent. |
| `packages/labkit/src/controls/ControlPanel.tsx` | Per-row wiring and the shift-click gesture. |
| `docs/extending.md` | Document the feature where the config schema is documented. |

---

## Task 1: The `auto` sentinel

**Files:**
- Create: `packages/labkit/src/config/auto.ts`
- Create: `packages/labkit/src/config/auto.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/labkit/src/config/auto.test.ts
import { describe, expect, it } from 'vitest';
import { auto, isAuto } from './auto';

describe('auto', () => {
  it('is a symbol distinct from every ordinary config value', () => {
    expect(typeof auto).toBe('symbol');
    expect(isAuto(auto)).toBe(true);
    for (const v of [undefined, null, 0, '', 'auto', false, Symbol('auto'), {}]) {
      expect(isAuto(v)).toBe(false);
    }
  });

  it('cannot cross a structured-clone boundary', () => {
    // Which is exactly why it can never end up in a serialized trial by
    // accident: the store strips it long before anything tries.
    expect(() => structuredClone({ gap: auto })).toThrow();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=labkit packages/labkit/src/config/auto.test.ts`

Expected: FAIL — `Failed to resolve import "./auto"`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/labkit/src/config/auto.ts

/**
 * Written at a config path to mean "do not pin this — let the instrument
 * decide". Accepted by `setConfig`, by a trial's `configSeed`, and by
 * `.initial()` in a schema. It is normalized into the trial's set of unpinned
 * paths on the way into the store and is never itself stored, so a serialized
 * trial contains no sentinel and the last pinned value survives.
 */
export const auto: unique symbol = Symbol('weasel.auto');

/** The type of the `auto` sentinel, for widening a value parameter. */
export type Auto = typeof auto;

export function isAuto(value: unknown): value is Auto {
  return value === auto;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run --project=labkit packages/labkit/src/config/auto.test.ts`

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
npx biome check --write packages/labkit/src/config/auto.ts packages/labkit/src/config/auto.test.ts
git add packages/labkit/src/config/auto.ts packages/labkit/src/config/auto.test.ts
git commit -m "add the auto sentinel for unpinned config values"
```

---

## Task 2: Builder calls — `.auto()`, `.initial()`, `.manual()`

**Files:**
- Modify: `packages/labkit/src/config/types.ts` (the `NodeOptions` interface)
- Modify: `packages/labkit/src/config/builder.ts` (`BaseNode`)
- Test: `packages/labkit/src/config/builder.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/labkit/src/config/builder.test.ts`, adding `import { auto } from './auto';` to its imports:

```ts
describe('auto on a node', () => {
  it('attaches a resolver without changing the default', () => {
    const n = f.number(12).auto((c) => (c.width as number) / 24);
    expect(n.default).toBe(12);
    expect(n.options.autoResolve?.({ width: 432 })).toBe(18);
  });

  it('.initial(auto) marks the node as starting unpinned', () => {
    expect(f.number(3).initial(auto).options.unpinned).toBe(true);
    expect(f.number(3).options.unpinned).toBeUndefined();
  });

  it('.manual() opts the node out of ever being auto', () => {
    expect(f.number(1).manual().options.manual).toBe(true);
  });

  it('clones rather than mutating, like every other chaining method', () => {
    const base = f.number(3);
    const unpinned = base.initial(auto);
    expect(base.options.unpinned).toBeUndefined();
    expect(unpinned).not.toBe(base);
  });

  it('keeps the subclass, so kind-specific methods still chain after', () => {
    const n = f.number(3).initial(auto).range(0, 10).suffix('px');
    expect(n.annotations.min).toBe(0);
    expect(n.annotations.suffix).toBe('px');
    expect(n.options.unpinned).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=labkit packages/labkit/src/config/builder.test.ts`

Expected: FAIL — `n.auto is not a function`.

- [ ] **Step 3: Add the option fields**

In `packages/labkit/src/config/types.ts`, inside `export interface NodeOptions extends BranchOptions {`, add:

```ts
  /** Computes this leaf's value while it is auto. Attaching one is what lets
   *  the ghosted control draw a real value and keeps the instrument off
   *  `?? compute()`. */
  autoResolve?: (config: Record<string, unknown>) => unknown;
  /** The leaf starts auto rather than pinned at its default. Set by
   *  `.initial(auto)`. */
  unpinned?: boolean;
  /** The leaf can never be auto: the row takes no pin dot and ignores the
   *  gesture. For a value the instrument cannot receive as `undefined`. */
  manual?: boolean;
```

- [ ] **Step 4: Add the builder methods**

In `packages/labkit/src/config/builder.ts`, add `import { type Auto, isAuto } from './auto';` at the top, and these three methods to `BaseNode<T>`, after `render()`:

```ts
  /**
   * Compute this leaf's value while it is auto, instead of leaving it
   * `undefined`. The resolver is given the config with every other auto path
   * already resolved.
   */
  auto(resolve: (config: Record<string, unknown>) => T): this {
    return this.opt({ autoResolve: resolve as (c: Record<string, unknown>) => unknown });
  }

  /**
   * Start this leaf auto rather than pinned at its default. Takes `auto` and
   * nothing else — the constructor argument already declares the value, and a
   * second way to say it would fight with the first.
   */
  initial(value: Auto): this {
    if (!isAuto(value)) throw new Error('[labkit] .initial() takes `auto` and nothing else');
    return this.opt({ unpinned: true });
  }

  /** Never auto. The row takes no pin dot and ignores the gesture. */
  manual(): this {
    return this.opt({ manual: true });
  }
```

- [ ] **Step 5: Run it and watch it pass**

Run: `npx vitest run --project=labkit packages/labkit/src/config/builder.test.ts`

Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 7: Commit**

```bash
npx biome check --write packages/labkit/src/config/builder.ts packages/labkit/src/config/types.ts packages/labkit/src/config/builder.test.ts
git add packages/labkit/src/config/builder.ts packages/labkit/src/config/types.ts packages/labkit/src/config/builder.test.ts
git commit -m "add auto, initial and manual to the config builder"
```

---

## Task 3: Reject `.initial(auto)` on a `.manual()` field

**Files:**
- Modify: `packages/labkit/src/config/resolve.ts`
- Test: `packages/labkit/src/config/resolve.test.ts`

The two say opposite things, so a schema carrying both is a bug the author should hear about at resolve time, not a precedence puzzle.

- [ ] **Step 1: Write the failing test**

Append to `packages/labkit/src/config/resolve.test.ts`, adding `import { auto } from './auto';`:

```ts
it('rejects a leaf that is both manual and starts auto', () => {
  const schema = f.schema({ seed: f.number(1).manual().initial(auto) });
  expect(() => resolveConfigSchema(schema)).toThrow(/seed/);
  expect(() => resolveConfigSchema(schema)).toThrow(/manual/);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=labkit packages/labkit/src/config/resolve.test.ts`

Expected: FAIL — "expected function to throw an error, but it didn't".

- [ ] **Step 3: Implement**

In `packages/labkit/src/config/resolve.ts`, in `resolveEntry`, immediately after the `isConfigBranch(entry)` block (so the entry is known to be a leaf):

```ts
  if (entry.options.manual && entry.options.unpinned) {
    throw new Error(
      `[labkit] "${path}" is both .manual() and .initial(auto) — a field that can never be auto cannot start auto`,
    );
  }
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run --project=labkit packages/labkit/src/config/resolve.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx biome check --write packages/labkit/src/config/resolve.ts packages/labkit/src/config/resolve.test.ts
git add packages/labkit/src/config/resolve.ts packages/labkit/src/config/resolve.test.ts
git commit -m "reject a config leaf that is both manual and initially auto"
```

---

## Task 4: Carry the auto fields onto the resolved leaf

**Files:**
- Modify: `packages/labkit/src/config/resolve.ts`
- Test: `packages/labkit/src/config/resolve.test.ts`

`ControlPanel` reads a leaf, not a builder node, so the three have to survive the walk. They ride as extra keys, the way labkit's other non-`PrefLeaf` extras do.

- [ ] **Step 1: Write the failing test**

Append to `packages/labkit/src/config/resolve.test.ts`:

```ts
it('carries autoResolve, unpinned and manual onto the resolved leaf', () => {
  const resolved = resolveConfigSchema(
    f.schema({
      gap: f.number(12).auto(() => 18),
      cols: f.number(3).initial(auto),
      seed: f.number(1).manual(),
      plain: f.number(0),
    }),
  );
  const leaf = (k: string) => resolved.group.children[k] as Record<string, unknown>;
  expect(typeof leaf('gap').autoResolve).toBe('function');
  expect(leaf('cols').unpinned).toBe(true);
  expect(leaf('seed').manual).toBe(true);
  expect(leaf('plain').autoResolve).toBeUndefined();
  expect(leaf('plain').unpinned).toBeUndefined();
  expect(leaf('plain').manual).toBeUndefined();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=labkit packages/labkit/src/config/resolve.test.ts`

Expected: FAIL — `expected undefined to be 'function'`.

- [ ] **Step 3: Implement**

In `packages/labkit/src/config/resolve.ts`, change the final return of `resolveEntry` from:

```ts
  return { ...patch, default: entry.default } as PrefLeaf;
```

to:

```ts
  const { autoResolve, unpinned, manual } = entry.options;
  return {
    ...patch,
    default: entry.default,
    // Extra keys survive onto the leaf at runtime; `ControlPanel` reads them
    // back with its `extra<T>` helper, the same as `min`, `step` and the rest.
    ...(autoResolve ? { autoResolve } : {}),
    ...(unpinned ? { unpinned } : {}),
    ...(manual ? { manual } : {}),
  } as PrefLeaf;
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run --project=labkit packages/labkit/src/config/resolve.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx biome check --write packages/labkit/src/config/resolve.ts packages/labkit/src/config/resolve.test.ts
git add packages/labkit/src/config/resolve.ts packages/labkit/src/config/resolve.test.ts
git commit -m "carry the auto fields onto a resolved config leaf"
```

---

## Task 5: `autoPathsOf` and `resolveAutoConfig`

**Files:**
- Create: `packages/labkit/src/config/autoConfig.ts`
- Create: `packages/labkit/src/config/autoConfig.test.ts`

The two pure functions everything else is built on. `autoPathsOf` reads the schema for the paths that *start* auto; `resolveAutoConfig` turns a raw config plus a set of unpinned paths into what the instrument reads.

- [ ] **Step 1: Write the failing test**

```ts
// packages/labkit/src/config/autoConfig.test.ts
import { describe, expect, it } from 'vitest';
import { auto } from './auto';
import { autoPathsOf, resolveAutoConfig } from './autoConfig';
import { f } from './builder';
import { resolveConfigSchema } from './resolve';

const schema = f.schema({
  width: f.number(432),
  gap: f.number(12).auto((c) => (c.width as number) / 24),
  cols: f.number(3).initial(auto),
  grid: f.group({ size: f.number(8).auto(() => 99) }),
});
const resolved = resolveConfigSchema(schema);
const raw = { width: 432, gap: 12, cols: 3, grid: { size: 8 } };

describe('autoPathsOf', () => {
  it('lists the dotted paths a schema starts auto', () => {
    expect(autoPathsOf(resolved)).toEqual(['cols']);
  });

  it('reaches leaves nested under a group', () => {
    const nested = resolveConfigSchema(
      f.schema({ grid: f.group({ size: f.number(8).initial(auto) }) }),
    );
    expect(autoPathsOf(nested)).toEqual(['grid.size']);
  });
});

describe('resolveAutoConfig', () => {
  it('leaves a config with nothing auto exactly as it was', () => {
    expect(resolveAutoConfig(resolved, raw, new Set())).toEqual(raw);
  });

  it('replaces an auto path that has a resolver with the computed value', () => {
    const out = resolveAutoConfig(resolved, raw, new Set(['gap']));
    expect(out.gap).toBe(18);
    expect(out.width).toBe(432);
  });

  it('deletes an auto path that has no resolver', () => {
    const out = resolveAutoConfig(resolved, raw, new Set(['cols'])) as Record<string, unknown>;
    expect('cols' in out).toBe(false);
  });

  it('resolves a leaf nested under a group', () => {
    const out = resolveAutoConfig(resolved, raw, new Set(['grid.size'])) as {
      grid: { size: number };
    };
    expect(out.grid.size).toBe(99);
  });

  it('lets one resolver read another auto path, already resolved', () => {
    const chained = resolveConfigSchema(
      f.schema({
        a: f.number(1).auto(() => 10),
        b: f.number(2).auto((c) => (c.a as number) * 3),
      }),
    );
    const out = resolveAutoConfig(chained, { a: 1, b: 2 }, new Set(['a', 'b'])) as {
      a: number;
      b: number;
    };
    expect(out).toEqual({ a: 10, b: 30 });
  });

  it('resolves a dependency declared after its dependent', () => {
    const backward = resolveConfigSchema(
      f.schema({
        b: f.number(2).auto((c) => (c.a as number) * 3),
        a: f.number(1).auto(() => 10),
      }),
    );
    const out = resolveAutoConfig(backward, { a: 1, b: 2 }, new Set(['a', 'b'])) as {
      a: number;
      b: number;
    };
    expect(out).toEqual({ a: 10, b: 30 });
  });

  it('throws naming the path when resolvers cycle', () => {
    const cyclic = resolveConfigSchema(
      f.schema({
        a: f.number(1).auto((c) => (c.b as number) + 1),
        b: f.number(2).auto((c) => (c.a as number) + 1),
      }),
    );
    expect(() => resolveAutoConfig(cyclic, { a: 1, b: 2 }, new Set(['a', 'b']))).toThrow(/cycle/i);
    expect(() => resolveAutoConfig(cyclic, { a: 1, b: 2 }, new Set(['a', 'b']))).toThrow(/"a"/);
  });

  it('throws on a resolver that reads its own path', () => {
    const selfish = resolveConfigSchema(
      f.schema({ a: f.number(1).auto((c) => (c.a as number) + 1) }),
    );
    expect(() => resolveAutoConfig(selfish, { a: 1 }, new Set(['a']))).toThrow(/cycle/i);
  });

  it('ignores an auto path the schema does not have', () => {
    expect(resolveAutoConfig(resolved, raw, new Set(['gone']))).toEqual(raw);
  });

  it('does not mutate the config it was given', () => {
    const before = structuredClone(raw);
    resolveAutoConfig(resolved, raw, new Set(['gap', 'grid.size']));
    expect(raw).toEqual(before);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=labkit packages/labkit/src/config/autoConfig.test.ts`

Expected: FAIL — `Failed to resolve import "./autoConfig"`.

- [ ] **Step 3: Implement**

Resolution is **demand-driven**, not a flat pass. Two of the tests above force this: a dependency declared after its dependent, and a cycle. A flat loop in schema order gets the first one wrong (it reads a dropped path as `undefined`) and cannot detect the second at all.

```ts
// packages/labkit/src/config/autoConfig.ts
import { isPrefLeaf, type PrefGroup, type PrefLeaf } from '@weasel-js/ui';
import { withValueAtPath } from './path';
import type { ResolvedConfig } from './types';

type Resolver = (config: Record<string, unknown>) => unknown;

/** Reads a labkit-only extra off a resolved leaf. `PrefLeaf` has no field for
 *  these; they ride as extra keys and survive the resolve walk. */
function extra<T>(leaf: PrefLeaf, key: string): T | undefined {
  return (leaf as unknown as Record<string, T | undefined>)[key];
}

/** Every leaf in a resolved schema, in schema order, with its dotted path. */
function* leaves(group: PrefGroup, at = ''): Generator<[string, PrefLeaf]> {
  for (const [key, child] of Object.entries(group.children)) {
    const path = at === '' ? key : `${at}.${key}`;
    if (isPrefLeaf(child)) yield [path, child];
    else yield* leaves(child, path);
  }
}

/** The dotted paths a schema declares as starting auto — every leaf that said
 *  `.initial(auto)`. This is what seeds a new trial's unpinned set. */
export function autoPathsOf(resolved: ResolvedConfig): string[] {
  const out: string[] = [];
  for (const [path, leaf] of leaves(resolved.group)) {
    if (extra<boolean>(leaf, 'unpinned')) out.push(path);
  }
  return out;
}

/**
 * The config an instrument reads: the stored one, with every unpinned path
 * either computed by its resolver or removed.
 *
 * Resolution is demand-driven — a resolver reading another unpinned path
 * forces that one first, whatever order the schema declared them in — so a
 * cycle is a real cycle and not an ordering accident.
 */
export function resolveAutoConfig<TC>(
  resolved: ResolvedConfig,
  config: TC,
  autoPaths: ReadonlySet<string>,
): TC {
  if (autoPaths.size === 0) return config;

  const resolvers = new Map<string, Resolver | undefined>();
  for (const [path, leaf] of leaves(resolved.group)) {
    if (autoPaths.has(path)) resolvers.set(path, extra<Resolver>(leaf, 'autoResolve'));
  }
  if (resolvers.size === 0) return config;

  // Drop first, so a resolver reading a still-unresolved auto path sees
  // `undefined` rather than a stale pinned value it would silently believe.
  let out = config as unknown as Record<string, unknown>;
  for (const path of resolvers.keys()) out = dropAtPath(out, path);

  const inFlight = new Set<string>();
  const done = new Set<string>();

  const need = (path: string): void => {
    if (done.has(path)) return;
    if (inFlight.has(path)) {
      throw new Error(`[labkit] auto resolver cycle at "${path}"`);
    }
    const resolve = resolvers.get(path);
    if (!resolve) {
      done.add(path);
      return;
    }
    inFlight.add(path);
    try {
      out = withValueAtPath(out, path, resolve(demand(() => out, resolvers, need)));
    } finally {
      inFlight.delete(path);
    }
    done.add(path);
  };

  for (const path of resolvers.keys()) need(path);
  return out as unknown as TC;
}

/**
 * The config a resolver reads. A top-level key that is itself unpinned is
 * forced before it is handed back, which is what makes declaration order
 * irrelevant and turns a genuine loop into a named error.
 *
 * Only top-level keys are trapped: a resolver reaching `c.grid.size` gets the
 * already-dropped branch, and a nested auto path it depends on resolves by
 * schema order alone. Declare a dependency at the root if it has to be
 * ordered.
 */
function demand(
  read: () => Record<string, unknown>,
  resolvers: ReadonlyMap<string, Resolver | undefined>,
  need: (path: string) => void,
): Record<string, unknown> {
  return new Proxy(read(), {
    get(_target, key) {
      if (typeof key === 'string' && resolvers.has(key)) need(key);
      return Reflect.get(read(), key);
    },
    has(_target, key) {
      return Reflect.has(read(), key);
    },
    ownKeys() {
      return Reflect.ownKeys(read());
    },
    getOwnPropertyDescriptor(_target, key) {
      return Reflect.getOwnPropertyDescriptor(read(), key);
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A copy of `config` with the dotted path removed, copying every record on
 *  the way down. A path that is not there comes back unchanged. */
function dropAtPath(config: Record<string, unknown>, path: string): Record<string, unknown> {
  const [head, ...rest] = path.split('.');
  if (head === undefined || !(head in config)) return config;
  if (rest.length === 0) {
    const { [head]: _dropped, ...kept } = config;
    return kept;
  }
  const child = config[head];
  if (!isRecord(child)) return config;
  return { ...config, [head]: dropAtPath(child, rest.join('.')) };
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run --project=labkit packages/labkit/src/config/autoConfig.test.ts`

Expected: PASS, 12 tests.

- [ ] **Step 5: Prove the cycle guard is load-bearing**

Delete the `if (inFlight.has(path)) throw ...` lines and re-run. Expected: the two cycle tests fail — by hanging or by stack overflow, not by a clean assertion. Put the guard back. If they still pass, the guard is measuring nothing and the tests need fixing before you move on.

- [ ] **Step 6: Commit**

```bash
npx biome check --write packages/labkit/src/config/autoConfig.ts packages/labkit/src/config/autoConfig.test.ts
git add packages/labkit/src/config/autoConfig.ts packages/labkit/src/config/autoConfig.test.ts
git commit -m "resolve a config against its set of unpinned paths"
```

---

## Task 6: The store holds the unpinned paths

**Files:**
- Modify: `packages/labkit/src/state/types.ts`
- Modify: `packages/labkit/src/state/store.ts`
- Test: `packages/labkit/src/state/useTrialState.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `packages/labkit/src/state/useTrialState.test.tsx`, using whatever store-setup helper that file already has (read the top of the file first; `makeStore` below stands in for it):

```ts
import { auto } from '../config/auto';

describe('auto paths', () => {
  it('records a path written as auto instead of storing the sentinel', () => {
    const store = makeStore();
    const id = store.getState().trials[0].id;
    store.getState().updateTrialConfig(id, 'gap', 24);
    store.getState().updateTrialConfig(id, 'gap', auto);
    const rec = store.getState().trials[0];
    expect(rec.auto).toEqual(['gap']);
    // The last pinned value survives, so un-pinning is lossless.
    expect((rec.config as { gap: number }).gap).toBe(24);
    expect(JSON.stringify(rec.config)).not.toContain('Symbol');
  });

  it('pins again when a real value is written to an auto path', () => {
    const store = makeStore();
    const id = store.getState().trials[0].id;
    store.getState().updateTrialConfig(id, 'gap', auto);
    store.getState().updateTrialConfig(id, 'gap', 30);
    const rec = store.getState().trials[0];
    expect(rec.auto ?? []).toEqual([]);
    expect((rec.config as { gap: number }).gap).toBe(30);
  });

  it('does not allocate a new record when the path is already auto', () => {
    const store = makeStore();
    const id = store.getState().trials[0].id;
    store.getState().updateTrialConfig(id, 'gap', auto);
    const first = store.getState().trials[0];
    store.getState().updateTrialConfig(id, 'gap', auto);
    expect(store.getState().trials[0]).toBe(first);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=labkit packages/labkit/src/state/useTrialState.test.tsx`

Expected: FAIL — `rec.auto` is `undefined`.

- [ ] **Step 3: Add the record field**

In `packages/labkit/src/state/types.ts`, inside `TrialRecord`, after `configSeed`:

```ts
  /** Dotted paths this trial has unpinned. The value at such a path stays in
   *  `config` — it is what the field pins back to — but the instrument reads
   *  the resolver's value, or `undefined`, instead. Absent means none. */
  auto?: readonly string[];
```

- [ ] **Step 4: Normalize the sentinel in the store**

In `packages/labkit/src/state/store.ts`, add `import { isAuto } from '../config/auto';` and replace `updateTrialConfig`:

```ts
    updateTrialConfig: (id, path, value) => {
      set((s) => ({
        trials: s.trials.map((w) => {
          if (w.id !== id) return w;
          const was = w.auto ?? [];
          if (isAuto(value)) {
            // The sentinel is never stored: it becomes membership in the set,
            // and the pinned value at the path is left exactly where it is.
            if (was.includes(path)) return w;
            return { ...w, auto: [...was, path] };
          }
          const config = withValueAtPath(w.config, path, value);
          if (!was.includes(path)) return { ...w, config };
          return { ...w, config, auto: was.filter((p) => p !== path) };
        }),
      }));
    },
```

Widen the action's signature in the store's own state interface (around line 31) from `value: unknown` — it already is `unknown`, so no change is needed there; the typed narrowing lives on `TrialStateHandle.setConfig` in Task 8.

- [ ] **Step 5: Run it and watch it pass**

Run: `npx vitest run --project=labkit packages/labkit/src/state/useTrialState.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npx biome check --write packages/labkit/src/state/store.ts packages/labkit/src/state/types.ts packages/labkit/src/state/useTrialState.test.tsx
git add packages/labkit/src/state/store.ts packages/labkit/src/state/types.ts packages/labkit/src/state/useTrialState.test.tsx
git commit -m "record a trial's unpinned config paths in its store record"
```

---

## Task 7: Seed a new trial's unpinned set from its schema

**Files:**
- Modify: `packages/labkit/src/state/store.ts` (`addTrial`, and the store's options)
- Modify: `packages/labkit/src/state/types.ts` (`CreateLabStoreOptions`)
- Test: `packages/labkit/src/state/useTrialState.test.tsx`

A field declared `.initial(auto)` has to open auto, and a `configSeed` naming `auto` has to be honored the way `setConfig` is.

- [ ] **Step 1: Read `addTrial` and the schema plumbing**

```bash
grep -n "addTrial" packages/labkit/src/state/store.ts
grep -rn "configDefaults" packages/labkit/src --include=*.ts --include=*.tsx | grep -v test
```

`configDefaults` is a `Record<string, () => unknown>` the store already receives through `CreateLabStoreOptions` and populates from the instrument list. You are adding a `configSchemas: Record<string, ResolvedConfig>` **beside it, populated at exactly the same site**. Write the test below against `addTrial`'s real signature, not the sketch of one here.

- [ ] **Step 2: Write the failing test**

```ts
it('opens a trial with the schema-declared auto paths already unpinned', () => {
  // The harness instrument's schema has `cols: f.number(3).initial(auto)`.
  const store = makeStore();
  const id = store.getState().addTrial('demo');
  const rec = store.getState().trials.find((t) => t.id === id);
  expect(rec?.auto).toEqual(['cols']);
});

it('honors auto in a seed config and keeps the sentinel out of the record', () => {
  const store = makeStore();
  const id = store.getState().addTrial('demo', { gap: auto });
  const rec = store.getState().trials.find((t) => t.id === id);
  expect(rec?.auto).toContain('gap');
  expect((rec?.config as { gap: unknown }).gap).toBe(12); // the schema default
  expect(rec?.configSeed).not.toHaveProperty('gap');
});

it('honors auto at a nested seed path', () => {
  const store = makeStore();
  const id = store.getState().addTrial('demo', { grid: { size: auto } });
  expect(store.getState().trials.find((t) => t.id === id)?.auto).toContain('grid.size');
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run --project=labkit packages/labkit/src/state/useTrialState.test.tsx`

Expected: FAIL — `rec.auto` is `undefined`.

- [ ] **Step 4: Implement**

Add this helper beside the store:

```ts
/** Splits a seed config into its ordinary values and the dotted paths it wrote
 *  as `auto`, so the sentinel never reaches the record. */
function splitAutoSeed(
  seed: Record<string, unknown> | undefined,
  at = '',
): { config: Record<string, unknown>; autoPaths: string[] } {
  const config: Record<string, unknown> = {};
  const autoPaths: string[] = [];
  for (const [key, value] of Object.entries(seed ?? {})) {
    const path = at === '' ? key : `${at}.${key}`;
    if (isAuto(value)) {
      autoPaths.push(path);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const inner = splitAutoSeed(value as Record<string, unknown>, path);
      config[key] = inner.config;
      autoPaths.push(...inner.autoPaths);
    } else {
      config[key] = value;
    }
  }
  return { config, autoPaths };
}
```

In `addTrial`, before the config is composed from defaults and the seed:

```ts
      // Two sources open a trial unpinned: the schema's own `.initial(auto)`
      // leaves, and any path the seed wrote as `auto`. The seed's sentinels are
      // stripped so neither the config nor the stored seed ever holds one.
      const seeded = splitAutoSeed(seed as Record<string, unknown> | undefined);
      const schema = configSchemas[instrumentName];
      const autoPaths = [...new Set([...(schema ? autoPathsOf(schema) : []), ...seeded.autoPaths])];
```

Use `seeded.config` wherever the raw seed was used — both for composing `config` and for the stored `configSeed` — and put `auto: autoPaths.length > 0 ? autoPaths : undefined` on the new record.

- [ ] **Step 5: Run it and watch it pass**

Run: `npx vitest run --project=labkit packages/labkit/src/state/useTrialState.test.tsx`

Expected: PASS.

- [ ] **Step 6: Run the whole labkit project**

Run: `npx vitest run --project=labkit`

Expected: PASS. The labkit project was green before this branch, so anything red here is yours.

- [ ] **Step 7: Commit**

```bash
npx biome check --write packages/labkit/src/state
git add packages/labkit/src/state
git commit -m "open a trial with its schema's auto fields already unpinned"
```

---

## Task 8: `useResolvedConfig`, and `useTrialState` returning it

**Files:**
- Create: `packages/labkit/src/config/useResolvedConfig.ts`
- Modify: `packages/labkit/src/state/useTrialState.ts`
- Modify: `packages/labkit/src/state/types.ts` (`TrialStateHandle`)
- Test: `packages/labkit/src/state/useTrialState.test.tsx`

One place resolves, so `Trial` and `useTrialState` cannot drift.

- [ ] **Step 1: Write the failing test**

```ts
it('hands the instrument the resolved config and the raw one separately', () => {
  // Harness instrument schema: gap: f.number(12).auto((c) => (c.width as number) / 24)
  const { result, store, id } = renderTrialState();
  act(() => {
    store.getState().updateTrialConfig(id, 'gap', auto);
  });
  expect(result.current.config.gap).toBe(18); // resolved
  expect(result.current.raw.gap).toBe(12); // still pinned underneath
  expect([...result.current.auto]).toEqual(['gap']);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=labkit packages/labkit/src/state/useTrialState.test.tsx`

Expected: FAIL — `result.current.raw` is `undefined`.

- [ ] **Step 3: Write the hook**

```ts
// packages/labkit/src/config/useResolvedConfig.ts
import { useMemo } from 'react';
import { resolveAutoConfig } from './autoConfig';
import type { ResolvedConfig } from './types';

const NONE: ReadonlySet<string> = new Set();

/**
 * The config an instrument reads: the stored one with every unpinned path
 * resolved. The single place resolution happens, so `Trial` and
 * `useTrialState` cannot disagree about what an instrument is looking at.
 */
export function useResolvedConfig<TC>(
  schema: ResolvedConfig | undefined,
  config: TC,
  autoPaths: readonly string[] | undefined,
): { config: TC; auto: ReadonlySet<string> } {
  const auto = useMemo(
    () => (autoPaths && autoPaths.length > 0 ? new Set(autoPaths) : NONE),
    [autoPaths],
  );
  const resolvedConfig = useMemo(
    () => (schema ? resolveAutoConfig(schema, config, auto) : config),
    [schema, config, auto],
  );
  return { config: resolvedConfig, auto };
}
```

- [ ] **Step 4: Widen the handle**

In `packages/labkit/src/state/types.ts`, add `import type { Auto } from '../config/auto';` and, in `TrialStateHandle<TS, TC>`:

```ts
  /** The config as stored, before any auto path is resolved. What the control
   *  panel renders, so a ghosted control sits at the value it pins back to. */
  raw: TC;
  /** Dotted paths this trial has unpinned. */
  auto: ReadonlySet<string>;
```

and widen `setConfig`:

```ts
  setConfig: <P extends ConfigPath<TC> & string>(
    path: P,
    value: ValueAtPath<TC, P> | Auto,
  ) => void;
```

- [ ] **Step 5: Wire `useTrialState`**

```ts
  const schema = useStore(ctx.store, (s) => s.configSchemas?.[record.instrumentName]);
  const { config, auto } = useResolvedConfig(schema, record.config as TC, record.auto);

  return {
    state: record.state as TS,
    config,
    raw: record.config as TC,
    auto,
    setState: (next) => updateTrialState(trialId, next as Parameters<typeof updateTrialState>[1]),
    setConfig: (path, value) => updateTrialConfig(trialId, path, value),
  };
```

The resolved schemas reach the store as `configSchemas` in Task 7. Read them from there rather than plumbing a second context in — `useTrialState` reads `LabStoreContext`, not the `LabContext` that `useConfigSchema` needs. Hooks cannot be conditional: if there is no schema for the instrument, still call `useResolvedConfig` and pass `undefined`.

- [ ] **Step 6: Run it and watch it pass**

Run: `npx vitest run --project=labkit packages/labkit/src/state/useTrialState.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npx biome check --write packages/labkit/src/config/useResolvedConfig.ts packages/labkit/src/state
git add packages/labkit/src/config/useResolvedConfig.ts packages/labkit/src/state
git commit -m "hand an instrument the config with its auto paths resolved"
```

---

## Task 9: `Trial` resolves for the instrument, raw for the panel

**Files:**
- Modify: `packages/labkit/src/trial/Trial.tsx`
- Test: whichever Trial test file exists — `ls packages/labkit/src/trial/*.test.tsx`

`Trial` reads `record.config` in roughly a dozen places: the render context, canvas layers, the loupe, annotations, drag-drop, the job runner, the export ref. Every one of those is the instrument's view and must be the **resolved** config. The control panel is the single exception.

- [ ] **Step 1: Write the failing test**

```tsx
it('renders the instrument against the resolved config and the panel against the raw one', () => {
  // Harness instrument: schema { gap: f.number(12).auto(() => 18).range(0, 48) },
  // whose canvas layer records the gap it was drawn with.
  render(<Trial /* the file's existing props */ />);
  act(() => {
    store.getState().updateTrialConfig(id, 'gap', auto);
  });
  expect(lastDrawnGap()).toBe(18);
  expect(screen.getByLabelText('Gap')).toHaveValue('12');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=labkit packages/labkit/src/trial`

Expected: FAIL — `lastDrawnGap()` is 12.

- [ ] **Step 3: Implement**

Near the top of `Trial`, after `record` is read:

```tsx
  const schema = useConfigSchema(instrument);
  const { config, auto: autoPaths } = useResolvedConfig(schema, record.config, record.auto);
```

Then enumerate every use and replace all but the panel's:

```bash
grep -n "record\.config" packages/labkit/src/trial/Trial.tsx
```

Work that list one at a time. There is no safe sweep here — the control-panel call site looks exactly like all the others, and it is the one that must keep `record.config`. It is the `<ControlPanel …>` element; give it `config={record.config}` plus `auto={autoPaths}` from Task 13.

`configRef` (line ~203, used by export so an export draws against the config the trial holds *now*) takes the **resolved** config: an export has to look like the canvas.

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run --project=labkit packages/labkit/src/trial`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx biome check --write packages/labkit/src/trial/Trial.tsx
git add packages/labkit/src/trial
git commit -m "draw a trial's instrument against its resolved config"
```

---

## Task 10: The pin dot

**Files:**
- Create: `packages/ui/src/components/Properties/PinDot.tsx`
- Create: `packages/ui/src/components/Properties/PinDot.test.tsx`
- Modify: `packages/ui/src/components/Properties/Properties.module.css`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/ui/src/components/Properties/PinDot.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PinDot } from './PinDot';

describe('PinDot', () => {
  it('reports its state through aria-pressed', () => {
    const { rerender } = render(<PinDot auto={false} label="Gap" onChange={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    rerender(<PinDot auto label="Gap" onChange={() => {}} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('names itself after the row, so a screen reader says which field', () => {
    render(<PinDot auto={false} label="Gap" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Gap/ })).toBeInTheDocument();
  });

  it('toggles on click and on Enter', async () => {
    const onChange = vi.fn();
    render(<PinDot auto={false} label="Gap" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenCalledWith(true);
    onChange.mockClear();
    screen.getByRole('button').focus();
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('suppresses the default that would actuate the row label it sits inside', async () => {
    // A PROXY. In jsdom a <label> does not retarget a click the way a browser
    // does, so "the control did not actuate" cannot fail here. What is
    // assertable is that the default was prevented; the browser half is
    // covered by AutoControls.stories.tsx.
    render(<PinDot auto={false} label="Gap" onChange={() => {}} />);
    const btn = screen.getByRole('button');
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    btn.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Properties/PinDot.test.tsx`

Expected: FAIL — `Failed to resolve import "./PinDot"`.

- [ ] **Step 3: Implement**

```tsx
// packages/ui/src/components/Properties/PinDot.tsx
import type { ReactNode } from 'react';
import s from './Properties.module.css';

export interface PinDotProps {
  /** Whether the row is currently auto. */
  auto: boolean;
  /** The row's label, used to name the button. */
  label: ReactNode;
  onChange: (next: boolean) => void;
}

/**
 * Pinned/auto affordance for a property row. Filled means the row holds a
 * pinned value; hollow means it is auto and the owner decides.
 *
 * Invisible at rest and revealed by the row's `:hover` / `:focus-within` — so
 * tabbing to the row's control brings it into view and into reach, which is
 * the whole keyboard path for going auto.
 */
export function PinDot({ auto, label, onChange }: PinDotProps) {
  const name = typeof label === 'string' ? label : 'this setting';
  return (
    <button
      type="button"
      className={auto ? `${s.pin} ${s.pinAuto}` : s.pin}
      aria-pressed={auto}
      aria-label={`${name}: ${auto ? 'auto' : 'pinned'}`}
      onClick={(e) => {
        // The wrapping <label> would otherwise actuate the row's control.
        e.preventDefault();
        e.stopPropagation();
        onChange(!auto);
      }}
      onMouseDown={(e) => e.stopPropagation()}
    />
  );
}
```

- [ ] **Step 4: Check the token names, then add the styles**

```bash
grep -rn "wzl-motion-fast\|wzl-ease-out\|wzl-focus-ring\|wzl-fg-subtle" packages/ui/src/theme | head
```

Use the names that come back; a `var()` naming nothing silently falls back to nothing. Then append to `Properties.module.css`, beside `.help`:

```css
/* The pinned/auto affordance. Invisible at rest so a panel of thirty rows is
   not thirty dots; revealed by the row, and permanent once the row is auto. */
.pin {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--wzl-accent);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--wzl-motion-fast) var(--wzl-ease-out);
}

.row:hover .pin,
.row:focus-within .pin,
.pin:focus-visible,
.pinAuto {
  opacity: 1;
}

.pinAuto {
  background: transparent;
  box-shadow: inset 0 0 0 1.2px var(--wzl-fg-subtle);
}

.pin:focus-visible {
  outline: 2px solid var(--wzl-focus-ring);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .pin {
    transition: none;
  }
}
```

- [ ] **Step 5: Run it and watch it pass**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Properties/PinDot.test.tsx`

Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
npx biome check --write packages/ui/src/components/Properties/PinDot.tsx packages/ui/src/components/Properties/PinDot.test.tsx packages/ui/src/components/Properties/Properties.module.css
git add packages/ui/src/components/Properties
git commit -m "add the pinned/auto dot for a property row"
```

---

## Task 11: `auto` and `onAutoChange` on the rows

**Files:**
- Modify: `packages/ui/src/components/Properties/PropertyPanel.tsx`
- Modify: `packages/ui/src/components/Properties/index.ts`
- Test: `packages/ui/src/components/Properties/PropertyPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('marks an auto row and renders its dot only when it can be toggled', () => {
  const { rerender, container } = render(
    <PropertyRow label="Gap" auto onAutoChange={() => {}}>
      <input />
    </PropertyRow>,
  );
  expect(container.querySelector('label')?.className).toMatch(/rowAuto/);
  expect(screen.getByRole('button', { name: /Gap/ })).toBeInTheDocument();

  rerender(
    <PropertyRow label="Gap" auto>
      <input />
    </PropertyRow>,
  );
  expect(screen.queryByRole('button', { name: /Gap/ })).toBeNull();
});

it('shows the readout a caller gives an auto row', () => {
  render(
    <PropertyRow label="Gap" auto readout="auto · 18 px" onAutoChange={() => {}}>
      <input />
    </PropertyRow>,
  );
  expect(screen.getByText('auto · 18 px')).toBeInTheDocument();
});

it('puts the dot before the readout, so live text stays last in the row', () => {
  const { container } = render(
    <PropertyRow label="Gap" auto readout="auto · 18 px" onAutoChange={() => {}}>
      <input />
    </PropertyRow>,
  );
  const kids = [...(container.querySelector('label > span')?.children ?? [])];
  const dot = kids.findIndex((el) => el.tagName === 'BUTTON');
  const readout = kids.findIndex((el) => el.tagName === 'EM');
  expect(dot).toBeGreaterThanOrEqual(0);
  expect(dot).toBeLessThan(readout);
});
```

Then one case per row kind. Write the seven out in full against each component's real required props — read them off the signatures in `PropertyPanel.tsx`. A parameterized test with an empty body is a plan failure:

```tsx
it('SliderRow forwards auto and onAutoChange', () => {
  const { container } = render(
    <SliderRow label="Gap" value={12} min={0} max={48} onChange={() => {}} auto onAutoChange={() => {}} />,
  );
  expect(container.querySelector('label')?.className).toMatch(/rowAuto/);
  expect(screen.getByRole('button', { name: /Gap/ })).toBeInTheDocument();
});
```

…and the same shape for `NumberRow`, `SelectRow`, `ToggleRow`, `CheckboxRow`, `ColorRow`, `TextRow`.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Properties/PropertyPanel.test.tsx`

Expected: FAIL — no `rowAuto` class.

**Note on what a class assertion proves here.** The CSS-module proxy in the `weasel-ui` vitest project answers to any key, so `s.rowAuto` resolves whether or not a rule defines it. These tests prove the component asked for the class, never that it is styled. Task 12's story is what checks the rule exists.

- [ ] **Step 3: Implement on `PropertyRow`**

Add to `PropertyRowProps`:

```ts
  /** The row is auto: its value is not pinned and the owner computes it. Draws
   *  the control ghosted and colorless. */
  auto?: boolean;
  /** Given, the row carries a pin dot that toggles `auto`. Omitted, the row can
   *  show an auto state but not change it. */
  onAutoChange?: (next: boolean) => void;
  /** Marks the row's element for a panel-level gesture handler. `PropertyRow`
   *  does not spread unknown props, so this is declared rather than inherited. */
  'data-auto-path'?: string;
```

and in the body — note the explicit `data-auto-path` on the `<label>`, which is the element Task 14's handler walks up to:

```tsx
  const cls = propertyMetricClass(
    [s.row, variantClass, layoutClass, span && s.span, auto && s.rowAuto].filter(Boolean).join(' '),
    { density, align },
    className,
  );
  return (
    <label className={cls} htmlFor={htmlFor} data-auto-path={props['data-auto-path']}>
      <span className={s.rowLabel}>
        {label}
        {description ? <PropertyRowHelp label={label} description={description} /> : null}
        {onAutoChange ? <PinDot auto={auto ?? false} label={label} onChange={onAutoChange} /> : null}
        {readout != null && <em className={s.readout}>{readout}</em>}
      </span>
      {children}
    </label>
  );
```

The dot goes **before** the readout. The readout is the row's live, variable-length text, and anything placed after it reflows every time it updates.

- [ ] **Step 4: Forward from the seven rows**

`SliderRow`, `NumberRow`, `SelectRow`, `ToggleRow`, `CheckboxRow`, `ColorRow` and `TextRow` each take `auto`, `onAutoChange` and `data-auto-path` in their props and pass all three straight to the `PropertyRow` they render. Nothing else changes — the ghosting is entirely CSS off `.rowAuto`.

- [ ] **Step 5: Run it and watch it pass**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Properties/PropertyPanel.test.tsx`

Expected: PASS.

- [ ] **Step 6: Export `PinDot`'s props**

In `packages/ui/src/components/Properties/index.ts`, export `PinDot` and `type PinDotProps` alongside the other row exports.

- [ ] **Step 7: Commit**

```bash
npx biome check --write packages/ui/src/components/Properties
git add packages/ui/src/components/Properties
git commit -m "take an auto state on every property row"
```

---

## Task 12: The ghosted, colorless auto row

**Files:**
- Modify: `packages/ui/src/components/Properties/Properties.module.css`

No unit test. jsdom resolves neither `var()` nor `color-mix()`, and the CSS-module proxy answers to any key, so an assertion here would prove only that a component asked for a class. The check is the story in Task 15.

- [ ] **Step 1: Read the sheet's real token names**

```bash
grep -oE "var\(--wzl-[a-z0-9-]+" packages/ui/src/components/Properties/Properties.module.css | sort -u
```

`--wzl-track` and `--wzl-accent-hover` below are guesses at names this sheet may not have. Use the names that come back.

- [ ] **Step 2: Write the rules**

Append to `Properties.module.css`:

```css
/* An auto row: the value is not pinned, so the control draws as a ghost of
   itself and gives up its color. Accent is redefined as a custom property on
   the row rather than overridden rule by rule, so every descendant that reads
   it — fill, thumb, checkmark, focus ring — goes muted together. */
.rowAuto {
  --wzl-accent: var(--wzl-fg-subtle);
  --wzl-accent-hover: var(--wzl-fg-subtle);
}

.rowAuto > .rowLabel {
  color: var(--wzl-fg-subtle);
}

.rowAuto .readout {
  font-style: italic;
  color: var(--wzl-fg-subtle);
}

.rowAuto input[type='range'] {
  background: repeating-linear-gradient(90deg, var(--wzl-track) 0 4px, transparent 4px 7px);
}

.rowAuto input[type='range']::-webkit-slider-thumb {
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--wzl-fg-subtle);
}

.rowAuto input[type='range']::-moz-range-thumb {
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--wzl-fg-subtle);
}

.rowAuto select,
.rowAuto input[type='number'],
.rowAuto input[type='text'] {
  border-style: dashed;
  color: var(--wzl-fg-subtle);
  font-style: italic;
}
```

**One trap to avoid.** Do not chase this by adding a `var()` reference inside a custom property declared at `:root`. A `var()` inside a custom property is substituted where that property is *declared*, so a token defined once at the root bakes in the default mode's value and inherits it frozen into every other mode. Declaring `--wzl-accent` on `.rowAuto` is fine — that is a real element, where it resolves per element.

- [ ] **Step 3: Confirm nothing regressed in jsdom**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Properties`

Expected: PASS — nothing here changes behavior jsdom can observe.

- [ ] **Step 4: Commit**

```bash
npx biome check --write packages/ui/src/components/Properties/Properties.module.css
git add packages/ui/src/components/Properties/Properties.module.css
git commit -m "draw an auto property row ghosted and colorless"
```

---

## Task 13: `ControlPanel` wires the state through

**Files:**
- Modify: `packages/labkit/src/controls/ControlPanel.tsx`
- Modify: `packages/labkit/src/config/types.ts` (`ControlRenderer`)
- Test: `packages/labkit/src/controls/ControlPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { auto } from '../config/auto';

it('reads the resolver for an auto row's readout', () => {
  render(
    <ControlPanel
      schema={resolveConfigSchema(
        f.schema({ gap: f.number(12).auto(() => 18).range(0, 48) }),
      )}
      config={{ gap: 12 }}
      auto={new Set(['gap'])}
      setConfig={() => {}}
    />,
  );
  expect(screen.getByText('auto · 18')).toBeInTheDocument();
});

it('reads "auto" alone for a path with no resolver', () => {
  render(
    <ControlPanel
      schema={resolveConfigSchema(f.schema({ cols: f.number(3).range(0, 8) }))}
      config={{ cols: 3 }}
      auto={new Set(['cols'])}
      setConfig={() => {}}
    />,
  );
  expect(screen.getByText('auto')).toBeInTheDocument();
});

it('writes the sentinel when the dot turns a row auto', async () => {
  const setConfig = vi.fn();
  render(
    <ControlPanel
      schema={resolveConfigSchema(f.schema({ gap: f.number(12).range(0, 48) }))}
      config={{ gap: 12 }}
      auto={new Set()}
      setConfig={setConfig}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: /Gap/ }));
  expect(setConfig).toHaveBeenCalledWith('gap', auto);
});

it('writes the pinned value back when the dot un-autos a row', async () => {
  const setConfig = vi.fn();
  render(
    <ControlPanel
      schema={resolveConfigSchema(f.schema({ gap: f.number(12).range(0, 48) }))}
      config={{ gap: 24 }}
      auto={new Set(['gap'])}
      setConfig={setConfig}
    />,
  );
  await userEvent.click(screen.getByRole('button', { name: /Gap/ }));
  expect(setConfig).toHaveBeenCalledWith('gap', 24);
});

it('gives a manual row no dot', () => {
  render(
    <ControlPanel
      schema={resolveConfigSchema(f.schema({ seed: f.number(1).manual().range(0, 8) }))}
      config={{ seed: 1 }}
      auto={new Set()}
      setConfig={() => {}}
    />,
  );
  expect(screen.queryByRole('button', { name: /Seed/ })).toBeNull();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=labkit packages/labkit/src/controls/ControlPanel.test.tsx`

Expected: FAIL — unknown prop `auto`; no such text.

- [ ] **Step 3: Implement**

Add to `ControlPanelProps`:

```ts
  /** Dotted paths currently unpinned. A row in this set draws ghosted and its
   *  dot reads as auto. */
  auto?: ReadonlySet<string>;
```

Thread it through `node()` into `ControlRow` alongside `config`. At the top of `ControlPanel.tsx`, `import { auto as autoValue } from '../config/auto';` — aliased, because `auto` is the prop name in scope.

Inside `ControlRow`, after `value` is computed:

```tsx
  const isAutoRow = auto?.has(path) ?? false;
  const canAuto = !extra<boolean>(leaf, 'manual');
  const resolver = extra<(c: Record<string, unknown>) => unknown>(leaf, 'autoResolve');
  const onAutoChange = canAuto
    ? (next: boolean) => write(next ? autoValue : value)
    : undefined;
  // What an auto row reads instead of its number: the resolver's value where
  // there is one, and the bare word where there is not.
  const autoReadout = isAutoRow
    ? resolver
      ? `auto · ${String(resolver(config as Record<string, unknown>))}`
      : 'auto'
    : undefined;
  const autoProps = { auto: isAutoRow, onAutoChange, 'data-auto-path': canAuto ? path : undefined };
```

Spread `autoProps` onto every built-in row arm, and add `readout={autoReadout}` to the arms whose row takes a `readout` (`SliderRow`, `NumberRow` — check each signature). `data-auto-path` is what Task 14's gesture keys off, which is why a `.manual()` row simply does not get it.

Widen `ControlRenderer`'s argument in `packages/labkit/src/config/types.ts` with `auto: boolean` and `setAuto: (next: boolean) => void`, and pass them, so an app-defined control can honor the state rather than silently ignoring it. `ControlRenderer` is an alias of weasel-ui's `PrefRenderer` — widen it there and keep the alias, so the two cannot drift.

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run --project=labkit packages/labkit/src/controls/ControlPanel.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx biome check --write packages/labkit/src/controls packages/labkit/src/config/types.ts
git add packages/labkit/src/controls packages/labkit/src/config/types.ts
git commit -m "render a control panel row in its auto state"
```

---

## Task 14: Shift-click

**Files:**
- Modify: `packages/labkit/src/controls/ControlPanel.tsx`
- Test: `packages/labkit/src/controls/ControlPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
const panel = (props: Partial<ControlPanelProps<Record<string, unknown>>> = {}) =>
  render(
    <ControlPanel
      schema={resolveConfigSchema(f.schema({ gap: f.number(12).range(0, 48) }))}
      config={{ gap: 12 }}
      auto={new Set()}
      setConfig={() => {}}
      {...props}
    />,
  );

it('toggles a row on shift-pointerdown and suppresses the control it landed on', () => {
  const setConfig = vi.fn();
  const { container } = panel({ setConfig });
  const track = container.querySelector('input[type=range]') as HTMLInputElement;
  const ev = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, shiftKey: true });
  track.dispatchEvent(ev);

  expect(setConfig).toHaveBeenCalledWith('gap', auto);
  // A PROXY, not the real claim. jsdom synthesizes neither a label's click
  // retargeting nor a range input's drag, so "the slider did not move" cannot
  // fail here. What is assertable is that the default was suppressed; the
  // browser half is covered by AutoControls.stories.tsx.
  expect(ev.defaultPrevented).toBe(true);
});

it('leaves an ordinary pointerdown alone', () => {
  const setConfig = vi.fn();
  const { container } = panel({ setConfig });
  container
    .querySelector('input[type=range]')
    ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  expect(setConfig).not.toHaveBeenCalled();
});

it('ignores shift-pointerdown on a manual row', () => {
  const setConfig = vi.fn();
  const { container } = panel({
    schema: resolveConfigSchema(f.schema({ seed: f.number(1).manual().range(0, 8) })),
    config: { seed: 1 },
    setConfig,
  });
  container
    .querySelector('input')
    ?.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, cancelable: true, shiftKey: true }),
    );
  expect(setConfig).not.toHaveBeenCalled();
});

it('pins a shift-clicked auto row back at its stored value', () => {
  const setConfig = vi.fn();
  const { container } = panel({ config: { gap: 24 }, auto: new Set(['gap']), setConfig });
  container
    .querySelector('input[type=range]')
    ?.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, cancelable: true, shiftKey: true }),
    );
  expect(setConfig).toHaveBeenCalledWith('gap', 24);
});
```

If `PointerEvent` is not constructible in this project's jsdom, use `new MouseEvent('pointerdown', …)` — the handler reads only `shiftKey` and `target`.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=labkit packages/labkit/src/controls/ControlPanel.test.tsx`

Expected: FAIL — `setConfig` not called.

- [ ] **Step 3: Implement**

In `ControlPanel`, hold the current per-path toggle in a ref so the listener attaches once, and bind it in the capture phase on the list element:

```tsx
  const listRef = useRef<HTMLDivElement>(null);
  const toggles = useRef(new Map<string, () => void>());
  // Capture phase, because `PropertyRow` is a <label>: a bubbled handler runs
  // after the browser has already begun a range drag or a native control's
  // activation, so the shift-click moves the very value it was meant to unpin.
  useEffect(() => {
    const host = listRef.current;
    if (!host) return;
    const onDown = (e: PointerEvent) => {
      if (!e.shiftKey) return;
      const row = (e.target as HTMLElement | null)?.closest('[data-auto-path]');
      const path = row?.getAttribute('data-auto-path');
      const toggle = path ? toggles.current.get(path) : undefined;
      if (!toggle) return;
      e.preventDefault();
      e.stopPropagation();
      toggle();
    };
    host.addEventListener('pointerdown', onDown, true);
    return () => host.removeEventListener('pointerdown', onDown, true);
  }, []);
```

Give `PropertyList` `ref={listRef}` (add a forwarded ref to it if it has none), and have each `ControlRow` register its own toggle on every render:

```tsx
  toggles.current.set(path, () => write(isAutoRow ? value : autoValue));
```

with cleanup removing the entry on unmount, so a row hidden by `showIf` stops responding.

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run --project=labkit packages/labkit/src/controls/ControlPanel.test.tsx`

Expected: PASS.

- [ ] **Step 5: Prove the guard is load-bearing**

Delete the `e.preventDefault()` line and re-run. Expected: the first test fails. Put it back. If it still passes, the assertion is measuring nothing — fix the test before moving on.

- [ ] **Step 6: Commit**

```bash
npx biome check --write packages/labkit/src/controls
git add packages/labkit/src/controls
git commit -m "toggle a control between pinned and auto on shift-click"
```

---

## Task 15: The browser check

**Files:**
- Create: `packages/labkit/src/controls/AutoControls.stories.tsx`

Everything visual about this feature is invisible to jsdom: the ghost, the muted accent, the hover-revealed dot, and whether shift-clicking a slider track moves it.

- [ ] **Step 1: Write the story**

A `ControlPanel` carrying one row of each of the seven kinds, rendered twice side by side — once all pinned, once all auto — so one screenshot holds both states. Follow the conventions in `packages/labkit/src/controls/ControlPanel.stories.tsx`.

- [ ] **Step 2: Run the storybook project**

Run: `npx vitest run --project=storybook`

Expected: PASS.

- [ ] **Step 3: Look at it, in both modes**

Start the lab, open the story, and check by eye:

- the dot is absent until you hover the row, and present on every auto row
- an auto slider's fill and thumb carry no accent color
- shift-clicking a slider's track toggles it **without moving the handle**
- tab reaches the control, then the dot; Enter on the dot toggles

Storybook's theme global does **not** switch weasel's theme — `tokens.css` keys off `[data-wzl-mode]` and the URL global sets `data-theme`, which nothing reads. Switch modes with the lab header's Light/Dark buttons, never `&globals=theme:dark`, or you will check one theme twice.

Send the screenshots to the wall — `slop <file>`, zone `weasel` — rather than opening them in Preview.

- [ ] **Step 4: Commit**

```bash
npx biome check --write packages/labkit/src/controls/AutoControls.stories.tsx
git add packages/labkit/src/controls/AutoControls.stories.tsx
git commit -m "add a story covering every row kind in its auto state"
```

---

## Task 16: Exports, docs, changeset

**Files:**
- Modify: `packages/labkit/src/config/index.ts`, `packages/labkit/src/index.ts`
- Modify: `docs/extending.md`
- Create: `.changeset/auto-controls.md`

- [ ] **Step 1: Export the new surface**

In `packages/labkit/src/config/index.ts`:

```ts
export { auto, type Auto, isAuto } from './auto';
export { autoPathsOf, resolveAutoConfig } from './autoConfig';
export { useResolvedConfig } from './useResolvedConfig';
```

and re-export the same names from `packages/labkit/src/index.ts`, matching how that file already re-exports `./config/builder` and friends. Do **not** write `export * from '@weasel-js/<pkg>'` anywhere: a star re-export of an *external* package survives typecheck and the unit suite and then fails at a consumer's bundler, because esbuild cannot see through the package boundary to enumerate the names.

- [ ] **Step 2: Check the barrel holds**

Run: `npx vitest run --project=labkit packages/labkit/src/index.test.ts`

Expected: PASS. If that file enumerates the public surface, add the new names to it.

- [ ] **Step 3: Document it**

In `docs/extending.md`, in the config-schema section, add a short subsection covering the three builder calls, `auto` as a writable value, and the shift-click gesture. Include the one thing a reader cannot derive from the code: `.manual()` exists for a value the instrument cannot receive as `undefined`.

- [ ] **Step 4: Write the changeset**

`.changeset/auto-controls.md`:

```markdown
---
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
---

Controls can be set to auto. Shift-click a row in a labkit control panel — or
click the pin dot beside its label — and the field stops holding a pinned
value: the instrument decides instead, and the control draws ghosted at what it
decided. `auto` is a value you can write anywhere a config value goes, so
`setConfig('gap', auto)` and a trial's seed config both work; a schema starts a
field unpinned with `.initial(auto)`, attaches a resolver with `.auto(fn)`, and
opts a field out entirely with `.manual()`.

This adds API and changes nothing existing: property rows in `@weasel-js/ui`
take two new optional props, and a control renderer's argument gains two
fields.
```

`patch`, always — every changeset in this repo is `patch` whatever the change does. The level is Mike's call, made explicitly, and the `bump-approved` marker is never something you write yourself.

- [ ] **Step 5: Full gates**

Run these in order and read the output rather than the exit code — a backgrounded vitest run has reported exit 0 with a real failure sitting in the suite:

```bash
npx tsc --noEmit
npx vitest run --project=labkit
npx vitest run --project=weasel-ui
npm run check:bumps
```

Expected: all clean. Check `ps` before starting anything larger — never run a full suite while another session is running one.

- [ ] **Step 6: Commit**

```bash
npx biome check --write packages/labkit/src docs/extending.md .changeset/auto-controls.md
git add packages/labkit/src/index.ts packages/labkit/src/config/index.ts docs/extending.md .changeset/auto-controls.md
git commit -m "export the auto control surface and document it"
```

---

## Task 17: Retire the plan and the spec

**Files:**
- Delete: `docs/superpowers/plans/2026-09-17-auto-controls.md`
- Delete: `docs/superpowers/specs/2026-09-17-auto-controls-design.md`

A plan that outlives its branch becomes a confident description of a codebase that no longer exists, and its unchecked boxes read as open work. `git log` is the archive.

- [ ] **Step 1: Check nothing described here went unbuilt**

Re-read both documents against the tree. Anything described but not built either gets built now or gets its own entry in `docs/TODO.md` — never left implied by a deleted plan.

- [ ] **Step 2: Delete and commit**

```bash
git rm docs/superpowers/plans/2026-09-17-auto-controls.md docs/superpowers/specs/2026-09-17-auto-controls-design.md
git commit -m "retire the auto-controls plan and spec"
```
