# Icon Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every icon in weasel is named `namespace:name`, drawn from per-package generated tables through one registry, and an app build ships only the glyphs it names, with lazily loaded variants for pickers.

**Architecture:** A new React-free `@weasel-js/icons` package holds the name types, `scopedIcon`, the registry and one `unplugin` build plugin. A generalized `gen:icons` turns each package's `icons/*.mjs` definitions into that package's table and its bound `icon()`. Core owns the registry's React context; ui is the only package that draws.

**Tech Stack:** TypeScript, React 19, vitest (jsdom + browser projects), tsup (esbuild) for library builds, vite 8 (Rolldown) for apps, `unplugin`, `magic-string`.

**Spec:** `docs/superpowers/specs/2026-10-16-icon-registry-design.md`. Read it first; this plan argues from it.

## Global Constraints

- Qualified names are `namespace:name`. Kit namespaces: `core`, `ui`, `path-tools`, `draw` (apps/draw). Owner is the publishing package name (`@weasel-js/core`, …; `apps/draw` for the app).
- `@weasel-js/icons` imports no React and no DOM. `npm run check:react-free` must list its `dist/index.js`.
- `@weasel-js/icons` holds no module-level mutable state.
- `IconName` is declared in `packages/icons/src/index.ts` itself, not in a submodule the barrel re-exports. CLAUDE.md, "A `declare module` augmentation merges through one re-export hop, not two".
- A bare name in `icon()` resolves only against the calling package's namespace. No fallback search.
- No glyph table is imported as a fallback anywhere in ui or core; that import defeats trimming.
- The `…Icon` React components are removed outright, no deprecation period.
- Every changeset is `patch`. New package version: `1.10.1`, added to the changesets `fixed` group.
- **Never run tests, typecheck, lint or builds locally.** Targeted runs: `onto do -- <command>`. Whole branch: commit, then `npm run test:fleet` (its `gate` project covers typecheck, lint and `check:*`). Generators that finish in a second or two (`npm run gen:icons`, `npm run check:size`) may run locally.
- Work in a worktree: `git worktree add ../weasel-icon-registry -b icon-registry`, then `EnterWorktree`, then `npm ci` there before building anything (CLAUDE.md trap: a worktree with no `node_modules` builds against main's).
- Files stay under 400 lines and functions under 120 (`npm run check:size`).
- US English in code, comments and docs.

## Review Focus

- **A schema loaded as JSON names an icon the build never referenced** → it resolves only when the app has loaded a variant that holds it; with none loaded it draws the placeholder and warns once per name, never throws. Pinned in Task 2 (`useIconGlyph` miss) and Task 5 (`<Icon>` placeholder).
- **Two copies of one package in an app register the same table** (same namespace, same owner) → merge silently, no refusal, no displacement warning. Pinned in Task 1.
- **A variant loader rejects** (network failure on the dynamic import) → `useIconVariant` reports `failed`, the registry keeps what it had, and calling it again retries. Pinned in Task 2.
- **A minifier runs over the placeholder** → the string-literal marker survives and is replaced; an identifier marker would be renamed. Pinned in Task 7 (build with `minify: true`).
- **`icon()` called with a non-literal argument** (`icon(name)`) → left as a runtime call, which still qualifies correctly; the plugin warns that the name can only resolve from a variant. Pinned in Task 7.

---

## File map

| Path | Responsibility |
|---|---|
| `packages/icons/src/index.ts` | Barrel; declares `IconName` |
| `packages/icons/src/names.ts` | `IconRef`, `qualify`, `scopedIcon`, `toIconRef`, `splitIconRef` |
| `packages/icons/src/table.ts` | `IconGlyph`, `IconTable`, `IconVariantModule` |
| `packages/icons/src/registry.ts` | `createIconRegistry` |
| `packages/icons/src/variants.ts` | Variant loading state, used by the registry |
| `packages/icons/src/plugin/index.ts` | `unplugin` factory: `weaselIcons` |
| `packages/icons/src/plugin/rewrite.ts` | `icon('x')` → `/* @icon */ 'ns:x'` |
| `packages/icons/src/plugin/collect.ts` | Finds `@icon` literals in module text |
| `packages/icons/src/plugin/tables.ts` | Finds and reads table JSON in Node |
| `packages/icons/src/plugin/virtual.ts` | Virtual module ids, placeholders, variant filtering |
| `packages/icons/virtual.d.ts` | `declare module 'virtual:weasel-icons…'` |
| `packages/icons/scripts/gen-icons.mjs` | The generator (moved from ui) |
| `packages/icons/scripts/lib/*.mjs` | Shared drawing helpers (moved from `packages/ui/scripts/icons/base.mjs` and `lib/`) |
| `packages/core/src/iconRegistry/*.tsx` | Context, providers, `useIconGlyph`, `useIconVariant` |
| `packages/{core,ui,path-tools}/icons/` | Definitions and `index.mjs` |
| `apps/draw/icons/` | Definitions and `index.mjs` |
| `packages/*/src/icons.gen.ts`, `src/icons.table.{ts,json}` | Generated per package |
| `packages/ui/src/components/PrefSchemaEditor/IconAttrField.tsx` | The picker |

---

### Task 1: `@weasel-js/icons` package: names, tables, registry

**Files:**
- Create: `packages/icons/package.json`, `tsconfig.json`, `tsup.config.ts`, `typedoc.config.mjs`, `README.md`, `LICENSE` (copy `packages/registry/LICENSE`)
- Create: `packages/icons/src/{index,names,table,registry,variants}.ts`
- Test: `packages/icons/src/names.test.ts`, `packages/icons/src/registry.test.ts`
- Modify: `tsconfig.json` (paths entry + `include`), `.changeset/config.json` (`fixed` group), `scripts/check-react-free.mjs` (`ENTRIES`)

**Interfaces:**
- Produces:
  - `type IconRef = string & { readonly [brand]: 'IconRef' }`
  - `interface IconName {}` (keys are qualified names; values `true`)
  - `type QualifiedIconName = Extract<keyof IconName, string>`
  - `qualify(namespace: string, name: string): string`
  - `scopedIcon<Own extends string>(namespace: string): (name: Own | QualifiedIconName) => IconRef`
  - `toIconRef(value: string | undefined): IconRef | undefined` (accepts only `ns:name`)
  - `splitIconRef(ref: string): { namespace: string; name: string } | undefined`
  - `interface IconGlyph { readonly body: string; readonly fill?: string; readonly group: string; readonly tags: readonly string[] }`
  - `interface IconTable { readonly namespace: string; readonly owner: string; readonly icons: Readonly<Record<string, IconGlyph>> }`
  - `type IconVariantModule = { readonly default: readonly IconTable[] }`
  - `type IconVariantLoader = () => Promise<IconVariantModule>`
  - `type IconVariantState = 'unknown' | 'idle' | 'loading' | 'loaded' | 'failed'`
  - `interface IconEntry { readonly ref: IconRef; readonly glyph: IconGlyph; readonly owner: string; readonly overridden: boolean }`
  - `interface IconRegistry { get(ref: string): IconGlyph | undefined; add(tables: IconTable | readonly IconTable[]): () => void; override(ref: IconRef, glyph: IconGlyph, source?: string): () => void; owner(namespace: string): string | undefined; entries(): readonly IconEntry[]; provideVariants(loaders: Readonly<Record<string, IconVariantLoader>>): void; loadVariant(name: string): Promise<void>; variantState(name: string): IconVariantState; subscribe(listener: () => void): () => void; getVersion(): number }`
  - `createIconRegistry(initial?: IconTable | readonly IconTable[]): IconRegistry`
  - `class IconNamespaceClaimedError extends Error { namespace; owner; claimant }`

- [ ] **Step 1: Scaffold the package**

`packages/icons/package.json`:

```json
{
  "name": "@weasel-js/icons",
  "version": "1.10.1",
  "description": "Namespaced icon names, the icon registry, and the build plugin that ships only the glyphs a build uses. No React, no DOM, no glyphs of its own.",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" },
    "./package.json": "./package.json"
  },
  "author": "orochi235",
  "homepage": "https://orochi235.github.io/weasel/",
  "repository": { "type": "git", "url": "git+https://github.com/orochi235/weasel.git", "directory": "packages/icons" },
  "bugs": { "url": "https://github.com/orochi235/weasel/issues" },
  "engines": { "node": ">=22" },
  "files": ["dist", "virtual.d.ts", "README.md", "LICENSE"],
  "scripts": { "build": "tsup" },
  "dependencies": { "@weasel-js/registry": "1.10.1" },
  "publishConfig": { "access": "public", "provenance": true }
}
```

`tsconfig.json`, `tsup.config.ts` and `typedoc.config.mjs`: copy `packages/registry`'s verbatim. Add `"@weasel-js/icons": ["./packages/icons/src/index.ts"]` to root `tsconfig.json` `paths` beside the registry entry, and `"packages/icons/src"` to its `include`. Add `"@weasel-js/icons"` to the `fixed` array in `.changeset/config.json`. Add to `ENTRIES` in `scripts/check-react-free.mjs`:

```js
  {
    file: 'packages/icons/dist/index.js',
    why: 'names and the registry, read by prefs and routing, which must not pull React in',
  },
```

Run `npm install` locally (it only links the workspace) so `node_modules/@weasel-js/icons` exists.

- [ ] **Step 2: Write the failing name tests**

`packages/icons/src/names.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { qualify, scopedIcon, splitIconRef, toIconRef } from './names';

describe('icon names', () => {
  it('qualifies a bare name against the package namespace', () => {
    const icon = scopedIcon<'undo'>('core');
    expect(icon('undo')).toBe('core:undo');
  });

  it('passes a qualified name through unchanged', () => {
    const icon = scopedIcon<'undo'>('core');
    expect(icon('ui:close' as never)).toBe('ui:close');
  });

  it('qualify never searches another namespace', () => {
    expect(qualify('core', 'close')).toBe('core:close');
  });

  it('splits a qualified ref, and refuses a bare or empty one', () => {
    expect(splitIconRef('path-tools:reversePath')).toEqual({ namespace: 'path-tools', name: 'reversePath' });
    expect(splitIconRef('undo')).toBeUndefined();
    expect(splitIconRef(':undo')).toBeUndefined();
    expect(splitIconRef('core:')).toBeUndefined();
  });

  it('toIconRef accepts only a qualified string', () => {
    expect(toIconRef('ui:close')).toBe('ui:close');
    expect(toIconRef('close')).toBeUndefined();
    expect(toIconRef(undefined)).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `onto do -- npx vitest run --project=weasel-ui packages/icons/src/names.test.ts`
Expected: FAIL, `Failed to resolve import "./names"`.

- [ ] **Step 4: Implement names and tables**

`packages/icons/src/names.ts`:

```ts
import type { QualifiedIconName } from './index';

declare const brand: unique symbol;

/** A qualified icon name (`namespace:name`) that came from `icon()` or `toIconRef`. */
export type IconRef = string & { readonly [brand]: 'IconRef' };

const QUALIFIED = /^([^:\s]+):([^:\s]+)$/;

/** `name` in `namespace`, unless it already names one. */
export function qualify(namespace: string, name: string): string {
  return name.includes(':') ? name : `${namespace}:${name}`;
}

/** The two halves of a qualified ref, or `undefined` for anything else. */
export function splitIconRef(ref: string): { namespace: string; name: string } | undefined {
  const m = QUALIFIED.exec(ref);
  return m ? { namespace: m[1]!, name: m[2]! } : undefined;
}

/** A string read at run time (a schema loaded as JSON) as a ref, when it is qualified. */
export function toIconRef(value: string | undefined): IconRef | undefined {
  return value !== undefined && QUALIFIED.test(value) ? (value as IconRef) : undefined;
}

/** A package's `icon()`: bare names resolve in `namespace` only. Generated into each package's `icons.gen.ts`. */
export function scopedIcon<Own extends string>(namespace: string) {
  return (name: Own | QualifiedIconName): IconRef => qualify(namespace, name) as IconRef;
}
```

`packages/icons/src/table.ts`:

```ts
/** One glyph: SVG body on a 20x20 viewBox stroked in currentColor, and how it is filed. */
export interface IconGlyph {
  readonly body: string;
  /** The enclosed region `<Icon filled>` shades, when there is one. */
  readonly fill?: string;
  readonly group: string;
  readonly tags: readonly string[];
}

/** Every glyph one publisher ships under one namespace. */
export interface IconTable {
  readonly namespace: string;
  /** The publishing package. Tables with one namespace merge only when their owners match. */
  readonly owner: string;
  readonly icons: Readonly<Record<string, IconGlyph>>;
}

/** What a variant's dynamic import resolves to. */
export interface IconVariantModule {
  readonly default: readonly IconTable[];
}

export type IconVariantLoader = () => Promise<IconVariantModule>;
```

`packages/icons/src/index.ts`:

```ts
/**
 * `@weasel-js/icons`: icon names, tables and the registry. No React, no DOM, no glyphs.
 *
 * @packageDocumentation
 */

/**
 * Every qualified icon name, as keys. Each package's generated `icons.gen.ts`
 * adds its own by declaration merging. Declared here, in the barrel, because an
 * augmentation aimed at a module that only re-exports this would declare a fresh one.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IconName {}

/** A name some loaded package declares. */
export type QualifiedIconName = Extract<keyof IconName, string>;

export { qualify, scopedIcon, splitIconRef, toIconRef } from './names';
export type { IconRef } from './names';
export type { IconGlyph, IconTable, IconVariantLoader, IconVariantModule } from './table';
export { createIconRegistry, IconNamespaceClaimedError } from './registry';
export type { IconEntry, IconRegistry, IconVariantState } from './registry';
```

- [ ] **Step 5: Run the name tests to verify they pass**

Run: `onto do -- npx vitest run --project=weasel-ui packages/icons/src/names.test.ts`
Expected: PASS (5 tests). The suite will not compile until `registry.ts` exists; if it complains, add an empty `export {}` stub for `registry.ts` and continue.

- [ ] **Step 6: Write the failing registry tests**

`packages/icons/src/registry.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createIconRegistry, IconNamespaceClaimedError } from './registry';
import type { IconTable } from './table';
import type { IconRef } from './names';

const glyph = (body: string) => ({ body, group: 'Test', tags: [] });
const core = (icons: Record<string, string>): IconTable => ({
  namespace: 'core',
  owner: '@weasel-js/core',
  icons: Object.fromEntries(Object.entries(icons).map(([k, b]) => [k, glyph(b)])),
});
const ref = (s: string) => s as IconRef;

describe('createIconRegistry', () => {
  it('looks a glyph up by qualified name', () => {
    const r = createIconRegistry(core({ undo: '<path d="u"/>' }));
    expect(r.get('core:undo')?.body).toBe('<path d="u"/>');
    expect(r.get('core:redo')).toBeUndefined();
    expect(r.get('undo')).toBeUndefined();
  });

  it('merges a second table with the same namespace and owner', () => {
    const r = createIconRegistry(core({ undo: 'u' }));
    r.add(core({ undo: 'u', redo: 'r' }));
    expect(r.get('core:redo')?.body).toBe('r');
    expect(r.entries().every((e) => !e.overridden)).toBe(true);
  });

  it('refuses a table claiming a namespace another owner holds', () => {
    const r = createIconRegistry(core({ undo: 'u' }));
    const rival: IconTable = { namespace: 'core', owner: '@acme/core', icons: { undo: glyph('x') } };
    expect(() => r.add(rival)).toThrow(IconNamespaceClaimedError);
    expect(r.get('core:undo')?.body).toBe('u');
  });

  it('releases a table, freeing its namespace', () => {
    const r = createIconRegistry();
    const release = r.add(core({ undo: 'u' }));
    release();
    expect(r.get('core:undo')).toBeUndefined();
    expect(r.owner('core')).toBeUndefined();
  });

  it('overrides one icon explicitly, and releasing the override uncovers the original', () => {
    const r = createIconRegistry(core({ undo: 'u' }));
    const release = r.override(ref('core:undo'), glyph('mine'), 'app');
    expect(r.get('core:undo')?.body).toBe('mine');
    expect(r.entries().find((e) => e.ref === 'core:undo')?.overridden).toBe(true);
    release();
    expect(r.get('core:undo')?.body).toBe('u');
  });

  it('notifies subscribers and advances its version on change', () => {
    const r = createIconRegistry();
    const listener = vi.fn();
    r.subscribe(listener);
    const v = r.getVersion();
    r.add(core({ undo: 'u' }));
    expect(listener).toHaveBeenCalled();
    expect(r.getVersion()).toBeGreaterThan(v);
  });
});

describe('variants', () => {
  it('loads a variant once and adds its tables', async () => {
    const r = createIconRegistry();
    const loader = vi.fn(async () => ({ default: [core({ undo: 'u' })] }));
    r.provideVariants({ all: loader });
    expect(r.variantState('all')).toBe('idle');
    await Promise.all([r.loadVariant('all'), r.loadVariant('all')]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(r.variantState('all')).toBe('loaded');
    expect(r.get('core:undo')).toBeDefined();
  });

  it('reports an unknown variant without throwing', async () => {
    const r = createIconRegistry();
    expect(r.variantState('picker')).toBe('unknown');
    await expect(r.loadVariant('picker')).resolves.toBeUndefined();
  });

  it('marks a rejected loader failed, keeps what it had, and retries on the next call', async () => {
    const r = createIconRegistry(core({ undo: 'u' }));
    let fail = true;
    r.provideVariants({
      all: async () => {
        if (fail) throw new Error('offline');
        return { default: [core({ redo: 'r' })] };
      },
    });
    await r.loadVariant('all');
    expect(r.variantState('all')).toBe('failed');
    expect(r.get('core:undo')).toBeDefined();
    fail = false;
    await r.loadVariant('all');
    expect(r.variantState('all')).toBe('loaded');
    expect(r.get('core:redo')).toBeDefined();
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `onto do -- npx vitest run --project=weasel-ui packages/icons/src/registry.test.ts`
Expected: FAIL, `createIconRegistry is not a function` (or not exported).

- [ ] **Step 8: Implement the registry**

`packages/icons/src/variants.ts`:

```ts
import type { IconTable, IconVariantLoader } from './table';

export type IconVariantState = 'unknown' | 'idle' | 'loading' | 'loaded' | 'failed';

/** Loads each named variant at most once at a time; a failure leaves it retryable. */
export function createVariants(addTables: (tables: readonly IconTable[]) => void, changed: () => void) {
  const loaders = new Map<string, IconVariantLoader>();
  const states = new Map<string, IconVariantState>();
  const pending = new Map<string, Promise<void>>();

  const set = (name: string, state: IconVariantState) => {
    states.set(name, state);
    changed();
  };

  return {
    provide(next: Readonly<Record<string, IconVariantLoader>>): void {
      for (const [name, loader] of Object.entries(next)) {
        loaders.set(name, loader);
        if (!states.has(name)) states.set(name, 'idle');
      }
      changed();
    },
    state(name: string): IconVariantState {
      return states.get(name) ?? 'unknown';
    },
    load(name: string): Promise<void> {
      const loader = loaders.get(name);
      if (!loader || states.get(name) === 'loaded') return Promise.resolve();
      const inFlight = pending.get(name);
      if (inFlight) return inFlight;
      set(name, 'loading');
      const run = loader()
        .then((mod) => {
          addTables(mod.default);
          set(name, 'loaded');
        })
        .catch(() => set(name, 'failed'))
        .finally(() => pending.delete(name));
      pending.set(name, run);
      return run;
    },
  };
}
```

`packages/icons/src/registry.ts`:

```ts
import { createEmitter, createReflectable } from '@weasel-js/registry';
import type { IconRef } from './names';
import type { IconGlyph, IconTable, IconVariantLoader } from './table';
import { createVariants, type IconVariantState } from './variants';

export type { IconVariantState } from './variants';

/** One icon as the registry reports it. */
export interface IconEntry {
  readonly ref: IconRef;
  readonly glyph: IconGlyph;
  readonly owner: string;
  /** Registered with `override`, over a table's glyph. */
  readonly overridden: boolean;
}

/** Thrown when a table claims a namespace another owner holds. */
export class IconNamespaceClaimedError extends Error {
  constructor(readonly namespace: string, readonly owner: string, readonly claimant: string) {
    super(`icon namespace "${namespace}" belongs to ${owner}; ${claimant} cannot register under it`);
    this.name = 'IconNamespaceClaimedError';
  }
}

export interface IconRegistry {
  get(ref: string): IconGlyph | undefined;
  add(tables: IconTable | readonly IconTable[]): () => void;
  override(ref: IconRef, glyph: IconGlyph, source?: string): () => void;
  owner(namespace: string): string | undefined;
  entries(): readonly IconEntry[];
  provideVariants(loaders: Readonly<Record<string, IconVariantLoader>>): void;
  loadVariant(name: string): Promise<void>;
  variantState(name: string): IconVariantState;
  subscribe(listener: () => void): () => void;
  getVersion(): number;
}

const OVERRIDE = 'override';

export function createIconRegistry(initial?: IconTable | readonly IconTable[]): IconRegistry {
  const glyphs = createReflectable<IconGlyph>();
  // How many live tables hold each namespace, and whose it is while any do.
  const claims = new Map<string, { owner: string; count: number }>();
  const notify = createEmitter();
  let version = 0;
  const changed = () => {
    version++;
    notify.emit();
  };
  glyphs.subscribe(changed);

  const claim = (t: IconTable) => {
    const held = claims.get(t.namespace);
    if (held && held.owner !== t.owner) throw new IconNamespaceClaimedError(t.namespace, held.owner, t.owner);
    claims.set(t.namespace, { owner: t.owner, count: (held?.count ?? 0) + 1 });
  };
  const unclaim = (t: IconTable) => {
    const held = claims.get(t.namespace);
    if (!held) return;
    if (held.count <= 1) claims.delete(t.namespace);
    else claims.set(t.namespace, { ...held, count: held.count - 1 });
  };

  const addOne = (t: IconTable): (() => void) => {
    claim(t);
    const keys = Object.keys(t.icons).map((name) => `${t.namespace}:${name}`);
    // `set`, not `push`: a same-owner table re-registering a glyph is a newer copy, not a conflict.
    for (const key of keys) glyphs.set(key, t.icons[key.slice(t.namespace.length + 1)]!, { source: t.owner });
    let released = false;
    return () => {
      if (released) return;
      released = true;
      unclaim(t);
      if (!claims.has(t.namespace)) for (const key of keys) glyphs.delete(key);
    };
  };

  const add = (tables: IconTable | readonly IconTable[]): (() => void) => {
    const list = Array.isArray(tables) ? tables : [tables as IconTable];
    // Check every claim before writing any, so a refused batch registers nothing.
    for (const t of list) {
      const held = claims.get(t.namespace);
      if (held && held.owner !== t.owner) throw new IconNamespaceClaimedError(t.namespace, held.owner, t.owner);
    }
    const releases = list.map(addOne);
    return () => releases.forEach((r) => r());
  };

  const variants = createVariants((tables) => void add(tables), changed);
  if (initial) add(initial);

  return {
    get: (ref) => glyphs.get(ref),
    add,
    override: (ref, glyph, source = OVERRIDE) => glyphs.push(ref, glyph, { source: `${OVERRIDE}:${source}` }),
    owner: (namespace) => claims.get(namespace)?.owner,
    entries: () =>
      glyphs.entries().map((e) => ({
        ref: e.key as IconRef,
        glyph: e.value,
        owner: e.source?.startsWith(`${OVERRIDE}:`) ? e.source.slice(OVERRIDE.length + 1) : (e.source ?? ''),
        overridden: e.source?.startsWith(`${OVERRIDE}:`) ?? false,
      })),
    provideVariants: variants.provide,
    loadVariant: variants.load,
    variantState: variants.state,
    subscribe: notify.subscribe,
    getVersion: () => version,
  };
}
```

Check `createEmitter`'s actual method names in `packages/registry/src/emitter.ts` before relying on `emit`/`subscribe`, and adjust the two call sites if they differ. Releasing an override when its table has since been released must not resurrect the table's glyph: `release` on a `push`ed registrant removes only that registrant, which is what the reflectable already does.

- [ ] **Step 9: Run the registry tests to verify they pass**

Run: `onto do -- npx vitest run --project=weasel-ui packages/icons/src`
Expected: PASS (all tests in both files).

- [ ] **Step 10: Commit**

```bash
git add packages/icons tsconfig.json .changeset/config.json scripts/check-react-free.mjs package-lock.json
git commit -m "add @weasel-js/icons: namespaced icon names, tables and the registry"
```

---

### Task 2: The registry in React (core)

**Files:**
- Create: `packages/core/src/iconRegistry/IconRegistryProvider.tsx`, `packages/core/src/iconRegistry/useIconGlyph.ts`, `packages/core/src/iconRegistry/useIconVariant.ts`, `packages/core/src/iconRegistry/index.ts`
- Modify: `packages/core/src/WeaselProvider.tsx`, `packages/core/src/canvas/SceneCanvas.tsx` (provider stack), `packages/core/src/barrel/icons.ts` (exports), `packages/core/package.json` (dependency `@weasel-js/icons: 1.10.1`)
- Test: `packages/core/src/iconRegistry/iconRegistry.test.tsx`

**Interfaces:**
- Consumes: `createIconRegistry`, `IconRegistry`, `IconTable`, `IconVariantLoader`, `IconGlyph`, `IconEntry`, `IconVariantState` from Task 1.
- Produces:
  - `IconRegistryProvider(props: { icons?: IconTable | readonly IconTable[]; variants?: Readonly<Record<string, IconVariantLoader>>; children: ReactNode })`
  - `IconRegistryProviderIfRoot({ children })`
  - `useIconRegistry(): IconRegistry | null`
  - `useIconGlyph(ref: string | undefined): IconGlyph | undefined`
  - `useIconVariant(name: string): { entries: readonly IconEntry[]; state: IconVariantState }`
  - `WeaselProviderProps.icons?`, `WeaselProviderProps.iconVariants?`

- [ ] **Step 1: Write the failing tests**

`packages/core/src/iconRegistry/iconRegistry.test.tsx`:

```tsx
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { IconTable } from '@weasel-js/icons';
import { IconRegistryProvider, useIconGlyph, useIconVariant } from './index';

const core: IconTable = {
  namespace: 'core', owner: '@weasel-js/core',
  icons: { undo: { body: '<path d="u"/>', group: 'History', tags: ['history'] } },
};
const more: IconTable = {
  namespace: 'core', owner: '@weasel-js/core',
  icons: { redo: { body: '<path d="r"/>', group: 'History', tags: [] } },
};

describe('icon registry provider', () => {
  it('serves a glyph from the tables it was given', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <IconRegistryProvider icons={core}>{children}</IconRegistryProvider>;
    const { result } = renderHook(() => useIconGlyph('core:undo'), { wrapper });
    expect(result.current?.body).toBe('<path d="u"/>');
  });

  it('answers undefined with no provider in scope, and for a miss', () => {
    expect(renderHook(() => useIconGlyph('core:undo')).result.current).toBeUndefined();
    const wrapper = ({ children }: { children: ReactNode }) => <IconRegistryProvider icons={core}>{children}</IconRegistryProvider>;
    expect(renderHook(() => useIconGlyph('core:redo'), { wrapper }).result.current).toBeUndefined();
  });

  it('loads a variant when asked, and re-renders with its entries', async () => {
    const loader = vi.fn(async () => ({ default: [more] }));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <IconRegistryProvider icons={core} variants={{ all: loader }}>{children}</IconRegistryProvider>
    );
    const { result } = renderHook(() => useIconVariant('all'), { wrapper });
    await waitFor(() => expect(result.current.state).toBe('loaded'));
    expect(result.current.entries.map((e) => e.ref).sort()).toEqual(['core:redo', 'core:undo']);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('reports a variant with no loader as unknown, listing what is registered', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <IconRegistryProvider icons={core}>{children}</IconRegistryProvider>;
    const { result } = renderHook(() => useIconVariant('picker'), { wrapper });
    expect(result.current.state).toBe('unknown');
    expect(result.current.entries.map((e) => e.ref)).toEqual(['core:undo']);
  });

  it('a failed variant can be asked for again', async () => {
    let fail = true;
    const loader = async () => { if (fail) throw new Error('offline'); return { default: [more] }; };
    function Probe() {
      const { state } = useIconVariant('all');
      return <span>{state}</span>;
    }
    const tree = (k: number) => (
      <IconRegistryProvider icons={core} variants={{ all: loader }}><Probe key={k} /></IconRegistryProvider>
    );
    const { rerender } = render(tree(1));
    await waitFor(() => expect(screen.getByText('failed')).toBeTruthy());
    fail = false;
    await act(async () => rerender(tree(2)));
    await waitFor(() => expect(screen.getByText('loaded')).toBeTruthy());
  });
});
```

The last test remounts `Probe` (new `key`) so its effect asks again; `useIconVariant` must call `loadVariant` on mount whenever the state is `idle` or `failed`.

- [ ] **Step 2: Run them to verify they fail**

Run: `onto do -- npx vitest run --project=core packages/core/src/iconRegistry`
Expected: FAIL, `Failed to resolve import "./index"`.

- [ ] **Step 3: Implement**

`packages/core/src/iconRegistry/IconRegistryProvider.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createIconRegistry, type IconRegistry, type IconTable, type IconVariantLoader } from '@weasel-js/icons';

const IconRegistryContext = createContext<IconRegistry | null>(null);

/** Props for {@link IconRegistryProvider}. */
export interface IconRegistryProviderProps {
  /** Tables registered for the provider's lifetime: `virtual:weasel-icons`'s default export, or tables imported by hand. */
  icons?: IconTable | readonly IconTable[];
  /** Variants a component may ask for by name, as dynamic imports: `{ all: () => import('virtual:weasel-icons/all') }`. */
  variants?: Readonly<Record<string, IconVariantLoader>>;
  children: ReactNode;
}

/** Holds one icon registry for everything below it. */
export function IconRegistryProvider({ icons, variants, children }: IconRegistryProviderProps) {
  const [registry] = useState(() => createIconRegistry());
  useEffect(() => (icons ? registry.add(icons) : undefined), [registry, icons]);
  useEffect(() => {
    if (variants) registry.provideVariants(variants);
  }, [registry, variants]);
  return <IconRegistryContext.Provider value={registry}>{children}</IconRegistryContext.Provider>;
}

/** Mount an empty {@link IconRegistryProvider} only when none is already in scope. */
export function IconRegistryProviderIfRoot({ children }: { children: ReactNode }) {
  if (useContext(IconRegistryContext)) return <>{children}</>;
  return <IconRegistryProvider>{children}</IconRegistryProvider>;
}

/** The registry in scope, or `null` outside every provider. */
export function useIconRegistry(): IconRegistry | null {
  return useContext(IconRegistryContext);
}
```

Registering `icons` in an effect leaves the first render empty, which is a visible flash of placeholders. Register synchronously instead: build the registry with `createIconRegistry(icons)` in the `useState` initializer, and keep the effect only for later changes of `icons` (skip the first run with a ref holding the initial value). Write the test `'serves a glyph from the tables it was given'` against the first render, as it is above, so the flash fails it.

`packages/core/src/iconRegistry/useIconGlyph.ts`:

```ts
import { useSyncExternalStore } from 'react';
import type { IconGlyph } from '@weasel-js/icons';
import { useIconRegistry } from './IconRegistryProvider';

const NOOP = () => () => {};

/** The glyph `ref` names in the registry in scope, re-read when the registry changes. */
export function useIconGlyph(ref: string | undefined): IconGlyph | undefined {
  const registry = useIconRegistry();
  return useSyncExternalStore(
    registry ? registry.subscribe : NOOP,
    () => (registry && ref ? registry.get(ref) : undefined),
  );
}
```

`packages/core/src/iconRegistry/useIconVariant.ts`:

```ts
import { useEffect, useSyncExternalStore } from 'react';
import type { IconEntry, IconVariantState } from '@weasel-js/icons';
import { useIconRegistry } from './IconRegistryProvider';

const NONE: readonly IconEntry[] = [];
const NOOP = () => () => {};

/** Every icon registered once `name` has loaded, asking for it on mount. A name with no loader lists what is registered. */
export function useIconVariant(name: string): { entries: readonly IconEntry[]; state: IconVariantState } {
  const registry = useIconRegistry();
  const subscribe = registry ? registry.subscribe : NOOP;
  const state = useSyncExternalStore(subscribe, () => registry?.variantState(name) ?? 'unknown');
  const entries = useSyncExternalStore(subscribe, () => registry?.entries() ?? NONE);
  useEffect(() => {
    if (registry && (state === 'idle' || state === 'failed')) void registry.loadVariant(name);
    // Ask once per mount; a failure is retried by the next mount, not by a render loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry, name]);
  return { entries, state };
}
```

`registry.entries()` must return the same array between changes or `useSyncExternalStore` loops. `createReflectable`'s `entries()` already does; the `.map` in Task 1's `entries` does not. Memoize it in `registry.ts` on `getVersion()` (cache the mapped array and the version it was built at). Add a Task 1 test: `expect(r.entries()).toBe(r.entries())`.

`packages/core/src/iconRegistry/index.ts`:

```ts
export { IconRegistryProvider, IconRegistryProviderIfRoot, useIconRegistry } from './IconRegistryProvider';
export type { IconRegistryProviderProps } from './IconRegistryProvider';
export { useIconGlyph } from './useIconGlyph';
export { useIconVariant } from './useIconVariant';
```

Re-export these from `packages/core/src/barrel/icons.ts`, and re-export `icon`-free names from `@weasel-js/icons` that consumers need through core by name (`IconRef`, `IconTable`, `toIconRef`). Never `export *` from an external package (CLAUDE.md trap).

In `WeaselProvider.tsx`, add `icons?: IconRegistryProviderProps['icons']` and `iconVariants?: IconRegistryProviderProps['variants']` to the props, and wrap the existing tree's outermost element:

```tsx
const Icons = isolate || icons || iconVariants ? IconRegistryProvider : IconRegistryProviderIfRoot;
return (
  <Icons icons={icons} variants={iconVariants}>
    <Deps>…existing tree…</Deps>
  </Icons>
);
```

`IconRegistryProviderIfRoot` takes only `children`; give it the same optional props and ignore them, or branch on the two components explicitly. In `SceneCanvas.tsx`, add `IconRegistryProviderIfRoot` to the stack of if-root providers next to `PointerProviderIfRoot`.

- [ ] **Step 4: Run them to verify they pass**

Run: `onto do -- npx vitest run --project=core packages/core/src/iconRegistry && onto do -- npx vitest run --project=weasel-ui packages/icons/src`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/iconRegistry packages/core/src/WeaselProvider.tsx packages/core/src/canvas/SceneCanvas.tsx packages/core/src/barrel/icons.ts packages/core/package.json packages/icons/src package-lock.json
git commit -m "add the icon registry provider, useIconGlyph and useIconVariant to core"
```

---

### Task 3: `gen:icons` across packages

**Files:**
- Move: `packages/ui/scripts/gen-icons.mjs` → `packages/icons/scripts/gen-icons.mjs`
- Move: `packages/ui/scripts/icons/base.mjs` and `packages/ui/scripts/icons/lib/` → `packages/icons/scripts/lib/`
- Move: every other `packages/ui/scripts/icons/*.mjs` → `packages/ui/icons/`
- Create: `packages/ui/icons/index.mjs`
- Create: `packages/icons/scripts/gen-icons.test.ts`, `packages/icons/scripts/fixtures/`
- Modify: root `package.json` (`gen:icons` → `node packages/icons/scripts/gen-icons.mjs`)
- Generated: `packages/ui/src/icons.gen.ts`, `packages/ui/src/icons.table.ts`, `packages/ui/src/icons.table.json`, `apps/site/src/icons.manifest.json`

**Interfaces:**
- Consumes: `IconTable` shape from Task 1.
- Produces:
  - Each `icons/index.mjs` exports `namespace: string`, `owner: string`, `groups: readonly [label: string, set: Record<string, Glyph>, opts?: { tags?: Record<string, string[]> }][]`, optional `rename: Record<string, string>`, optional `markGroup: string`.
  - Generated `src/icons.gen.ts`: `export const icon` (bound `scopedIcon`), `export type <Pascal>IconName` (bare names), `export const ICON_GROUPS: readonly { label: string; names: readonly string[] }[]`, and the `declare module '@weasel-js/icons'` augmentation.
  - Generated `src/icons.table.ts`: `export const icons: IconTable`.
  - Generated `src/icons.table.json`: the same table as JSON.
  - `apps/site/src/icons.manifest.json`: `{ namespace, owner, names: { name, group, tags }[] }[]`.
  - `gen-icons.mjs` exports `generate({ roots, write }): { tables }` for tests, and runs `main()` when executed directly.

- [ ] **Step 1: Move the files, keeping history**

```bash
mkdir -p packages/icons/scripts/lib packages/ui/icons
git mv packages/ui/scripts/gen-icons.mjs packages/icons/scripts/gen-icons.mjs
git mv packages/ui/scripts/icons/base.mjs packages/icons/scripts/lib/base.mjs
git mv packages/ui/scripts/icons/lib/* packages/icons/scripts/lib/
for f in packages/ui/scripts/icons/*.mjs; do git mv "$f" packages/ui/icons/; done
```

Then fix imports in the moved definition files: every `from './base.mjs'` becomes `from '../../icons/scripts/lib/base.mjs'`, and `from './lib/…'` becomes `from '../../icons/scripts/lib/…'`. Check with `grep -rn "from '\./" packages/ui/icons packages/icons/scripts/lib`: what is left must be a sibling that exists.

- [ ] **Step 2: Declare ui's table**

`packages/ui/icons/index.mjs`. Lift the `GROUPS` array, `RENAME` and `MARK_GROUP` out of the old generator unchanged; keep the group order, since it is the order the gallery shows:

```js
import { BASE } from './base-glyphs.mjs';
// …every import the old gen-icons.mjs had, now from './<file>.mjs'…

export const namespace = 'ui';
export const owner = '@weasel-js/ui';
export const rename = { zoom: 'zoomIn' };
export const markGroup = 'Marks';
export const groups = [
  ['View and lifecycle', BASE],
  ['Actions', ACTIONS],
  // …the rest of the old GROUPS, in order…
];
```

`BASE` was exported by `base.mjs` next to the helpers. Split it: the helpers stay in `packages/icons/scripts/lib/base.mjs`, and the `BASE` glyph set moves to `packages/ui/icons/base-glyphs.mjs`.

- [ ] **Step 3: Write the failing generator tests**

`packages/icons/scripts/gen-icons.test.ts`. The fixtures are two tiny packages under `packages/icons/scripts/fixtures/{alpha,beta}/icons/index.mjs`:

```js
// fixtures/alpha/icons/index.mjs
export const namespace = 'alpha';
export const owner = '@test/alpha';
export const groups = [['Things', { dot: '<circle cx="10" cy="10" r="2"/>', bar: { d: 'M4 10h12' } }, { tags: { dot: ['point'] } }]];
```

```js
// fixtures/beta/icons/index.mjs
export const namespace = 'beta';
export const owner = '@test/beta';
export const groups = [['Things', { dot: '<circle cx="9" cy="9" r="2"/>' }]];
```

```ts
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { generate } from './gen-icons.mjs';

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

describe('gen:icons', () => {
  it('builds one table per package, each name in its own namespace', async () => {
    const { tables } = await generate({ roots: [fixture('alpha'), fixture('beta')], write: false });
    expect(tables.map((t) => t.namespace)).toEqual(['alpha', 'beta']);
    expect(tables[0].icons.dot).toEqual({ body: '<circle cx="10" cy="10" r="2"/>', group: 'Things', tags: ['point'] });
    expect(tables[0].icons.bar.body).toBe('<path d="M4 10h12"/>');
    expect(tables[1].icons.dot.body).toBe('<circle cx="9" cy="9" r="2"/>');
  });

  it('refuses two packages declaring one namespace', async () => {
    await expect(generate({ roots: [fixture('alpha'), fixture('alpha-again')], write: false })).rejects.toThrow(/namespace "alpha" is declared by both/);
  });

  it('refuses one name drawn twice, differently, in a namespace', async () => {
    await expect(generate({ roots: [fixture('twice')], write: false })).rejects.toThrow(/icon "dot" is drawn twice/);
  });

  it('refuses an icons directory with no index.mjs', async () => {
    await expect(generate({ roots: [fixture('no-index')], write: false })).rejects.toThrow(/no index\.mjs/);
  });
});
```

Add fixtures `alpha-again` (a copy of `alpha` with `owner: '@test/other'`), `twice` (two groups each with a different `dot`), and `no-index` (an `icons/` directory holding one `.mjs` and no `index.mjs`).

- [ ] **Step 4: Run them to verify they fail**

Run: `onto do -- npx vitest run --project=weasel-ui packages/icons/scripts/gen-icons.test.ts`
Expected: FAIL, `generate is not a function`. The `weasel-ui` project collects `packages/**/*.test.{ts,tsx}`; confirm with `npm run check:test-projects` that it owns this file, and move it into the project that does if not.

- [ ] **Step 5: Rewrite the generator**

Keep the old file's `camel`, `clean`, `element`, `fillElement` and the mark-group stroke-width check unchanged; they move into `packages/icons/scripts/lib/emit.mjs` so the generator file stays small. The new `packages/icons/scripts/gen-icons.mjs`:

```js
// Emits each package's icon table and bound icon() from its icons/ definitions.
//
//   node packages/icons/scripts/gen-icons.mjs
//
// Proof a change before committing it: CLAUDE.md ("Drawing icons") requires
// inspecting at 240-320px, not at chrome size.

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { camel, element, fillElement, checkMark } from './lib/emit.mjs';
import { emitGen, emitTableModule } from './lib/modules.mjs';

const REPO = fileURLToPath(new URL('../../..', import.meta.url));

/** Every directory that owns icons: a package or an app with an icons/ directory. */
export function discover() {
  const roots = [];
  for (const parent of ['packages', 'apps']) {
    for (const name of readdirSync(join(REPO, parent))) {
      const dir = join(REPO, parent, name);
      if (existsSync(join(dir, 'icons'))) roots.push(dir);
    }
  }
  return roots;
}

async function readPackage(root) {
  const index = join(root, 'icons', 'index.mjs');
  if (!existsSync(index)) throw new Error(`${relative(REPO, root)}/icons has no index.mjs`);
  const def = await import(pathToFileURL(index).href);
  if (!def.namespace || !def.owner) throw new Error(`${relative(REPO, index)} must export namespace and owner`);
  return { root, ...def };
}

function buildTable(pkg) {
  const icons = {};
  const groups = [];
  for (const [label, set, opts = {}] of pkg.groups) {
    const names = [];
    groups.push({ label, names });
    for (const [rawKey, glyph] of Object.entries(set)) {
      if (rawKey.startsWith('_') || rawKey === 'attrs') continue;
      const key = camel(pkg.rename?.[rawKey] ?? rawKey);
      const body = element(glyph);
      const prior = icons[key];
      if (prior) {
        if (prior.body === body) continue;
        throw new Error(`icon "${key}" is drawn twice, differently, in "${pkg.namespace}" — rename one`);
      }
      if (label === pkg.markGroup) checkMark(key, body);
      const fill = fillElement(glyph);
      icons[key] = { body, ...(fill ? { fill } : {}), group: label, tags: opts.tags?.[rawKey] ?? [] };
      names.push(key);
    }
  }
  return { table: { namespace: pkg.namespace, owner: pkg.owner, icons }, groups };
}

/** Read every root's definitions and build its table; with `write`, emit the generated files. */
export async function generate({ roots = discover(), write = true } = {}) {
  const pkgs = await Promise.all(roots.map(readPackage));
  const owners = new Map();
  for (const p of pkgs) {
    const prior = owners.get(p.namespace);
    if (prior) throw new Error(`namespace "${p.namespace}" is declared by both ${prior} and ${relative(REPO, p.root)}`);
    owners.set(p.namespace, relative(REPO, p.root));
  }
  const built = pkgs.map((p) => ({ pkg: p, ...buildTable(p) }));
  if (write) {
    for (const { pkg, table, groups } of built) {
      const src = join(pkg.root, 'src');
      writeFileSync(join(src, 'icons.table.json'), JSON.stringify(table, null, 2) + '\n');
      writeFileSync(join(src, 'icons.table.ts'), emitTableModule(table));
      writeFileSync(join(src, 'icons.gen.ts'), emitGen(table, groups));
    }
    const manifest = built.map(({ table }) => ({
      namespace: table.namespace,
      owner: table.owner,
      names: Object.entries(table.icons).map(([name, g]) => ({ name, group: g.group, tags: g.tags })),
    }));
    writeFileSync(join(REPO, 'apps/site/src/icons.manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  }
  return { tables: built.map((b) => b.table) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { tables } = await generate();
  for (const t of tables) console.log(`${t.namespace}: ${Object.keys(t.icons).length} glyphs`);
}
```

`packages/icons/scripts/lib/modules.mjs`:

```js
const HEADER = '// GENERATED by packages/icons/scripts/gen-icons.mjs — do not edit by hand.\n';
const pascal = (ns) => ns.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());

export function emitTableModule(table) {
  return `${HEADER}
import type { IconTable } from '@weasel-js/icons';
import data from './icons.table.json';

/** Every glyph this package ships, under the \`${table.namespace}\` namespace. */
export const icons: IconTable = data;
`;
}

export function emitGen(table, groups) {
  const names = Object.keys(table.icons);
  const P = pascal(table.namespace);
  return `${HEADER}
import { scopedIcon } from '@weasel-js/icons';

/** A glyph this package draws, by its bare name. */
export type ${P}IconName =
${names.map((n) => `  | '${n}'`).join('\n')};

/** This package's \`icon()\`: a bare name means \`${table.namespace}:<name>\`. */
export const icon = scopedIcon<${P}IconName>('${table.namespace}');

/** This package's glyphs, in the families they were drawn in. */
export const ICON_GROUPS: readonly { label: string; names: readonly ${P}IconName[] }[] = ${JSON.stringify(groups, null, 2)};

declare module '@weasel-js/icons' {
  interface IconName {
${names.map((n) => `    '${table.namespace}:${n}': true;`).join('\n')}
  }
}
`;
}
```

`import data from './icons.table.json'` needs `resolveJsonModule`; check the root `tsconfig.json` has it and add it if not. The `as IconTable` assignment fails if JSON widening loses the `readonly` shape; if `tsc` complains, emit the data inline as an object literal in `icons.table.ts` instead of importing the JSON. Both files are generated, so neither drifts.

During this task, keep ui's old outputs alive so nothing downstream breaks yet: after `generate()`, also write the old `packages/ui/src/icons/generated/{paths,fills,groups}.ts` and core's `actionGlyphs.ts`, exactly as before, from ui's built table. Put that in `packages/icons/scripts/lib/legacy-ui.mjs` with a comment that Task 6 deletes it.

- [ ] **Step 6: Run the tests, then generate**

Run: `onto do -- npx vitest run --project=weasel-ui packages/icons/scripts/gen-icons.test.ts`
Expected: PASS.

Then locally: `npm run gen:icons`.
Expected: `ui: <N> glyphs`, with N equal to the old generator's count (it printed `wrote N glyphs`), and `git diff --stat packages/ui/src/icons/generated packages/core/src/interactions/actions/defaults/icons/actionGlyphs.ts` empty except for the header line naming the new script path.

- [ ] **Step 7: Commit, then run the branch on the fleet**

```bash
git add -A packages/icons packages/ui/icons packages/ui/scripts packages/ui/src package.json apps/site/src/icons.manifest.json packages/core/src/interactions/actions/defaults/icons/actionGlyphs.ts
git commit -m "generate icon tables per package from each one's icons/ definitions"
npm run test:fleet
```

Expected: green. The legacy outputs are byte-identical apart from the header, so nothing that reads them changes.

---

### Task 4: Convert the hand-drawn JSX icons into definitions

**Files:**
- Create: `packages/icons/scripts/jsx-to-defs.mjs` (one-off codemod; deleted at the end of this task)
- Create: `packages/core/icons/{index,tools,edit,align,distribute,boolean,path,anchor,outline}.mjs`
- Create: `packages/path-tools/icons/{index,tools,commands}.mjs`
- Create: `apps/draw/icons/{index,actions,tools}.mjs`
- Generated: `src/icons.gen.ts`, `src/icons.table.{ts,json}` in core, path-tools and `apps/draw`
- Test: `packages/icons/scripts/jsx-to-defs.test.ts` (deleted with the codemod)

**Interfaces:**
- Consumes: the `icons/index.mjs` contract from Task 3.
- Produces: tables `core`, `path-tools`, `draw`. Bare names are each component's name with `Icon` dropped and the first letter lowercased: `GroupIcon` → `group`, `ReversePathIcon` → `reversePath`, `AlignCenterXIcon` → `alignCenterX`. `CORE_GLYPHS` from the old generator (delete, undo, redo, measure, tune) move from ui's table into core's: they are core's icons, drawn with ui's helpers.

Sources to convert:

| Package | Files |
|---|---|
| core | `src/icons/*Icon.tsx` (not `_base.ts`, `types.ts`, `index.ts`), `src/interactions/actions/defaults/icons/{anchor,boolean,actionGlyph,path,align,edit,outline,distribute}Icons.tsx` |
| path-tools | `src/icons.tsx`, `src/commandIcons.tsx` |
| apps/draw | `src/actionIcons.tsx`, the glyphs inside `src/ui/ToolIcon/ToolIcon.tsx` |

- [ ] **Step 1: Write the failing codemod test**

The codemod renders each exported `…Icon` component with `react-dom/server`'s `renderToStaticMarkup`, strips the outer `<svg>`, and records the inner markup, so the definition is exactly what the component drew.

`packages/icons/scripts/jsx-to-defs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { svgBody, iconKey } from './jsx-to-defs.mjs';

describe('jsx-to-defs', () => {
  it('keeps the inner markup and drops the svg wrapper', () => {
    const Comp = () => createElement('svg', { viewBox: '0 0 20 20', fill: 'none' }, createElement('path', { d: 'M1 1h2', strokeWidth: 1 }));
    expect(svgBody(Comp)).toBe('<path d="M1 1h2" stroke-width="1"/>');
  });

  it('names a component by dropping Icon and lowering the first letter', () => {
    expect(iconKey('AlignCenterXIcon')).toBe('alignCenterX');
    expect(iconKey('ReversePathIcon')).toBe('reversePath');
  });

  it('refuses a component whose root is not a 20x20 svg', () => {
    const Comp = () => createElement('svg', { viewBox: '0 0 24 24' });
    expect(() => svgBody(Comp)).toThrow(/20x20/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `onto do -- npx vitest run --project=weasel-ui packages/icons/scripts/jsx-to-defs.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the codemod**

`packages/icons/scripts/jsx-to-defs.mjs`:

```js
// One-off: turns the hand-written JSX icon components into icons/*.mjs definitions.
// Run under vitest's transform (it imports .tsx), then delete it.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const ROOT = /^<svg([^>]*)>([\s\S]*)<\/svg>$/;

export function svgBody(Component, props = {}) {
  const html = renderToStaticMarkup(createElement(Component, props));
  const m = ROOT.exec(html);
  if (!m || !/viewBox="0 0 20 20"/.test(m[1])) throw new Error(`${Component.name || 'icon'} is not a 20x20 svg`);
  return m[2];
}

export const iconKey = (exportName) => exportName.replace(/Icon$/, '').replace(/^./, (c) => c.toLowerCase());

/** `{ key: body }` for every `…Icon` export of `mod`. */
export function bodies(mod) {
  return Object.fromEntries(
    Object.entries(mod)
      .filter(([name, v]) => name.endsWith('Icon') && typeof v === 'function')
      .map(([name, C]) => [iconKey(name), svgBody(C)]),
  );
}
```

An icon that takes props (state-aware, or a size) renders with its defaults. List every component whose props change its drawing (`grep -n "props\|({" <file>`); each gets one entry per state it is used in, keyed `<name>On`/`<name>Off` or similar, and its call sites in Task 6 pick by state.

Then a throwaway driver test, `packages/icons/scripts/jsx-to-defs.run.test.ts`, run once on the fleet: it imports each source module, calls `bodies`, and writes `packages/<pkg>/icons/<file>.mjs` as `export const EDIT = { cut: \`…\`, … };` with one module per source file. Fetch the written files back (`onto do` returns the tree's changes), check them in, and delete the driver.

- [ ] **Step 4: Write each package's `icons/index.mjs`**

```js
// packages/core/icons/index.mjs
import { TOOLS } from './tools.mjs';
import { EDIT } from './edit.mjs';
import { ALIGN } from './align.mjs';
import { DISTRIBUTE } from './distribute.mjs';
import { BOOLEAN } from './boolean.mjs';
import { PATH } from './path.mjs';
import { ANCHOR } from './anchor.mjs';
import { OUTLINE } from './outline.mjs';
import { HISTORY } from './history.mjs';

export const namespace = 'core';
export const owner = '@weasel-js/core';
export const groups = [
  ['Tools', TOOLS],
  ['Edit', EDIT],
  ['History', HISTORY],
  ['Align', ALIGN],
  ['Distribute', DISTRIBUTE],
  ['Booleans', BOOLEAN],
  ['Path commands', PATH],
  ['Anchors', ANCHOR],
  ['Outline', OUTLINE],
];
```

`history.mjs` holds delete, undo, redo, measure and tune, moved from ui's `actions.mjs`/`base-glyphs.mjs` with their drawing code (they use the shared helpers, so they stay computed, not pasted). Remove them from ui's sets. Do the same for `packages/path-tools/icons/index.mjs` (`namespace = 'path-tools'`, `owner = '@weasel-js/path-tools'`) and `apps/draw/icons/index.mjs` (`namespace = 'draw'`, `owner = 'apps/draw'`).

- [ ] **Step 5: Generate and check nothing collided**

Run locally: `npm run gen:icons`
Expected: one line each for `core`, `ui`, `path-tools` and `draw`, no error. A thrown "drawn twice" inside one namespace means two components drew the same name differently: rename the later one and note the rename for Task 6's call sites.

- [ ] **Step 6: Delete the codemod and commit**

```bash
git rm packages/icons/scripts/jsx-to-defs.mjs packages/icons/scripts/jsx-to-defs.test.ts
git add packages/core/icons packages/path-tools/icons apps/draw/icons packages/ui/icons packages/*/src/icons.* apps/draw/src/icons.* apps/site/src/icons.manifest.json
git commit -m "convert 93 hand-drawn icon components into core, path-tools and draw definitions"
npm run test:fleet
```

The components still exist and are still used, so the fleet run stays green. The tables are new and unread so far. Replace 93 in the subject with the count the generator printed for the three new namespaces.

---

### Task 5: ui draws from the registry

**Files:**
- Modify: `packages/ui/src/icons/Icon.tsx`, `packages/ui/src/icons/namedGlyph.tsx`, `packages/ui/src/icons/actionIcon.ts`, `packages/ui/src/icons/index.tsx`, `packages/ui/package.json` (dependency `@weasel-js/icons`, export `./icons`)
- Modify: every ui call site of `<Icon name="…">` and `IconName` (find with `grep -rln "<Icon\b\|IconName\|ICON_PATHS\|ICON_GROUPS\|MARK_ICONS" packages/ui/src packages/labkit/src packages/forge/src apps`)
- Modify: app roots: `apps/draw/src/main.tsx`, `apps/site/src/App.tsx` (or `Shell.tsx`, whichever wraps every route), forge's story frame (`packages/forge/src/shell/StoryTrial.tsx` and `IndexTrial.tsx`)
- Test: `packages/ui/src/icons/Icon.registry.browser.test.tsx`, updates to `packages/ui/src/icons/icons.test.tsx`

**Interfaces:**
- Consumes: `useIconGlyph`, `IconRegistryProvider`, `WeaselProvider` `icons` prop (Task 2); `icon`, `UiIconName`, `ICON_GROUPS` from `packages/ui/src/icons.gen.ts`; `icons` tables from each package's `icons.table.ts` (Tasks 3–4).
- Produces:
  - `<Icon name: IconRef; mark?: IconRef; …existing props>`
  - `resolveIcon(source: IconRef | string | undefined, size?: number): ReactNode` (replaces `namedGlyph`; `actionIcon` keeps its signature until Task 6)
  - `@weasel-js/ui/icons` export: `icons` (ui's table)
  - Placeholder: a missing ref draws `UnknownIcon`'s glyph in dev and `null` in production, warning once per ref in dev.

- [ ] **Step 1: Write the failing browser test**

`packages/ui/src/icons/Icon.registry.browser.test.tsx`:

```tsx
import { render } from 'vitest-browser-react';
import { describe, expect, it, vi } from 'vitest';
import { IconRegistryProvider } from '@weasel-js/core';
import { icons as uiIcons } from '../icons.table';
import { icon } from '../icons.gen';
import { Icon } from './Icon';

describe('<Icon> from the registry', () => {
  it('draws the glyph the registry holds', async () => {
    const screen = render(<IconRegistryProvider icons={uiIcons}><Icon name={icon('close')} label="Close" /></IconRegistryProvider>);
    const svg = screen.getByRole('img', { name: 'Close' }).element() as SVGSVGElement;
    expect(svg.innerHTML).toBe(uiIcons.icons.close!.body);
    expect(svg.getBBox().width).toBeGreaterThan(0);
  });

  it('draws the placeholder for a name the registry lacks, warning once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const screen = render(
      <IconRegistryProvider icons={uiIcons}>
        <Icon name={'ui:nope' as never} label="A" />
        <Icon name={'ui:nope' as never} label="B" />
      </IconRegistryProvider>,
    );
    const svg = screen.getByRole('img', { name: 'A' }).element() as SVGSVGElement;
    expect(svg.querySelector('circle')).not.toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toMatch(/ui:nope/);
  });

  it('composes a mark from the registry', async () => {
    const screen = render(<IconRegistryProvider icons={uiIcons}><Icon name={icon('close')} mark={icon('add')} label="M" /></IconRegistryProvider>);
    expect((screen.getByRole('img', { name: 'M' }).element() as SVGSVGElement).querySelector('mask')).not.toBeNull();
  });
});
```

Check `vitest-browser-react` is what the existing `Icon.mark.browser.test.tsx` imports and mirror its imports exactly. `getBBox().width > 0` is the check that the browser actually drew something, which jsdom cannot make.

- [ ] **Step 2: Run it to verify it fails**

Run: `onto do -- npx vitest run --project=browser packages/ui/src/icons/Icon.registry.browser.test.tsx`
Expected: FAIL. `<Icon>` still reads `ICON_PATHS`, and `name` is typed `IconName`.

- [ ] **Step 3: Rewrite `<Icon>`**

In `Icon.tsx`, replace the `ICON_PATHS`/`ICON_FILLS` reads with the registry:

```tsx
import { useIconGlyph } from '@weasel-js/core';
import type { IconRef } from '@weasel-js/icons';
import { PLACEHOLDER_BODY, warnMissing } from './placeholder';

export function Icon({ name, className, size = 20, label, filled = false, fillOpacity = 0.16, mark }: IconProps & { name: IconRef }) {
  const glyph = useIconGlyph(name);
  const markGlyph = useIconGlyph(mark);
  const maskId = useId();
  if (!glyph) warnMissing(name);
  const shade = filled && glyph?.fill ? glyph.fill : '';
  const body = glyph ? shade + glyph.body : PLACEHOLDER_BODY;
  const html = markGlyph ? inset(body, markGlyph.body, ICON_SLOTS.mark, maskId) : body;
  const markup = useMemo(() => ({ __html: html }), [html]);
  if (!glyph && !import.meta.env.DEV) return null;
  // …the existing <svg> element, unchanged…
}
```

`isFillable(name)` becomes `isFillable(glyph: IconGlyph | undefined): boolean` (`glyph?.fill !== undefined`); update its callers. `IconProps.mark` becomes `IconRef`. The hooks must run before the early `return null`, as above.

`packages/ui/src/icons/placeholder.ts`:

```ts
/** `UnknownIcon`'s drawing: a circle with a question mark. Shown in dev where a name resolves to nothing. */
export const PLACEHOLDER_BODY =
  '<circle cx="10" cy="10" r="7"/><path d="M8.2 8.2a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.6"/><circle cx="10" cy="14" r=".6" fill="currentColor" stroke="none"/>';

const warned = new Set<string>();
/** Warn once per ref, in dev only. */
export function warnMissing(ref: string | undefined): void {
  if (!import.meta.env.DEV || !ref || warned.has(ref)) return;
  warned.add(ref);
  console.warn(`weasel: no icon "${ref}" is registered. Is its package's table in <WeaselProvider icons>, or its variant loaded?`);
}
```

Copy `PLACEHOLDER_BODY` from `packages/core/src/icons/UnknownIcon.tsx`'s actual markup rather than using the approximation above. `warned` is module state, but it is a dev-only dedupe of a console message, not a registry; leave it.

- [ ] **Step 4: Fold `namedGlyph` into `resolveIcon`**

`namedGlyph.tsx` becomes:

```tsx
import type { ReactNode } from 'react';
import { toIconRef, type IconRef } from '@weasel-js/icons';
import { Icon } from './Icon';

/** A ref, or a string read from data, as a glyph. A bare or malformed string draws nothing. */
export function resolveIcon(source: IconRef | string | undefined, size = 14): ReactNode {
  const ref = toIconRef(source);
  return ref ? <Icon name={ref} size={size} /> : undefined;
}
```

Rename every `namedGlyph(` call to `resolveIcon(` (`grep -rln namedGlyph packages apps`). Delete `isIconName`; its one caller (`PaintInput.tsx`) uses `toIconRef(icon) !== undefined`.

- [ ] **Step 5: Qualify every name ui and its neighbors write**

Mechanical rewrites; run each and read the diff before committing:

```bash
# <Icon name="close"> inside ui → <Icon name={icon('close')}>
grep -rl '<Icon[^>]* name="' packages/ui/src | xargs perl -pi -e 's/(<Icon\b[^>]*?\bname=)"([A-Za-z0-9]+)"/$1\{icon(\x27$2\x27)\}/g'
```

Each rewritten ui file gains `import { icon } from '<relative>/icons.gen';`; add them with the editor's organize-imports or by hand. Outside ui (labkit, forge, apps, site demos) the same rewrite produces `icon('ui:close')` with the consumer's own `icon()`, or with `toIconRef` where the consumer has no icons of its own. Schemas: every `icon: '<name>'` in a prefs schema literal becomes `icon: icon('ui:<name>')` (`grep -rn "icon: '" packages apps --include='*.ts' --include='*.tsx'`). `Palette.tsx`'s `IconName`-typed fields become `IconRef`.

The `…Icon` wrappers in `packages/ui/src/icons/index.tsx` (`CloseIcon = (p) => <Icon name="close" {...p} />`) stay for now, rewritten to `name={icon('close')}`; Task 6 removes them with the rest.

- [ ] **Step 6: Give every app root a provider**

Without plugin output yet, pass the tables by hand. Task 8 swaps these for `virtual:weasel-icons`.

```tsx
// apps/draw/src/main.tsx (around the existing <App />)
import { WeaselProvider } from '@weasel-js/core';
import { icons as coreIcons } from '@weasel-js/core/icons';
import { icons as uiIcons } from '@weasel-js/ui/icons';
import { icons as pathToolsIcons } from '@weasel-js/path-tools/icons';
import { icons as drawIcons } from './icons.table';

const ICONS = [coreIcons, uiIcons, pathToolsIcons, drawIcons];
// …
<WeaselProvider icons={ICONS}><App /></WeaselProvider>
```

Add an `./icons` export to core's, ui's and path-tools' `package.json` (`"./icons": { "import": "./dist/icons.js", "types": "./dist/icons.d.ts" }`), a matching build entry (`icons: 'src/icons.table.ts'` in tsup's `entry`; for ui's vite library build, its `lib.entry` map), a `tsconfig.json` paths entry for each, and `"weaselIcons": { "table": "./dist/icons.table.json" }` in each `package.json`, with a build step copying `src/icons.table.json` to `dist/`. Do the same for the site root and for forge's two story frames. `WeaselProvider` mounts the other kit providers if-root as well; check that wrapping `apps/draw`'s root in it changes nothing else about scope by reading `WeaselProvider.tsx`: every provider it mounts defers to a parent, and none is in scope above an app root.

- [ ] **Step 7: Fix the jsdom tests that read glyphs**

`icons.test.tsx` and any test asserting on an icon's markup now see the placeholder. Wrap those renders: `render(ui, { wrapper: ({ children }) => <IconRegistryProvider icons={uiIcons}>{children}</IconRegistryProvider> })`. Put that wrapper in `packages/ui/src/test/withIcons.tsx` (export `withIcons`) rather than repeating it.

- [ ] **Step 8: Run the targeted tests, then the branch**

Run: `onto do -- npx vitest run --project=browser packages/ui/src/icons && onto do -- npx vitest run --project=weasel-ui packages/ui/src/icons`
Expected: PASS.

Commit, then `npm run test:fleet`. Expected: green. Failures from tests that assert on glyph markup get `withIcons`; a failure anywhere else is a real regression.

- [ ] **Step 9: Screenshot**

Start the site dev server (`WAKE_EXTRA=<port>` per CLAUDE.md if one is running) and use the headless playwright MCP to screenshot the icons gallery story and one WeaselDraw toolbar. `transom post` both images (zone `weasel`). An icon showing as a circle with a question mark is a missing registration.

- [ ] **Step 10: Commit**

```bash
git add -A packages/ui packages/labkit packages/forge apps packages/core/package.json packages/path-tools/package.json tsconfig.json
git commit -m "draw every ui icon from the registry, by qualified name"
```

---

### Task 6: Names everywhere; remove the components

**Files:**
- Modify: `packages/routing/src/interactions/actions/action.ts:42,74`, `packages/routing/src/interactions/actions/actionItems.ts:17`, `packages/routing/src/contributions/types.ts:27` (`ToolPresentation.icon`), `packages/routing/src/menus/resolveMenu.ts`, `packages/routing/package.json`
- Modify: `packages/prefs/src/schema.ts:76,199`, `packages/prefs/package.json`
- Modify: every `icon: createElement(XIcon)` / `icon: <XIcon />` in core, path-tools and apps/draw (`grep -rnE "icon: (createElement\(|<)[A-Z]\w*Icon" packages apps`)
- Modify: `packages/ui/src/icons/actionIcon.ts`, `packages/ui/src/components/ContextMenu/MenuRow.tsx`, `packages/ui/src/components/Prefs/useLeafAction.tsx`, `packages/ui/src/components/PrefSchemaEditor/editorActions.ts`
- Delete: `packages/core/src/icons/*Icon.tsx`, `_base.ts`, `types.ts`, the `defaults/icons/*Icons.tsx` files, `actionGlyphs.ts`, `packages/path-tools/src/{icons,commandIcons,iconBase}.tsx`, `apps/draw/src/actionIcons.tsx`, `packages/ui/src/icons/generated/`, the `…Icon` wrappers in `packages/ui/src/icons/index.tsx`, `packages/icons/scripts/lib/legacy-ui.mjs`
- Modify: `packages/core/src/barrel/icons.ts`, `packages/path-tools/src/index.ts`, `scripts/check-size.allow.json` (lower or drop entries for deleted files with `npm run check:size -- --update`)

**Interfaces:**
- Consumes: each package's `icon()` (Tasks 3–4), `resolveIcon` (Task 5).
- Produces:
  - `Action.icon?: IconRef`, `ActionVariant.icon?: IconRef`, `ActionItem.icon?: IconRef`, `ToolPresentation.icon?: IconRef`, `PrefBase.icon?: IconRef`, `PrefChoice.icon?: IconRef`
  - `actionIcon(icon: IconRef | undefined, size?: number): ReactNode` (wraps `resolveIcon`)

- [ ] **Step 1: Write the failing type tests**

`packages/routing/src/interactions/actions/actionIcon.typetest.ts` (collected by `typecheck`, not by vitest):

```ts
import type { Action } from './action';
import type { IconRef } from '@weasel-js/icons';

declare const ref: IconRef;
const ok: Pick<Action, 'icon'> = { icon: ref };
// @ts-expect-error a bare string is not a ref
const bare: Pick<Action, 'icon'> = { icon: 'group' };
// @ts-expect-error a node is no longer an icon
const node: Pick<Action, 'icon'> = { icon: {} as import('react').ReactNode };
void ok; void bare; void node;
```

Same shape for `PrefBase.icon` in `packages/prefs/src/schemaIcon.typetest.ts`. Check that the root `tsconfig.json`'s `include` covers both paths.

- [ ] **Step 2: Verify they fail**

Commit the two files on the branch, then run `onto do -- npm run typecheck`.
Expected: FAIL, "Unused '@ts-expect-error' directive" on both `bare` lines (a bare string is still accepted), and on `node` in routing.

- [ ] **Step 3: Change the types**

`action.ts` lines 42 and 74, `actionItems.ts:17`, `contributions/types.ts:27`:

```ts
import type { IconRef } from '@weasel-js/icons';
// …
  /** The action's icon, by qualified name: `icon('group')` in the package that draws it. */
  icon?: IconRef;
```

`schema.ts:76` and `:199`: `icon?: IconRef;`. Replace the doc comment's "a plain string because this package ships no icon set" with: "A name from `@weasel-js/icons`; this package draws nothing." Add `"@weasel-js/icons": "1.10.1"` to routing's and prefs' `dependencies`.

- [ ] **Step 4: Rewrite every icon site to a name**

```bash
grep -rlE "icon: (createElement\(|<)[A-Z]\w*Icon" packages apps \
  | xargs perl -pi -e 's/icon: createElement\(([A-Z]\w*)Icon\)/"icon: icon(\x27" . lcfirst($1) . "\x27)"/ge; s/icon: <([A-Z]\w*)Icon \/>/"icon: icon(\x27" . lcfirst($1) . "\x27)"/ge'
```

Read the diff. `ICON_FOR[op]` maps (`booleans/action.tsx`, `align/action.tsx`, `distribute/action.tsx`) hold components: rewrite each map's values to `icon('…')` by hand. Every icon one package borrows from another becomes a qualified name: `useTrimTool` borrowing `SliceIcon` is `icon('core:slice')`. Each rewritten file imports `icon` from its package's `icons.gen`. Remove the now-unused `…Icon` imports and `createElement` where it was only used for icons.

State-aware icons (Task 4, Step 3) become a name chosen by state: `icon: () => icon(on ? 'gridOn' : 'gridOff')` is not allowed any more (no thunks), so the action reads its state where it is rendered, or declares two variants. Look at each one; if none fits, raise it rather than reintroducing thunks.

`actionIcon.ts`:

```ts
import type { ReactNode } from 'react';
import type { IconRef } from '@weasel-js/icons';
import { resolveIcon } from './namedGlyph';

/** The node to draw for an action's icon. */
export function actionIcon(icon: IconRef | undefined, size = 16): ReactNode {
  return resolveIcon(icon, size);
}
```

Delete `ActionIconSource`. `MenuRow.tsx`, `useLeafAction.tsx` and `editorActions.ts` drop their casts.

- [ ] **Step 5: Delete the components and the legacy outputs**

Delete the files listed above. Remove `legacy-ui.mjs`'s call from `gen-icons.mjs`. Remove the `…Icon` export blocks from `packages/core/src/barrel/icons.ts`, `packages/path-tools/src/index.ts` and `packages/ui/src/icons/index.tsx` (keep `Icon`, `isFillable`, `resolveIcon`, `actionIcon`). Run `npm run gen:icons` and `npm run check:size -- --update` locally.

The site and labkit use `…Icon` components directly in places (`grep -rnE "\b[A-Z]\w+Icon\b" apps packages/labkit packages/forge`); each becomes `<Icon name={toIconRef('ui:…')!} />` or the consumer's own `icon()`.

- [ ] **Step 6: Run the typecheck, then the branch**

Run: `onto do -- npm run typecheck`
Expected: PASS, with both type tests now satisfied.

Commit, then `npm run test:fleet`. Expected: green. Then `onto do -- npm run test:smoke:consumer`: deleted exports must not be imported by any packed package.

- [ ] **Step 7: Commit**

```bash
git add -A packages apps scripts/check-size.allow.json
git commit -m "name every action, tool and pref icon; remove the icon components"
```

---

### Task 7: The `weaselIcons` plugin

**Files:**
- Create: `packages/icons/src/plugin/{index,rewrite,collect,tables,virtual}.ts`, `packages/icons/virtual.d.ts`
- Modify: `packages/icons/package.json` (dependencies `unplugin`, `magic-string`; export `./plugin`), `packages/icons/tsup.config.ts` (entry `plugin`)
- Test: `packages/icons/src/plugin/rewrite.test.ts`, `packages/icons/src/plugin/collect.test.ts`, `packages/icons/src/plugin/plugin.build.test.ts`, fixture `packages/icons/src/plugin/fixtures/app/`
- Modify: `vitest.config.ts` (the build test goes in `forge-node`, on the threads pool: rolldown's native binding rejects a foreign `RegExp`, per CLAUDE.md)

**Interfaces:**
- Consumes: `IconTable` (Task 1), the generated `icons.gen.ts` shape (Task 3), the `weaselIcons.table` package field (Task 5).
- Produces:
  - `weaselIcons: UnpluginInstance<WeaselIconsOptions>` with `.vite`, `.rolldown`, `.esbuild`
  - `interface WeaselIconsOptions { mode: 'library' | 'app'; variants?: Record<string, { namespaces?: string[]; groups?: string[]; tags?: string[] }> }`
  - `rewriteIconCalls(code: string, id: string, namespaceOf: (specifier: string) => string | undefined): { code: string; map: SourceMap; dynamic: number } | null`
  - `collectIconRefs(code: string): string[]`
  - Virtual ids: `virtual:weasel-icons`, `virtual:weasel-icons/all`, `virtual:weasel-icons/<namespace>`, `virtual:weasel-icons/<custom>`

- [ ] **Step 1: Prove unplugin's esbuild output works under tsup**

Before writing the plugin, a spike that is thrown away: a five-line `unplugin` with only a `transform` that replaces `__PROBE__` with `'ok'`, wired into a scratch tsup config building one file. Run it on the fleet: `onto do -- npx tsup --config <scratch>/tsup.config.ts`. Expected: the built file contains `'ok'`. If it does not, stop and report: the spec allows a separate esbuild adapter only in that case. Delete the spike.

- [ ] **Step 2: Write the failing rewrite and collect tests**

`packages/icons/src/plugin/rewrite.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { rewriteIconCalls } from './rewrite';

const ns = (spec: string) => (spec.endsWith('icons.gen') ? 'core' : undefined);

describe('rewriteIconCalls', () => {
  it('qualifies and annotates a bare name imported from icons.gen', () => {
    const src = `import { icon } from '../icons.gen';\nexport const a = { icon: icon('undo') };\n`;
    expect(rewriteIconCalls(src, 'a.ts', ns)!.code).toContain(`icon: /* @icon */ 'core:undo'`);
  });

  it('keeps a qualified name as written', () => {
    const src = `import { icon } from './icons.gen';\nconst b = icon("ui:close");\n`;
    expect(rewriteIconCalls(src, 'b.ts', ns)!.code).toContain(`/* @icon */ 'ui:close'`);
  });

  it('follows an alias of the import', () => {
    const src = `import { icon as glyph } from './icons.gen';\nconst c = glyph('redo');\n`;
    expect(rewriteIconCalls(src, 'c.ts', ns)!.code).toContain(`/* @icon */ 'core:redo'`);
  });

  it('leaves a module that imports no icons.gen alone', () => {
    expect(rewriteIconCalls(`const icon = (s) => s; icon('x');`, 'd.ts', ns)).toBeNull();
  });

  it('leaves a dynamic call as a call, and counts it', () => {
    const src = `import { icon } from './icons.gen';\nconst e = icon(name);\n`;
    const out = rewriteIconCalls(src, 'e.ts', ns)!;
    expect(out.code).toContain('icon(name)');
    expect(out.dynamic).toBe(1);
  });
});
```

`packages/icons/src/plugin/collect.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { collectIconRefs } from './collect';

describe('collectIconRefs', () => {
  it('finds annotated literals in either quote style, and nothing else', () => {
    const code = `a(/* @icon */ 'core:undo'); b(/* @icon */"ui:close"); c('core:redo');`;
    expect(collectIconRefs(code).sort()).toEqual(['core:undo', 'ui:close']);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `onto do -- npx vitest run --project=weasel-ui packages/icons/src/plugin`
Expected: FAIL, modules not found.

- [ ] **Step 4: Implement rewrite and collect**

`packages/icons/src/plugin/rewrite.ts`:

```ts
import MagicString from 'magic-string';
import { qualify } from '../names';

const IMPORT = /import\s*\{([^}]*)\}\s*from\s*(['"])([^'"]*icons\.gen(?:\.[jt]s)?)\2/g;
const LITERAL_ARG = /^\s*(['"])([^'"\s]+)\1\s*$/;

/** Rewrite each `icon('x')` imported from a generated icons.gen into an annotated, qualified literal. */
export function rewriteIconCalls(code: string, id: string, namespaceOf: (specifier: string) => string | undefined) {
  const locals = new Map<string, string>();
  for (const m of code.matchAll(IMPORT)) {
    const namespace = namespaceOf(m[3]!);
    if (!namespace) continue;
    for (const part of m[1]!.split(',')) {
      const [imported, local = imported] = part.trim().split(/\s+as\s+/);
      if (imported === 'icon' && local) locals.set(local.trim(), namespace);
    }
  }
  if (locals.size === 0) return null;
  const s = new MagicString(code);
  let dynamic = 0;
  const call = new RegExp(`\\b(${[...locals.keys()].join('|')})\\(([^()]*)\\)`, 'g');
  for (const m of code.matchAll(call)) {
    const arg = LITERAL_ARG.exec(m[2]!);
    if (!arg) {
      dynamic++;
      continue;
    }
    const ref = qualify(locals.get(m[1]!)!, arg[2]!);
    s.overwrite(m.index!, m.index! + m[0].length, `/* @icon */ '${ref}'`);
  }
  return { code: s.toString(), map: s.generateMap({ source: id, hires: true }), dynamic };
}
```

`packages/icons/src/plugin/collect.ts`:

```ts
const ANNOTATED = /\/\*\s*@icon\s*\*\/\s*(['"])([^'"]+)\1/g;

/** Every qualified ref the module names through an `@icon` annotation. */
export function collectIconRefs(code: string): string[] {
  return [...code.matchAll(ANNOTATED)].map((m) => m[2]!);
}
```

- [ ] **Step 5: Run them to verify they pass**

Run: `onto do -- npx vitest run --project=weasel-ui packages/icons/src/plugin`
Expected: PASS.

- [ ] **Step 6: Write the failing build test**

The fixture is a tiny app: `fixtures/app/src/main.ts` importing `icon` from its own `src/icons.gen.ts` (namespace `fx`), calling `icon('dot')`, plus a `node_modules/@fx/lib` package whose `dist/index.js` contains `/* @icon */ 'lib:star'` and whose `package.json` has `"weaselIcons": { "table": "./dist/icons.table.json" }` with two glyphs, `star` and `moon`. The app's `src/icons.table.json` holds `dot` and `ring`.

`packages/icons/src/plugin/plugin.build.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import { weaselIcons } from './index';

const root = fileURLToPath(new URL('./fixtures/app', import.meta.url));

async function bundle(options = {}, minify = false) {
  const out = await build({
    root, logLevel: 'silent', configFile: false,
    plugins: [weaselIcons.vite({ mode: 'app', ...options })],
    build: { write: false, minify, rollupOptions: { input: `${root}/src/main.ts` } },
  });
  const chunks = (Array.isArray(out) ? out[0] : out).output.filter((o) => o.type === 'chunk');
  return chunks.map((c) => c.code).join('\n');
}

describe('weaselIcons app mode', () => {
  it('ships exactly the glyphs the build names', async () => {
    const code = await bundle();
    expect(code).toContain('fx-dot-body');
    expect(code).toContain('lib-star-body');
    expect(code).not.toContain('fx-ring-body');
    expect(code).not.toContain('lib-moon-body');
  });

  it('survives minification', async () => {
    const code = await bundle({}, true);
    expect(code).toContain('lib-star-body');
    expect(code).not.toContain('__WEASEL_ICONS__');
  });

  it('builds the all variant as its own chunk with every glyph', async () => {
    const code = await bundle();
    for (const body of ['fx-dot-body', 'fx-ring-body', 'lib-star-body', 'lib-moon-body']) expect(code).toContain(body);
  });

  it('filters a custom variant by tag', async () => {
    const code = await bundle({ variants: { round: { tags: ['round'] } } });
    expect(code).toContain('"fx:ring"');
  });

  it('fails on a namespace no package provides, naming the module', async () => {
    await expect(bundle({}, false).then(() => build({
      root, logLevel: 'silent', configFile: false,
      plugins: [weaselIcons.vite({ mode: 'app' })],
      build: { write: false, rollupOptions: { input: `${root}/src/missing.ts` } },
    }))).rejects.toThrow(/no package in this build provides the icon namespace "gone".*missing\.ts/s);
  });
});
```

Glyph bodies in the fixture are `<path data-id="fx-dot-body"/>` and so on, so the assertions read plainly. `main.ts` must also `import('virtual:weasel-icons/all')` for the all-variant test to see that chunk. `ring` carries tag `round`. `missing.ts` contains `/* @icon */ 'gone:x'`.

- [ ] **Step 7: Run it to verify it fails**

Run: `onto do -- npx vitest run --project=forge-node packages/icons/src/plugin/plugin.build.test.ts`
Expected: FAIL, `weaselIcons` not exported.

- [ ] **Step 8: Implement the plugin**

`packages/icons/src/plugin/tables.ts`:

```ts
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { IconTable } from '../table';

const read = (file: string): IconTable => JSON.parse(readFileSync(file, 'utf8'));

/** The table beside a generated icons.gen module. */
export function tableBeside(genFile: string): IconTable | undefined {
  const file = join(dirname(genFile), 'icons.table.json');
  return existsSync(file) ? read(file) : undefined;
}

/** The namespace a generated icons.gen module binds, read from its scopedIcon call. */
export function namespaceIn(genFile: string): string | undefined {
  return /scopedIcon<[^>]*>\('([^']+)'\)/.exec(readFileSync(genFile, 'utf8'))?.[1];
}

/** Every installed package declaring a table, one level under node_modules and under each scope. */
export function installedTables(root: string): IconTable[] {
  const nm = join(root, 'node_modules');
  if (!existsSync(nm)) return [];
  const dirs = readdirSync(nm).flatMap((d) =>
    d.startsWith('@') ? readdirSync(join(nm, d)).map((s) => join(nm, d, s)) : [join(nm, d)],
  );
  const out: IconTable[] = [];
  for (const dir of dirs) {
    const pkgFile = join(dir, 'package.json');
    if (!existsSync(pkgFile)) continue;
    const table = JSON.parse(readFileSync(pkgFile, 'utf8')).weaselIcons?.table;
    if (table && existsSync(join(dir, table))) out.push(read(join(dir, table)));
  }
  return out;
}
```

`packages/icons/src/plugin/virtual.ts`:

```ts
import type { IconTable } from '../table';

export const PREFIX = 'virtual:weasel-icons';
export const RESOLVED = '\0' + PREFIX;
/** A string literal survives minification; an identifier would be renamed. */
export const marker = (variant: string) => `"__WEASEL_ICONS__:${variant}"`;
export const moduleFor = (variant: string) => `export default JSON.parse(${marker(variant)});`;

export interface VariantFilter { namespaces?: string[]; groups?: string[]; tags?: string[] }

/** `tables` cut down to the refs in `keep`, or to what `filter` admits. */
export function subset(tables: readonly IconTable[], keep: (ns: string, name: string, tags: readonly string[], group: string) => boolean): IconTable[] {
  return tables
    .map((t) => ({ ...t, icons: Object.fromEntries(Object.entries(t.icons).filter(([n, g]) => keep(t.namespace, n, g.tags, g.group))) }))
    .filter((t) => Object.keys(t.icons).length > 0);
}

export function admits(f: VariantFilter) {
  return (ns: string, _name: string, tags: readonly string[], group: string) =>
    (!f.namespaces || f.namespaces.includes(ns)) &&
    (!f.groups || f.groups.includes(group)) &&
    (!f.tags || f.tags.some((t) => tags.includes(t)));
}
```

`packages/icons/src/plugin/index.ts`:

```ts
import { createUnplugin } from 'unplugin';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { splitIconRef } from '../names';
import type { IconTable } from '../table';
import { collectIconRefs } from './collect';
import { rewriteIconCalls } from './rewrite';
import { installedTables, namespaceIn, tableBeside } from './tables';
import { PREFIX, RESOLVED, admits, marker, moduleFor, subset, type VariantFilter } from './virtual';

export interface WeaselIconsOptions {
  mode: 'library' | 'app';
  variants?: Record<string, VariantFilter>;
}

const SOURCE = /\.[cm]?[jt]sx?$/;

export const weaselIcons = createUnplugin((options: WeaselIconsOptions) => {
  const refs = new Map<string, string>(); // ref → first module naming it
  const sourceTables = new Map<string, IconTable>();
  let root = process.cwd();
  let dev = false;

  const genFile = (specifier: string, importer: string) => {
    const base = resolve(dirname(importer), specifier);
    return ['.ts', '.js', ''].map((e) => base + e).find(existsSync);
  };
  const allTables = () => {
    const byNs = new Map<string, IconTable>();
    for (const t of [...installedTables(root), ...sourceTables.values()]) byNs.set(t.namespace, t);
    return [...byNs.values()];
  };
  const variantTables = (variant: string): IconTable[] => {
    const all = allTables();
    if (variant === 'used') {
      if (dev) return all;
      return subset(all, (ns, name) => refs.has(`${ns}:${name}`));
    }
    if (variant === 'all') return all;
    const custom = options.variants?.[variant];
    if (custom) return subset(all, admits(custom));
    return all.filter((t) => t.namespace === variant);
  };

  return {
    name: 'weasel-icons',
    enforce: 'pre',
    transformInclude: (id) => SOURCE.test(id) && !id.startsWith('\0'),
    transform(code, id) {
      const out = rewriteIconCalls(code, id, (spec) => {
        const file = genFile(spec, id);
        if (!file) return undefined;
        const table = tableBeside(file);
        if (table) sourceTables.set(table.namespace, table);
        return namespaceIn(file);
      });
      if (out && out.dynamic > 0) this.warn(`${id}: ${out.dynamic} icon() call(s) with a computed name; those resolve only from a loaded variant`);
      if (options.mode === 'app') for (const ref of collectIconRefs(out?.code ?? code)) if (!refs.has(ref)) refs.set(ref, id);
      return out ? { code: out.code, map: out.map } : null;
    },
    resolveId: (id) => (id === PREFIX || id.startsWith(PREFIX + '/') ? '\0' + id : null),
    load(id) {
      if (!id.startsWith(RESOLVED)) return null;
      const variant = id === RESOLVED ? 'used' : id.slice(RESOLVED.length + 1);
      return dev ? `export default ${JSON.stringify(variantTables(variant))};` : moduleFor(variant);
    },
    vite: {
      configResolved(config) {
        root = config.root;
        dev = config.command === 'serve' || config.mode === 'test';
      },
      generateBundle(_opts, bundle) {
        const all = allTables();
        for (const [ref, from] of refs) {
          const parts = splitIconRef(ref);
          const table = parts && all.find((t) => t.namespace === parts.namespace);
          if (!table) this.error(`no package in this build provides the icon namespace "${parts?.namespace}" (named in ${from})`);
          if (!table.icons[parts.name]) this.error(`icon "${ref}" is not in ${table.owner}'s table (named in ${from})`);
        }
        for (const file of Object.values(bundle)) {
          if (file.type !== 'chunk') continue;
          file.code = file.code.replace(/"__WEASEL_ICONS__:([^"]+)"/g, (_, variant: string) =>
            JSON.stringify(JSON.stringify(variantTables(variant))),
          );
        }
      },
    },
  };
});
```

Mind the details this sketch leaves for the implementation to get right:
- Under rolldown, `generateBundle` in the `vite` hook object may need to be the top-level `rolldown` / `rollup` hook instead. Check unplugin's docs for vite 8, and make the build test the arbiter.
- Rewriting chunk code after sourcemaps were generated shifts the columns on the replaced line. The replaced text is a single JSON string on one line, so only that line's mappings go stale. Acceptable; note it in the code.
- A custom variant name that equals a namespace or `all` must throw at plugin construction.
- `marker` is only used outside dev, so the dev branch of `load` never emits a placeholder.

`packages/icons/virtual.d.ts`:

```ts
declare module 'virtual:weasel-icons' {
  const tables: readonly import('@weasel-js/icons').IconTable[];
  export default tables;
}
declare module 'virtual:weasel-icons/*' {
  const tables: readonly import('@weasel-js/icons').IconTable[];
  export default tables;
}
```

Add `"./plugin": { "import": "./dist/plugin.js", "types": "./dist/plugin.d.ts" }` to the package's exports, `plugin: 'src/plugin/index.ts'` to tsup's entry, `"unplugin"` and `"magic-string"` to `dependencies` (exact versions, current at install time), and `vite` as an optional peer. `check:react-free` covers `dist/index.js` only. The plugin entry imports `node:fs`, so it must never be reachable from `index.ts`: add an assertion to `check:react-free`'s neighbor, or a short unit test that `index.ts`'s import graph contains no `plugin/`.

- [ ] **Step 9: Run the build test to verify it passes**

Run: `onto do -- npx vitest run --project=forge-node packages/icons/src/plugin`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/icons vitest.config.ts package-lock.json
git commit -m "add the weaselIcons build plugin: annotate icon() calls, ship only the glyphs a build names"
```

---

### Task 8: Wire the plugin into every build

**Files:**
- Modify: `scripts/tsup-preset.ts` (add `esbuildPlugins: [weaselIcons.esbuild({ mode: 'library' })]`)
- Modify: `packages/ui/vite.config.ts` and `packages/core/vite.config.ts` (library builds that use vite: `weaselIcons.vite({ mode: 'library' })`)
- Modify: `apps/draw/vite.config.ts`, root `vite.config.ts` (site), forge's vite config: `weaselIcons.vite({ mode: 'app' })`
- Modify: `apps/draw/src/main.tsx`, the site root, forge's story frames: swap the hand-passed tables for `virtual:weasel-icons` plus `iconVariants`
- Modify: `vite-env.d.ts` files of each app: `/// <reference types="@weasel-js/icons/virtual" />`
- Test: extend `packages/icons/src/plugin/plugin.build.test.ts` with a tsup library build

**Interfaces:**
- Consumes: `weaselIcons` (Task 7), `WeaselProvider` `icons` / `iconVariants` (Task 2).

- [ ] **Step 1: Write the failing library-mode test**

Append to `plugin.build.test.ts`:

```ts
import { build as tsup } from 'tsup';
import { readFileSync } from 'node:fs';

describe('weaselIcons library mode', () => {
  it('ships annotated, qualified literals in dist and no icon() call', async () => {
    const lib = fileURLToPath(new URL('./fixtures/lib', import.meta.url));
    await tsup({
      entry: [`${lib}/src/index.ts`], outDir: `${lib}/dist`, format: ['esm'], silent: true,
      esbuildPlugins: [weaselIcons.esbuild({ mode: 'library' })],
    });
    const out = readFileSync(`${lib}/dist/index.js`, 'utf8');
    expect(out).toMatch(/\/\* @icon \*\/ ['"]lib:star['"]/);
    expect(out).not.toMatch(/\bicon\(/);
  });
});
```

The `fixtures/lib` fixture has `src/index.ts` (`import { icon } from './icons.gen'; export const a = icon('star');`) and its generated `src/icons.gen.ts` (namespace `lib`). Add `fixtures/lib/dist` to `.gitignore`.

- [ ] **Step 2: Verify it fails, then passes once the esbuild path is exercised**

Run: `onto do -- npx vitest run --project=forge-node packages/icons/src/plugin/plugin.build.test.ts`
Expected first run: whichever part of the esbuild path Task 7's spike did not cover. Fix it in the plugin. Expected after: PASS.

- [ ] **Step 3: Wire library builds**

`scripts/tsup-preset.ts`:

```ts
import { weaselIcons } from '../packages/icons/src/plugin/index';
// …
    esbuildPlugins: [weaselIcons.esbuild({ mode: 'library' })],
```

Importing the plugin from source keeps tsup from needing icons' `dist` before it is built. Check `scripts/check-build-order.mjs` still passes: icons must build before any package that uses the preset, so add it to whatever order that script enforces. Do the same in the vite library configs of ui and core.

- [ ] **Step 4: Wire app builds and swap the providers**

```tsx
// apps/draw/src/main.tsx
import used from 'virtual:weasel-icons';

const ICON_VARIANTS = { all: () => import('virtual:weasel-icons/all') };
// …
<WeaselProvider icons={used} iconVariants={ICON_VARIANTS}>
```

`ICON_VARIANTS` is a module constant so its identity is stable across renders. The same for the site and forge. Add `weaselIcons.vite({ mode: 'app' })` to each app's `plugins`. The vitest projects that render app code (`draw`, `site`) also add it to their `plugins` in `vitest.config.ts`; dev/test mode serves every variant whole.

- [ ] **Step 5: Run the branch on the fleet, and the consumer smoke test**

Commit, then `npm run test:fleet`. Expected: green. Then `onto do -- npm run test:smoke:consumer`.
Expected: PASS. Then `onto do -- npm run build` and check apps/draw's output. `grep -o '__WEASEL_ICONS__' apps/draw/dist -r` must find nothing, and the main chunk must not contain a glyph no draw source names. Pick one, e.g. a ui `Platonic solids` glyph's `d` attribute.

- [ ] **Step 5b: Make the consumer smoke test assert the trimming**

In `scripts/smoke-consumer-bundle.mjs`, the fixture app it builds gains `weaselIcons.vite({ mode: 'app' })` and one `icon('ui:close')` use through a `toIconRef`-free path: an action declared with `icon: …` from a tiny generated `icons.gen.ts` of its own. Assert that the built main chunk contains `ui:close`'s body, does not contain the body of a ui glyph nothing names (choose one from the manifest), and contains no `__WEASEL_ICONS__` marker. Watch it fail first: run it with the assertion inverted, see it fail, then restore. Run with `onto do -- npm run test:smoke:consumer`.

- [ ] **Step 5c: Measure whether variants want a catalog chunk**

From the production build of apps/draw, report `/all`'s chunk size raw and gzipped (`gzip -c <chunk> | wc -c`), and the gzipped size of its JSON with every `body` and `fill` stripped. Put the three numbers, with the commit they came from, in `docs/icons.md` (Task 10). Splitting a metadata chunk out of each variant is a separate decision, made from those numbers; this plan does not build it.

- [ ] **Step 6: Screenshot WeaselDraw from a production build**

Serve `apps/draw/dist` with a threaded static server (not `python3 -m http.server`; CLAUDE.md trap), screenshot the toolbar and a context menu headlessly, and `transom post` both images (zone `weasel`). A placeholder anywhere means a name the build didn't collect.

- [ ] **Step 7: Commit**

```bash
git add scripts/tsup-preset.ts scripts/check-build-order.mjs packages/*/vite.config.ts apps vite.config.ts vitest.config.ts packages/forge
git commit -m "build every package and app through weaselIcons"
```

---

### Task 9: PrefSchemaEditor's icon picker

**Files:**
- Create: `packages/ui/src/components/PrefSchemaEditor/IconAttrField.tsx`, `IconAttrField.module.css`
- Modify: `packages/ui/src/components/PrefSchemaEditor/kindSchemas.ts:60` (the `icon` attribute becomes kind `ICON_KIND`), and wherever `CONDITION_KIND` is dispatched to its editor (`grep -rn CONDITION_KIND packages/ui/src/components/PrefSchemaEditor`)
- Test: `packages/ui/src/components/PrefSchemaEditor/IconAttrField.test.tsx`, `IconAttrField.browser.test.tsx`

**Interfaces:**
- Consumes: `useIconVariant` (Task 2), `<Icon>` (Task 5), `matchQuery` from `@weasel-js/registry`.
- Produces: `ICON_KIND = 'icon'`; `IconAttrField({ value: string | undefined; onChange(next: string | undefined): void })`.

- [ ] **Step 1: Write the failing test**

`IconAttrField.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IconRegistryProvider } from '@weasel-js/core';
import type { IconTable } from '@weasel-js/icons';
import { IconAttrField } from './IconAttrField';

const ui: IconTable = { namespace: 'ui', owner: '@weasel-js/ui', icons: {
  close: { body: '<path d="c"/>', group: 'View', tags: ['dismiss'] },
  add: { body: '<path d="a"/>', group: 'Actions', tags: [] },
} };

const setup = (onChange = vi.fn()) => {
  const loader = vi.fn(async () => ({ default: [ui] }));
  render(<IconRegistryProvider variants={{ all: loader }}><IconAttrField value={undefined} onChange={onChange} /></IconRegistryProvider>);
  return { onChange, loader };
};

describe('IconAttrField', () => {
  it('loads the all variant and lists its icons by qualified name', async () => {
    const { loader } = setup();
    await waitFor(() => expect(screen.getByRole('option', { name: 'ui:close' })).toBeTruthy());
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('filters by tag through the shared search', async () => {
    setup();
    await waitFor(() => screen.getByRole('option', { name: 'ui:add' }));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'dismiss' } });
    expect(screen.queryByRole('option', { name: 'ui:add' })).toBeNull();
    expect(screen.getByRole('option', { name: 'ui:close' })).toBeTruthy();
  });

  it('writes the qualified name on choice, and clears it', async () => {
    const { onChange } = setup();
    fireEvent.click(await screen.findByRole('option', { name: 'ui:close' }));
    expect(onChange).toHaveBeenLastCalledWith('ui:close');
    fireEvent.click(screen.getByRole('button', { name: 'No icon' }));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});
```

- [ ] **Step 2: Verify it fails**

Run: `onto do -- npx vitest run --project=weasel-ui packages/ui/src/components/PrefSchemaEditor/IconAttrField.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

Build the field from the editor's existing pieces. Read how the `condition` attribute's editor is laid out and wired, and match its row, label and spacing tokens. The content:

- a search input (`role="searchbox"`) filtering `entries` with `matchQuery(query, { text: [e.ref, e.glyph.group], tags: e.glyph.tags })`
- a `role="listbox"` grid of `role="option"` cells, each an `<Icon name={e.ref} size={20} />` with `aria-label={e.ref}`, grouped under `e.glyph.group` headings
- a "No icon" button
- while `state === 'loading'`, a "Loading icons…" line in place of the grid

The option is a `<div role="option" tabIndex={-1}>` inside a cell, not a `<td>`, per the CLAUDE.md rule on roles. Keyboard: the arrow keys move through the grid and Enter chooses. Keep the file under 400 lines; put grouping and filtering in `iconPickerModel.ts` if it grows.

In `kindSchemas.ts`, change line 60 to `icon: { kind: ICON_KIND, name: 'Icon', description: 'An icon by qualified name, from the icon sets this app registered.', default: undefined } as PrefLeaf,` and dispatch `ICON_KIND` to `IconAttrField` beside `CONDITION_KIND`.

- [ ] **Step 4: Verify, then a browser check**

Run: `onto do -- npx vitest run --project=weasel-ui packages/ui/src/components/PrefSchemaEditor/IconAttrField.test.tsx`
Expected: PASS.

Then write `IconAttrField.browser.test.tsx`, asserting that the grid scrolls inside its pane and the document does not (`scrollTo(0, 5000)` leaves `scrollY` at 0, per CLAUDE.md), and that a cell's glyph has a nonzero `getBBox().width`. Run it with `onto do -- npx vitest run --project=browser <file>`. Expected: PASS. Screenshot the picker in the PrefSchemaEditor story headlessly and `transom post` it.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/PrefSchemaEditor
git commit -m "pick a pref's icon from every registered icon in PrefSchemaEditor"
```

---

### Task 10: Docs, changeset, cleanup

**Files:**
- Create: `docs/icons.md` (the durable design: names, tables, the plugin and its variants, how to add an icon). Built from the spec's content, rewritten as present-tense reference.
- Create: `.changeset/icon-registry.md`
- Modify: `CLAUDE.md` ("Drawing icons": `gen:icons` path and `packages/ui/scripts/icons/` → each package's `icons/`; "Path order is z-order" names the new path), `docs/TODO.md` (retire or rewrite the icon entries that this work answers: "(P3) The path commands have no icons" and any entry naming `ACTION_GLYPHS` or the components; grep `-i icon`), `packages/icons/README.md`, `~/src/PROJECTS.md` is not touched (weasel's entry does not list packages)
- Delete: `docs/superpowers/specs/2026-10-16-icon-registry-design.md` and this plan, once `docs/icons.md` carries what is worth keeping

- [ ] **Step 1: Write the changeset**

```md
---
'@weasel-js/icons': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
'@weasel-js/path-tools': patch
'@weasel-js/routing': patch
'@weasel-js/prefs': patch
---

Icons are named, not drawn, by the code that uses them. `@weasel-js/icons` is new: an icon is `namespace:name` (`core:undo`, `ui:close`), each package's `icon()` qualifies its own bare names, and a registry held by `<WeaselProvider icons>` supplies the glyphs. `action.icon`, a tool's `presentation.icon` and a pref's `icon` take a name from `icon()` instead of a React node or a free string; this is breaking. The `…Icon` components core, ui and path-tools exported are removed: draw `<Icon name={…} />` instead. The `weaselIcons()` build plugin (`@weasel-js/icons/plugin`) ships only the glyphs a build names, with `virtual:weasel-icons/all` and custom variants loaded on demand.
```

All `patch`, per CLAUDE.md. The prose says it is breaking; the number is Mike's call.

- [ ] **Step 2: Write `docs/icons.md`, update CLAUDE.md and TODO.md, delete the spec and plan**

Cut pass before committing: no derivation, no alternatives considered, no counts that will rot.

- [ ] **Step 3: Final fleet run and gate**

```bash
git add -A docs CLAUDE.md .changeset packages/icons/README.md
git commit -m "document the icon registry and retire its spec and plan"
npm run test:fleet
```

Expected: green, `fleet-tree: N changed path(s) match <sha>` in the log with that gate test passing. Then `onto do -- npm run test:gate`. Expected: PASS.

- [ ] **Step 4: Hand back for merge**

Merging and the first npm publish of `@weasel-js/icons` are Mike's. A new package needs trusted publishing set up (`scripts/setup-trusted-publishing.mjs`, `scripts/check-first-publish.mjs`), and publishing needs his terminal for passkey 2FA. Report the branch, the last fleet run's result, and that step.
