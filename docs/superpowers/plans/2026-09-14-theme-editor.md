# Theme editor (phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `#/theme` editor in `apps/theme-editor` on the merged theme engine, as `docs/superpowers/specs/2026-09-10-theme-engine-and-editor-design.md` "Phase 2 — the editor" describes.

**Architecture:** A dev-only vite plugin owns the definition files and calls one engine function, `generateTokens`, to regenerate `src/generated/`. The browser holds the draft `ThemeDefinition` in `useLabHistory`, derives it per mode with `derive`, bakes it into a runtime `Theme` for the preview, and edits it through small pure helpers in `src/theme/model.ts`. Layer editors are views over those helpers.

**Tech Stack:** React 18, `@weasel-js/theme` + `/engine`, `@weasel-js/ui`, `@weasel-js/labkit` (`LabShell`, `ToolbarRegion`), `@weasel-js/history` via `useLabHistory`, vitest (`draw` project for the app, `weasel-ui` for `packages/theme`), vite.

Delete this plan when `theme-editor` merges.

---

## Rules for every task

- **Worktree:** `/Users/mike/src/weasel/.worktrees/theme-editor`. Every path you edit is under it. Use absolute paths; a relative path can land in the primary checkout, which another session is using.
- **One implementer at a time.** Stage explicit paths and commit with a pathspec. Never `git add -A`, never `git stash`, never switch branches.
- **Never launch a browser** (no Playwright, no Chrome, no `open`). The controller verifies in the browser.
- **Tests:** only the file you touched. App: `npx vitest run --project=draw <file>`. Theme package: `npx vitest run --project=weasel-ui <file>`. Typecheck: `npx tsc --noEmit` from the worktree root. The machine is loaded; a timeout in a file you did not touch is contention.
- **Watch each new test fail first.** jsdom resolves neither `var()` nor layout, and the CSS-module proxy answers to any class name, so a test that passes before the code exists is asserting the emulation.
- **Style:** US English. Comments only for what the code cannot say (see repo `CLAUDE.md`, "Comment sparingly"). No inline styles except colors and widths that come from data. No `!important`.
- **Changesets are `patch`.**
- **Commit messages:** imperative, lowercase, no prefix, ending with:

  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PWEgmAwUZJX3u79NNorTCX
  ```

## Facts measured before planning (2026-09-14)

- weasel at `{ mode: 'dark' }`: 100 own tokens, 23 overridden (ramps 23 of 23 pinned, semantics 11, 66 pins that no generator produces). `gray-800`'s generated value is `#1a1c21`.
- A pins-only child that pins `surface` and `radius-md` over weasel: 2 own tokens, 1 overridden.
- `derive(weasel)` ≈ 12 ms, `bake(weasel)` ≈ 16 ms, `bake(interstellar)` ≈ 26 ms.
- Both definition files round-trip `JSON.stringify(x, null, 2) + '\n'` byte for byte.
- Root `tsconfig.json` includes `apps`, so `apps/theme-editor/server/` is typechecked. No `vite/client` types in this app: don't use `import.meta.env`.
- `@weasel-js/theme` in Node resolves to `packages/theme/dist`, which predates anything this plan adds. Code the vite config loads imports engine source by relative path.

## File map

| File | Responsibility |
|---|---|
| `packages/theme/src/engine/emit/tokens.ts` | `generateTokens(definitions)`: the three generated files or the derive problems |
| `packages/theme/scripts/build-tokens.ts` | reads `themes/`, calls `generateTokens`, writes |
| `apps/theme-editor/src/theme/store.ts` | types shared by server and client; `serializeDefinition` |
| `apps/theme-editor/server/themeStore.ts` | list / read / write definition files, conflict check, regenerate |
| `apps/theme-editor/server/themeStorePlugin.ts` | `handleThemeRequest` and the vite middleware |
| `apps/theme-editor/src/theme/model.ts` | counts, runtime theme, pin and rule edits, rule summaries |
| `apps/theme-editor/src/theme/draftStorage.ts` | draft survives a reload; parsing split from storage |
| `apps/theme-editor/src/theme/api.ts` | HTTP client for the store, and a bundled read-only fallback |
| `apps/theme-editor/src/theme/rows.ts` | rows for the Seeds / Components / Pins list |
| `apps/theme-editor/src/theme/ramps.ts` | `rampView`: steps, L, ΔL, spread, generated values |
| `apps/theme-editor/src/theme/scales.ts` | `scaleColumns`: one column per axis combination |
| `apps/theme-editor/src/theme/semantics.ts` | `semanticRows`, rule kinds, default rules |
| `apps/theme-editor/src/theme/inspect.ts` | tokens a clicked element's matching rules read |
| `apps/theme-editor/src/theme/exportFiles.ts` | CSS / definition / DTCG export text |
| `apps/theme-editor/src/palette/ConstraintsPanel.tsx`, `unmetGates.ts` | moved out of `PaletteLab.tsx` |
| `apps/theme-editor/src/ThemePreview.tsx` | real components in every mode, per variant |
| `apps/theme-editor/src/ThemeEditor.tsx` | loads themes, picks one, reload after conflict |
| `apps/theme-editor/src/ThemeWorkbench.tsx` | header, rail, layer editor, preview, save |
| `apps/theme-editor/src/LayerRail.tsx`, `TokenList.tsx` | rail; read-only token rows |
| `apps/theme-editor/src/layers/RampsLayer.tsx`, `ScalesLayer.tsx`, `SemanticsLayer.tsx`, `SemanticDrawer.tsx` | layer editors |
| `apps/theme-editor/src/ThemeEditor.module.css` | the editor's styles |

---
### Task 1: `generateTokens` in the engine

**Files:**
- Create: `packages/theme/src/engine/emit/tokens.ts`, `packages/theme/src/engine/emit/tokens.test.ts`, `.changeset/theme-generate-tokens.md`
- Modify: `packages/theme/scripts/build-tokens.ts`, `packages/theme/src/engine.ts`, `packages/theme/src/index.ts`

- [ ] **Step 1: Write the failing test** — `packages/theme/src/engine/emit/tokens.test.ts`

```ts
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../../definition';
import { generateTokens } from './tokens';

const pkg = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const weasel = JSON.parse(readFileSync(resolve(pkg, 'themes/weasel.json'), 'utf8')) as ThemeDefinition;
const committed = (file: string) => readFileSync(resolve(pkg, 'src/generated', file), 'utf8');

describe('generateTokens', () => {
  it('produces the committed files from themes/', () => {
    const result = generateTokens([weasel]);
    if (!result.ok) throw new Error(result.problems.join('\n'));
    for (const file of ['tokens.css', 'themes.ts', 'manifest.ts'] as const) expect(result.files[file]).toBe(committed(file));
  });

  it('refuses a definition with derive issues and names each one', () => {
    const probe = { ramp: 'gray', contrast: { min: 30, against: ['surface'] } };
    const result = generateTokens([{ ...weasel, semantics: { ...weasel.semantics, probe } }]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toHaveLength(2);
    expect(result.problems.every((p) => p.includes('contrast-unmet'))).toBe(true);
  });

  it('throws unless exactly one definition extends nothing', () => {
    expect(() => generateTokens([weasel, { ...weasel, name: 'twin' }])).toThrow(/exactly one/);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=weasel-ui packages/theme/src/engine/emit/tokens.test.ts`
Expected: FAIL, cannot resolve `./tokens`.

- [ ] **Step 3: Implement** — `packages/theme/src/engine/emit/tokens.ts`

```ts
import { enumerateSelections } from '../../axes';
import type { ThemeDefinition } from '../../definition';
import { bake } from '../bake';
import { axisDependencies } from '../deps';
import { derive } from '../derive';
import { mergeChain } from '../merge';
import { emitCss } from './css';
import { emitManifest } from './manifest';
import { emitThemes } from './themes';

export type GeneratedTokens =
  | { readonly ok: true; readonly files: { readonly 'tokens.css': string; readonly 'themes.ts': string; readonly 'manifest.ts': string } }
  | { readonly ok: false; readonly problems: readonly string[] };

/** Every generated token file for a set of definitions, the one that extends nothing being the default. Any derive issue refuses the whole set. */
export function generateTokens(definitions: readonly ThemeDefinition[]): GeneratedTokens {
  const byName = new Map(definitions.map((d) => [d.name, d]));
  const lookup = (name: string) => byName.get(name);

  const roots = definitions.filter((d) => !d.extends);
  if (roots.length !== 1) throw new Error(`themes/ needs exactly one theme that extends nothing; found ${roots.length}`);
  const ordered = [roots[0], ...definitions.filter((d) => d.extends)];

  const problems = ordered.flatMap((def) =>
    enumerateSelections(mergeChain(def, lookup).axes ?? {}).flatMap((sel) =>
      derive(def, sel, lookup).issues.map((issue) => `${def.name} ${JSON.stringify(sel)}: ${JSON.stringify(issue)}`),
    ),
  );
  if (problems.length > 0) return { ok: false, problems };

  const themes = ordered.map((definition) => ({
    definition,
    baked: bake(definition, lookup),
    deps: axisDependencies(definition, lookup),
    isDefault: definition === roots[0],
  }));
  return {
    ok: true,
    files: { 'tokens.css': emitCss(themes), 'themes.ts': emitThemes(themes), 'manifest.ts': emitManifest(themes[0]) },
  };
}
```

- [ ] **Step 4: Replace the script body** — `packages/theme/scripts/build-tokens.ts` keeps its header comment, `THEMES_DIR` and `OUT_DIR`; everything from `const byName` down becomes:

```ts
const result = generateTokens(definitions);
if (!result.ok) {
  console.error(result.problems.join('\n'));
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });
for (const [file, text] of Object.entries(result.files)) writeFileSync(resolve(OUT_DIR, file), text);

console.log(`Generated ${definitions.length} theme(s) → ${OUT_DIR}`);
```

Its imports shrink to `mkdirSync, readdirSync, readFileSync, writeFileSync`, `dirname, resolve`, `fileURLToPath`, `type ThemeDefinition` and `{ generateTokens } from '../src/engine'`.

- [ ] **Step 5: Export** — in `packages/theme/src/engine.ts` add

```ts
export { declaredSteps } from './engine/steps';
export { generateTokens, type GeneratedTokens } from './engine/emit/tokens';
```

and in `packages/theme/src/index.ts` add `isByAxis` to the existing `./axes` export list (the editor reads `by` objects).

- [ ] **Step 6: Changeset** — `.changeset/theme-generate-tokens.md` (match the frontmatter of `.changeset/theme-engine.md`):

```md
---
'@weasel-js/theme': patch
---

`@weasel-js/theme/engine` exports `generateTokens(definitions)`, which returns `tokens.css`, `themes.ts` and `manifest.ts` for a set of theme definitions, or the derive problems that stop them; the package's `gen:tokens` script now calls it. The engine also exports `declaredSteps(entry)`, every step a ramp or scale entry can declare, and the runtime entry exports `isByAxis`.
```

- [ ] **Step 7: Verify**

Run: `npx vitest run --project=weasel-ui packages/theme/src/engine/emit/tokens.test.ts packages/theme/src/generated/determinism.test.ts` → PASS.
Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/theme/src/engine/emit/tokens.ts packages/theme/src/engine/emit/tokens.test.ts packages/theme/scripts/build-tokens.ts packages/theme/src/engine.ts packages/theme/src/index.ts .changeset/theme-generate-tokens.md
git commit -m "generate the token files through one engine function" -- <the same paths>
```

---

### Task 2: the theme store

**Files:**
- Create: `apps/theme-editor/src/theme/store.ts`, `apps/theme-editor/server/themeStore.ts`, `apps/theme-editor/server/themeStore.test.ts`

- [ ] **Step 1: Shared types** — `apps/theme-editor/src/theme/store.ts`

```ts
import type { Selection, ThemeDefinition } from '@weasel-js/theme';
import type { Issue } from '@weasel-js/theme/engine';

export interface StoredTheme {
  readonly name: string;
  /** sha-256 of the file's bytes: what a save sends back to prove it saw the file as it is. */
  readonly hash: string;
  /** Saving it regenerates `packages/theme/src/generated/`. */
  readonly emits: boolean;
  readonly definition: ThemeDefinition;
}

export interface IssueReport {
  readonly selection: Selection;
  readonly issue: Issue;
}

export type PutResult =
  | {
      readonly status: 'saved';
      readonly hash: string;
      readonly issues: readonly IssueReport[];
      readonly regenerated: boolean;
      /** Why the generated files were left alone, when the definition emits and they were. */
      readonly problems: readonly string[];
    }
  | { readonly status: 'conflict'; readonly hash: string | null }
  | { readonly status: 'invalid'; readonly message: string };

/** Record order is emission order, so keys are never sorted. */
export const serializeDefinition = (definition: ThemeDefinition): string => `${JSON.stringify(definition, null, 2)}\n`;
```

- [ ] **Step 2: Write the failing test** — `apps/theme-editor/server/themeStore.test.ts`

```ts
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ThemeDefinition } from '@weasel-js/theme';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { serializeDefinition } from '../src/theme/store';
import { createThemeStore, type ThemeStore } from './themeStore';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
let root: string;
let store: ThemeStore;
const at = (...parts: string[]) => resolve(root, ...parts);

beforeEach(() => {
  root = mkdtempSync(resolve(tmpdir(), 'wzl-theme-store-'));
  mkdirSync(at('themes'));
  mkdirSync(at('labkit'));
  copyFileSync(resolve(repo, 'packages/theme/themes/weasel.json'), at('themes/weasel.json'));
  copyFileSync(resolve(repo, 'packages/labkit/src/theme/interstellar.theme.json'), at('labkit/interstellar.theme.json'));
  store = createThemeStore({
    themesDir: at('themes'),
    extraFiles: [at('labkit/interstellar.theme.json')],
    generatedDir: at('generated'),
  });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('theme store', () => {
  it('lists every known definition, and which of them emit', () => {
    expect(store.list().map((t) => [t.name, t.emits])).toEqual([['weasel', true], ['interstellar', false]]);
  });

  it('writes the definition and regenerates the token files', () => {
    const weasel = store.read('weasel')!;
    const edited: ThemeDefinition = { ...weasel.definition, description: 'edited' };
    const result = store.write('weasel', edited, weasel.hash);
    expect(result).toMatchObject({ status: 'saved', regenerated: true, issues: [] });
    expect(readFileSync(at('themes/weasel.json'), 'utf8')).toBe(serializeDefinition(edited));
    expect(readFileSync(at('generated/tokens.css'), 'utf8')).toBe(
      readFileSync(resolve(repo, 'packages/theme/src/generated/tokens.css'), 'utf8'),
    );
  });

  it('answers a stale hash with the current one and leaves the file alone', () => {
    const before = readFileSync(at('themes/weasel.json'), 'utf8');
    const weasel = store.read('weasel')!;
    expect(store.write('weasel', { ...weasel.definition, description: 'x' }, 'stale')).toEqual({
      status: 'conflict',
      hash: weasel.hash,
    });
    expect(readFileSync(at('themes/weasel.json'), 'utf8')).toBe(before);
  });

  it('saves a definition with issues but leaves the generated files alone', () => {
    const weasel = store.read('weasel')!;
    const probe = { ramp: 'gray', contrast: { min: 30, against: ['surface'] } };
    const result = store.write('weasel', { ...weasel.definition, semantics: { ...weasel.definition.semantics, probe } }, weasel.hash);
    if (result.status !== 'saved') throw new Error(result.status);
    expect(result.issues.map((r) => r.issue.kind)).toEqual(['contrast-unmet', 'contrast-unmet']);
    expect(result.regenerated).toBe(false);
    expect(result.problems).toHaveLength(2);
    expect(existsSync(at('generated/tokens.css'))).toBe(false);
    expect(JSON.parse(readFileSync(at('themes/weasel.json'), 'utf8')).semantics.probe).toEqual(probe);
  });

  it('saves interstellar without emitting anything', () => {
    const inter = store.read('interstellar')!;
    const result = store.write('interstellar', { ...inter.definition, description: 'x' }, inter.hash);
    expect(result).toMatchObject({ status: 'saved', regenerated: false, problems: [] });
    expect(existsSync(at('generated'))).toBe(false);
  });

  it('creates a new theme in themes/ only while no file holds that name', () => {
    const harbor: ThemeDefinition = { name: 'harbor', extends: 'weasel', pins: { 'radius-md': { value: '2px', type: 'dimension' } } };
    expect(store.write('harbor', harbor, null)).toMatchObject({ status: 'saved', regenerated: true });
    expect(existsSync(at('themes/harbor.json'))).toBe(true);
    expect(store.write('harbor', harbor, null).status).toBe('conflict');
  });

  it('refuses a name that is not a theme name, or that the definition does not carry', () => {
    expect(store.write('../evil', { name: '../evil' }, null)).toMatchObject({ status: 'invalid' });
    expect(store.write('harbor', { name: 'other' }, null)).toMatchObject({ status: 'invalid' });
    expect(existsSync(at('themes/harbor.json'))).toBe(false);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run --project=draw apps/theme-editor/server/themeStore.test.ts`
Expected: FAIL, cannot resolve `./themeStore`.

- [ ] **Step 4: Implement** — `apps/theme-editor/server/themeStore.ts`

```ts
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
// Relative on purpose: vite loads its config in Node, where the aliases don't apply and the package's exports name a dist that may predate this code.
import { enumerateSelections } from '../../../packages/theme/src/axes';
import type { ThemeDefinition } from '../../../packages/theme/src/definition';
import { derive, generateTokens, mergeChain } from '../../../packages/theme/src/engine';
import { serializeDefinition, type IssueReport, type PutResult, type StoredTheme } from '../src/theme/store';

const NAME = /^[a-z][a-z0-9-]*$/;

export interface ThemeStoreOptions {
  /** Emitted into `generatedDir`. A new theme is created here. */
  readonly themesDir: string;
  /** Known definitions outside `themesDir`: saved, never emitted. */
  readonly extraFiles: readonly string[];
  readonly generatedDir: string;
}

export interface ThemeStore {
  list(): StoredTheme[];
  read(name: string): StoredTheme | undefined;
  write(name: string, definition: ThemeDefinition, baseHash: string | null): PutResult;
}

interface Entry {
  readonly file: string;
  readonly theme: StoredTheme;
}

const hashOf = (text: string) => createHash('sha256').update(text).digest('hex');

export function createThemeStore(options: ThemeStoreOptions): ThemeStore {
  const entries = (): Entry[] => {
    const files = [
      ...readdirSync(options.themesDir)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => ({ file: resolve(options.themesDir, f), emits: true })),
      ...options.extraFiles.filter((f) => existsSync(f)).map((file) => ({ file, emits: false })),
    ];
    return files.map(({ file, emits }) => {
      const text = readFileSync(file, 'utf8');
      const definition = JSON.parse(text) as ThemeDefinition;
      return { file, theme: { name: definition.name, hash: hashOf(text), emits, definition } };
    });
  };

  const regenerate = (all: readonly Entry[]): { regenerated: boolean; problems: string[] } => {
    try {
      const result = generateTokens(all.filter((e) => e.theme.emits).map((e) => e.theme.definition));
      if (!result.ok) return { regenerated: false, problems: [...result.problems] };
      mkdirSync(options.generatedDir, { recursive: true });
      for (const [file, text] of Object.entries(result.files)) {
        const path = resolve(options.generatedDir, file);
        if (!existsSync(path) || readFileSync(path, 'utf8') !== text) writeFileSync(path, text);
      }
      return { regenerated: true, problems: [] };
    } catch (e) {
      return { regenerated: false, problems: [(e as Error).message] };
    }
  };

  return {
    list: () => entries().map((e) => e.theme),
    read: (name) => entries().find((e) => e.theme.name === name)?.theme,

    write(name, definition, baseHash) {
      if (!NAME.test(name)) return { status: 'invalid', message: `"${name}" is not a theme name` };
      if (definition?.name !== name) return { status: 'invalid', message: `the definition is named "${definition?.name}", not "${name}"` };

      const known = entries().find((e) => e.theme.name === name);
      const file = known?.file ?? resolve(options.themesDir, `${name}.json`);
      const emits = known?.theme.emits ?? true;
      const current = existsSync(file) ? hashOf(readFileSync(file, 'utf8')) : null;
      if (current !== baseHash) return { status: 'conflict', hash: current };

      const text = serializeDefinition(definition);
      writeFileSync(file, text);

      const all = entries();
      const byName = new Map(all.map((e) => [e.theme.name, e.theme.definition]));
      const lookup = (n: string) => byName.get(n);
      const issues: IssueReport[] = [];
      try {
        for (const selection of enumerateSelections(mergeChain(definition, lookup).axes ?? {})) {
          for (const issue of derive(definition, selection, lookup).issues) issues.push({ selection, issue });
        }
      } catch (e) {
        issues.push({ selection: {}, issue: { kind: 'invalid', path: name, message: (e as Error).message } });
      }

      const generated = emits ? regenerate(all) : { regenerated: false, problems: [] };
      return { status: 'saved', hash: hashOf(text), issues, ...generated };
    },
  };
}
```

- [ ] **Step 5: Run the test** → PASS. If the `contrast-unmet` count differs, print `result.issues` and check against `semantics.ts` before changing the assertion.

- [ ] **Step 6: Typecheck** — `npx tsc --noEmit` → no errors.

- [ ] **Step 7: Commit** — `apps/theme-editor/src/theme/store.ts`, `apps/theme-editor/server/themeStore.ts`, `apps/theme-editor/server/themeStore.test.ts`; message `add a store that saves theme definitions and regenerates tokens`.

---

### Task 3: the vite plugin

**Files:**
- Create: `apps/theme-editor/server/themeStorePlugin.ts`, `apps/theme-editor/server/themeStorePlugin.test.ts`
- Modify: `apps/theme-editor/vite.config.ts`

- [ ] **Step 1: Write the failing test** — `apps/theme-editor/server/themeStorePlugin.test.ts`

```ts
import { describe, expect, it, vi } from 'vitest';
import type { StoredTheme } from '../src/theme/store';
import type { ThemeStore } from './themeStore';
import { handleThemeRequest } from './themeStorePlugin';

const weasel: StoredTheme = { name: 'weasel', hash: 'h1', emits: true, definition: { name: 'weasel' } };
const fakeStore = (write: ThemeStore['write'] = vi.fn()): ThemeStore => ({
  list: () => [weasel],
  read: (name) => (name === 'weasel' ? weasel : undefined),
  write,
});
const base = '/weasel/theme-editor/__theme';

describe('handleThemeRequest', () => {
  it('ignores every path outside /__theme/<name>', () => {
    expect(handleThemeRequest(fakeStore(), 'GET', '/weasel/theme-editor/index.html', null)).toBeUndefined();
    expect(handleThemeRequest(fakeStore(), 'GET', `${base}/../weasel`, null)).toBeUndefined();
    expect(handleThemeRequest(fakeStore(), 'GET', `${base}/Weasel.json`, null)).toBeUndefined();
  });

  it('lists and reads', () => {
    expect(handleThemeRequest(fakeStore(), 'GET', `${base}/list`, null)).toEqual({ status: 200, body: { themes: [weasel] } });
    expect(handleThemeRequest(fakeStore(), 'GET', `${base}/weasel`, null)).toEqual({ status: 200, body: weasel });
    expect(handleThemeRequest(fakeStore(), 'GET', `${base}/nope`, null)?.status).toBe(404);
  });

  it('answers a conflict with 409 and passes the hash through', () => {
    const write = vi.fn(() => ({ status: 'conflict', hash: 'h2' }) as const);
    const out = handleThemeRequest(fakeStore(write), 'PUT', `${base}/weasel`, { definition: { name: 'weasel' }, hash: 'h1' });
    expect(write).toHaveBeenCalledWith('weasel', { name: 'weasel' }, 'h1');
    expect(out).toEqual({ status: 409, body: { status: 'conflict', hash: 'h2' } });
  });

  it('refuses a body without a definition and a hash', () => {
    expect(handleThemeRequest(fakeStore(), 'PUT', `${base}/weasel`, { definition: { name: 'weasel' } })?.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run it and watch it fail** — `npx vitest run --project=draw apps/theme-editor/server/themeStorePlugin.test.ts` → FAIL.

- [ ] **Step 3: Implement** — `apps/theme-editor/server/themeStorePlugin.ts`

```ts
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import type { ThemeDefinition } from '../../../packages/theme/src/definition';
import { createThemeStore, type ThemeStore, type ThemeStoreOptions } from './themeStore';

const ROUTE = /\/__theme\/(list|[a-z][a-z0-9-]*)$/;

export interface ThemeResponse {
  readonly status: number;
  readonly body: unknown;
}

/** One request against the store; `undefined` for a path that is not the store's. */
export function handleThemeRequest(store: ThemeStore, method: string, path: string, body: unknown): ThemeResponse | undefined {
  const match = ROUTE.exec(path);
  if (!match) return undefined;
  const name = match[1];
  if (name === 'list') return method === 'GET' ? { status: 200, body: { themes: store.list() } } : { status: 405, body: { message: 'GET only' } };
  if (method === 'GET') {
    const theme = store.read(name);
    return theme ? { status: 200, body: theme } : { status: 404, body: { message: `no theme "${name}"` } };
  }
  if (method !== 'PUT') return { status: 405, body: { message: 'GET or PUT' } };
  const b = body as { definition?: unknown; hash?: unknown } | null;
  if (!b || typeof b.definition !== 'object' || b.definition === null || !(typeof b.hash === 'string' || b.hash === null)) {
    return { status: 400, body: { status: 'invalid', message: 'expected { definition, hash }' } };
  }
  const result = store.write(name, b.definition as ThemeDefinition, b.hash);
  return { status: result.status === 'saved' ? 200 : result.status === 'conflict' ? 409 : 400, body: result };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((done, fail) => {
    let text = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      text += chunk;
    });
    req.on('end', () => done(text));
    req.on('error', fail);
  });
}

function send(res: ServerResponse, { status, body }: ThemeResponse): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/** Serves the theme definition files to the editor. Dev server only. */
export function themeStorePlugin(options: ThemeStoreOptions): Plugin {
  return {
    name: 'weasel-theme-store',
    apply: 'serve',
    configureServer(server) {
      const store = createThemeStore(options);
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        if (!ROUTE.test(path)) return next();
        readBody(req).then((raw) => {
          let body: unknown = null;
          try {
            body = raw ? JSON.parse(raw) : null;
            send(res, handleThemeRequest(store, req.method ?? 'GET', path, body)!);
          } catch (e) {
            send(res, { status: raw && body === null ? 400 : 500, body: { status: 'invalid', message: (e as Error).message } });
          }
        }, next);
      });
    },
  };
}
```

- [ ] **Step 4: Wire it** — in `apps/theme-editor/vite.config.ts` import `themeStorePlugin` from `./server/themeStorePlugin` and extend `plugins`:

```ts
  plugins: [
    react(),
    themeFonts(repoRoot),
    themeStorePlugin({
      themesDir: resolve(repoRoot, 'packages/theme/themes'),
      extraFiles: [resolve(repoRoot, 'packages/labkit/src/theme/interstellar.theme.json')],
      generatedDir: resolve(repoRoot, 'packages/theme/src/generated'),
    }),
  ],
```

- [ ] **Step 5: Verify** — the test passes; `npx tsc --noEmit` is clean. (The controller checks `GET /weasel/theme-editor/__theme/list` against a dev server on port 5187.)

- [ ] **Step 6: Commit** — the three files; message `serve theme definitions to the editor from the dev server`.

---
### Task 4: the draft model

**Files:**
- Create: `apps/theme-editor/src/theme/model.ts`, `apps/theme-editor/src/theme/model.test.ts`, `apps/theme-editor/src/theme/fixtures.ts`

- [ ] **Step 1: Fixtures** — `apps/theme-editor/src/theme/fixtures.ts`

```ts
import { THEME_SOURCES, type ThemeDefinition } from '@weasel-js/theme';
import type { Lookup } from '@weasel-js/theme/engine';

export const weasel = THEME_SOURCES.weasel as ThemeDefinition;

/** A pins-only child: one pin over a semantic weasel derives, one over a token weasel only pins. */
export const child: ThemeDefinition = {
  name: 'child',
  extends: 'weasel',
  pins: {
    surface: { by: 'mode', dark: { value: '#0a0a14', type: 'color' }, light: { value: '#fafaf7', type: 'color' } },
    'radius-md': { value: '6px', type: 'dimension' },
  },
};

export const lookupOf = (...defs: ThemeDefinition[]): Lookup => {
  const byName = new Map([weasel, ...defs].map((d) => [d.name, d]));
  return (name) => byName.get(name);
};
```

- [ ] **Step 2: Write the failing test** — `apps/theme-editor/src/theme/model.test.ts`

```ts
import { resolveTheme } from '@weasel-js/theme';
import { derive } from '@weasel-js/theme/engine';
import { describe, expect, it } from 'vitest';
import { child, lookupOf, weasel } from './fixtures';
import { adoptGenerated, countTokens, removePin, ruleSummary, runtimeTheme, setPin, stepOf } from './model';

const lookup = lookupOf(child);

describe('countTokens', () => {
  it("counts weasel's own tokens and the pins over generated ones", () => {
    const counts = countTokens(weasel, derive(weasel, { mode: 'dark' }, lookup));
    expect(counts).toMatchObject({ overridden: 23, total: 100 });
    expect(counts.layers).toEqual({
      seeds: { count: 0, pinned: 0 },
      ramps: { count: 23, pinned: 23 },
      scales: { count: 0, pinned: 0 },
      semantics: { count: 11, pinned: 0 },
      components: { count: 0, pinned: 0 },
      pins: { count: 89, pinned: 23 },
    });
  });

  it("counts a child's own tokens only", () => {
    const counts = countTokens(child, derive(child, { mode: 'dark' }, lookup));
    expect(counts).toMatchObject({ overridden: 1, total: 2 });
    expect(counts.layers.semantics).toEqual({ count: 1, pinned: 1 });
    expect(counts.layers.pins).toEqual({ count: 2, pinned: 1 });
  });
});

describe('pins', () => {
  it('replaces a pin where it stands and appends a new one', () => {
    const keys = Object.keys(weasel.pins!);
    expect(Object.keys(setPin(weasel, 'gray-800', '#000000').pins!)).toEqual(keys);
    expect(Object.keys(setPin(weasel, 'brand-new', '#000000').pins!)).toEqual([...keys, 'brand-new']);
  });

  it('removes a pin, and returns the definition untouched when there is none', () => {
    expect(removePin(weasel, 'gray-800').pins).not.toHaveProperty('gray-800');
    expect(removePin(weasel, 'not-pinned')).toBe(weasel);
  });

  it('adopting a generated ramp drops its step pins so the generator shows', () => {
    const adopted = adoptGenerated(weasel, lookup, 'gray');
    expect(Object.keys(adopted.pins!).filter((n) => n.startsWith('gray-'))).toEqual([]);
    const result = derive(adopted, { mode: 'dark' }, lookup);
    expect(result.tokens['gray-800'].value).toBe('#1a1c21');
    expect(countTokens(adopted, result).overridden).toBe(13);
  });
});

describe('runtimeTheme', () => {
  it('bakes the draft and the chain above it under the given name', () => {
    const theme = runtimeTheme(child, lookup, 'draft-child');
    expect(theme.name).toBe('draft-child');
    expect(theme.extends?.name).toBe('weasel');
    expect(resolveTheme(theme, { mode: 'dark' })['--wzl-surface']).toBe('#0a0a14');
    expect(resolveTheme(theme, { mode: 'light' })['--wzl-radius-md']).toBe('6px');
  });
});

describe('ruleSummary', () => {
  it('reads each rule kind in short form', () => {
    expect(ruleSummary(weasel.semantics!.surface)).toBe('by mode: gray-800 / gray-50');
    expect(ruleSummary({ ref: 'fg', alpha: 0.1 })).toBe('fg at 10%');
    expect(ruleSummary({ ramp: 'gray', contrast: { min: 3, against: ['surface', 'surface-raised'] } })).toBe(
      'gray ≥ 3:1 against surface, surface-raised',
    );
    expect(ruleSummary({ from: 'surface', offset: 1, dir: 'darker' })).toBe('surface 1 darker');
    expect(ruleSummary({ ramp: 'gray', step: '800' })).toBe('gray-800');
    expect(ruleSummary({ ramp: 'gray', step: { by: 'mode', dark: '800', light: '50' } })).toBe('gray by mode');
    expect(ruleSummary({ value: 'rgba(0, 0, 0, 0.6)' })).toBe('rgba(0, 0, 0, 0.6)');
  });
});

describe('stepOf', () => {
  it('follows references to the ramp step they end on', () => {
    expect(stepOf('surface', derive(weasel, { mode: 'light' }, lookup))).toBe('gray-50');
    expect(stepOf('shadow', derive(weasel, { mode: 'dark' }, lookup))).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run it and watch it fail** — `npx vitest run --project=draw apps/theme-editor/src/theme/model.test.ts` → FAIL.

- [ ] **Step 4: Implement** — `apps/theme-editor/src/theme/model.ts`

```ts
import { isByAxis, type PinValue, type Theme, type ThemeDefinition, type Varying } from '@weasel-js/theme';
import {
  bake,
  declaredSteps,
  mergeChain,
  type DeriveResult,
  type Lookup,
  type RampDef,
  type ScaleDef,
  type SemanticRule,
} from '@weasel-js/theme/engine';

export type LayerId = 'seeds' | 'ramps' | 'scales' | 'semantics' | 'components' | 'pins';

export const LAYERS: readonly { readonly id: LayerId; readonly label: string }[] = [
  { id: 'seeds', label: 'Seeds' },
  { id: 'ramps', label: 'Ramps' },
  { id: 'scales', label: 'Scales' },
  { id: 'semantics', label: 'Semantics' },
  { id: 'components', label: 'Components' },
  { id: 'pins', label: 'Pins' },
];

export interface LayerCount {
  readonly count: number;
  readonly pinned: number;
}

export interface Counts {
  readonly overridden: number;
  readonly total: number;
  readonly layers: Readonly<Record<LayerId, LayerCount>>;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** Tokens the definition's own entries produce, in definition order. What it inherits is not its own. */
export function ownTokenNames(def: ThemeDefinition): string[] {
  const names = new Set<string>();
  for (const layer of [def.ramps, def.scales]) {
    for (const [name, entry] of Object.entries(layer ?? {})) for (const step of declaredSteps(entry)) names.add(`${name}-${step}`);
  }
  for (const layer of [def.semantics, def.components, def.pins]) for (const name of Object.keys(layer ?? {})) names.add(name);
  return [...names];
}

/** Each own token counts once, under the layer that produced it; the Pins row counts every pin entry, and how many override a generator. */
export function countTokens(def: ThemeDefinition, result: DeriveResult): Counts {
  const zero = () => ({ count: 0, pinned: 0 });
  const layers: Record<LayerId, Mutable<LayerCount>> = {
    seeds: { count: Object.keys(def.seeds ?? {}).length, pinned: 0 },
    ramps: zero(),
    scales: zero(),
    semantics: zero(),
    components: zero(),
    pins: zero(),
  };
  let overridden = 0;
  let total = 0;
  for (const name of ownTokenNames(def)) {
    const p = result.provenance[name];
    if (!p) continue;
    total += 1;
    if (p.pinned) overridden += 1;
    if (p.layer !== 'pins') {
      layers[p.layer].count += 1;
      if (p.pinned) layers[p.layer].pinned += 1;
    }
  }
  for (const name of Object.keys(def.pins ?? {})) {
    layers.pins.count += 1;
    if (result.provenance[name]?.pinned) layers.pins.pinned += 1;
  }
  return { overridden, total, layers };
}

/** The draft as the runtime takes it, every theme it extends baked the same way. `name` scopes the rule `applyTheme` writes. */
export function runtimeTheme(def: ThemeDefinition, lookup: Lookup, name: string = def.name): Theme {
  const baked = bake(def, lookup);
  const parent = def.extends ? lookup(def.extends) : undefined;
  return { name, extends: parent ? runtimeTheme(parent, lookup) : null, axes: baked.axes, tokens: baked.tokens };
}

function withEntry<T>(record: Readonly<Record<string, T>> | undefined, key: string, value: T): Record<string, T> {
  return { ...record, [key]: value };
}

export function setPin(def: ThemeDefinition, name: string, value: Varying<PinValue>): ThemeDefinition {
  return { ...def, pins: withEntry(def.pins, name, value) };
}

export function removePin(def: ThemeDefinition, name: string): ThemeDefinition {
  if (!def.pins || !Object.hasOwn(def.pins, name)) return def;
  const pins = { ...def.pins };
  delete pins[name];
  if (Object.keys(pins).length > 0) return { ...def, pins };
  const out: Mutable<ThemeDefinition> = { ...def };
  delete out.pins;
  return out;
}

/** Drops the definition's own pins on every step of `ramp`. A pin a parent holds stays. */
export function adoptGenerated(def: ThemeDefinition, lookup: Lookup, ramp: string): ThemeDefinition {
  const entry = mergeChain(def, lookup).ramps?.[ramp];
  if (!entry) return def;
  return declaredSteps(entry).reduce((d, step) => removePin(d, `${ramp}-${step}`), def);
}

/** Replaces a ramp's entry; a ramp the definition only inherits is copied in first. */
export function setRamp(def: ThemeDefinition, lookup: Lookup, ramp: string, update: (entry: RampDef) => RampDef): ThemeDefinition {
  const current = def.ramps?.[ramp] ?? mergeChain(def, lookup).ramps?.[ramp];
  return current ? { ...def, ramps: withEntry(def.ramps, ramp, update(current)) } : def;
}

export function setScale(def: ThemeDefinition, lookup: Lookup, scale: string, update: (entry: ScaleDef) => ScaleDef): ThemeDefinition {
  const current = def.scales?.[scale] ?? mergeChain(def, lookup).scales?.[scale];
  return current ? { ...def, scales: withEntry(def.scales, scale, update(current)) } : def;
}

export function setSemantic(def: ThemeDefinition, name: string, rule: Varying<SemanticRule>): ThemeDefinition {
  return { ...def, semantics: withEntry(def.semantics, name, rule) };
}

export function ruleSummary(rule: Varying<SemanticRule>): string {
  if (isByAxis(rule)) {
    const branches = Object.entries(rule).filter(([k]) => k !== 'by');
    return `by ${rule.by}: ${branches.map(([, v]) => ruleSummary(v as Varying<SemanticRule>)).join(' / ')}`;
  }
  const r = rule as SemanticRule;
  if ('ref' in r) return r.alpha === undefined ? r.ref : `${r.ref} at ${Math.round(r.alpha * 100)}%`;
  if ('contrast' in r) return `${r.ramp} ≥ ${r.contrast.min}:1 against ${r.contrast.against.join(', ')}`;
  if ('offset' in r) return `${r.from} ${r.offset} ${r.dir}`;
  if ('step' in r) return isByAxis(r.step) ? `${r.ramp} by ${r.step.by}` : `${r.ramp}-${r.step}`;
  return String(r.value);
}

const REF = /^\{([^}.]+)\}$/;

/** The ramp step a token's reference chain ends on; undefined when it ends on a literal. */
export function stepOf(name: string, result: DeriveResult): string | undefined {
  const seen = new Set<string>();
  for (let n: string | undefined = name; n !== undefined && !seen.has(n); ) {
    seen.add(n);
    if (result.provenance[n]?.layer === 'ramps') return n;
    const value = result.tokens[n]?.value;
    n = typeof value === 'string' ? REF.exec(value.trim())?.[1] : undefined;
  }
  return undefined;
}
```

- [ ] **Step 5: Run the test** → PASS. If `overridden` after adopting is not 13, print `countTokens(...).layers` before touching the assertion: 23 − 10 gray pins = 13 is the expectation.

- [ ] **Step 6: Typecheck and commit** — `npx tsc --noEmit`; commit the three files, message `model theme drafts: counts, pins, runtime theme, rule summaries`.

---

### Task 5: draft storage and the store client

**Files:**
- Create: `apps/theme-editor/src/theme/draftStorage.ts`, `draftStorage.test.ts`, `api.ts`, `api.test.ts` (all under `apps/theme-editor/src/theme/`)

- [ ] **Step 1: Write the failing tests**

`draftStorage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseDraft } from './draftStorage';

describe('parseDraft', () => {
  const draft = { definition: { name: 'weasel', description: 'x' }, baseHash: 'h1' };

  it('reads a draft of the named theme', () => {
    expect(parseDraft(JSON.stringify(draft), 'weasel')).toEqual(draft);
    expect(parseDraft(JSON.stringify({ ...draft, baseHash: null }), 'weasel')?.baseHash).toBeNull();
  });

  it('rejects anything else rather than trusting it', () => {
    expect(parseDraft(null, 'weasel')).toBeNull();
    expect(parseDraft('{', 'weasel')).toBeNull();
    expect(parseDraft(JSON.stringify(draft), 'interstellar')).toBeNull();
    expect(parseDraft(JSON.stringify({ ...draft, baseHash: 3 }), 'weasel')).toBeNull();
    expect(parseDraft(JSON.stringify({ baseHash: 'h1' }), 'weasel')).toBeNull();
  });
});
```

`api.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { httpThemeApi } from './api';

const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe('httpThemeApi', () => {
  it('addresses the store under the page base', async () => {
    const fetchImpl = vi.fn(async () => respond(200, { themes: [] }));
    await httpThemeApi('http://localhost:5187/weasel/theme-editor/#/theme', fetchImpl).list();
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:5187/weasel/theme-editor/__theme/list', undefined);
  });

  it('sends the definition with the hash it was loaded at, and reads a 409 as a conflict', async () => {
    const fetchImpl = vi.fn(async () => respond(409, { status: 'conflict', hash: 'h2' }));
    const result = await httpThemeApi('http://h/', fetchImpl).put('weasel', { name: 'weasel' }, 'h1');
    expect(result).toEqual({ status: 'conflict', hash: 'h2' });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({ definition: { name: 'weasel' }, hash: 'h1' });
  });

  it('throws on a failure the store does not describe', async () => {
    await expect(httpThemeApi('http://h/', async () => respond(500, {})).list()).rejects.toThrow('500');
  });
});
```

- [ ] **Step 2: Run both and watch them fail.**

- [ ] **Step 3: Implement** — `draftStorage.ts`

```ts
import type { ThemeDefinition } from '@weasel-js/theme';

export interface StoredDraft {
  readonly definition: ThemeDefinition;
  /** The file's hash when the draft began, so a save over a file that moved on since answers with a conflict. */
  readonly baseHash: string | null;
}

const draftKey = (name: string) => `weasel.theme-editor.draft.${name}`;
const LAST_KEY = 'weasel.theme-editor.theme';

export function parseDraft(raw: string | null, name: string): StoredDraft | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { definition, baseHash } = parsed as { definition?: unknown; baseHash?: unknown };
  if (typeof definition !== 'object' || definition === null || (definition as { name?: unknown }).name !== name) return null;
  if (typeof baseHash !== 'string' && baseHash !== null) return null;
  return { definition: definition as ThemeDefinition, baseHash };
}

export function loadDraft(name: string): StoredDraft | null {
  try {
    return parseDraft(localStorage.getItem(draftKey(name)), name);
  } catch {
    // No storage at all: a private window, or jsdom.
    return null;
  }
}

export function persistDraft(draft: StoredDraft): void {
  try {
    localStorage.setItem(draftKey(draft.definition.name), JSON.stringify(draft));
  } catch {
    // Private windows and full quotas both land here.
  }
}

export function clearDraft(name: string): void {
  try {
    localStorage.removeItem(draftKey(name));
  } catch {
    // As above.
  }
}

export function loadLastTheme(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

export function persistLastTheme(name: string): void {
  try {
    localStorage.setItem(LAST_KEY, name);
  } catch {
    // As above.
  }
}
```

`api.ts`:

```ts
import { THEME_SOURCES, type ThemeDefinition } from '@weasel-js/theme';
import type { PutResult, StoredTheme } from './store';

export interface ThemeApi {
  list(): Promise<StoredTheme[]>;
  get(name: string): Promise<StoredTheme>;
  put(name: string, definition: ThemeDefinition, baseHash: string | null): Promise<PutResult>;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** The dev server's theme store, addressed relative to the page so the app's base path carries over. */
export function httpThemeApi(base: string = document.baseURI, fetchImpl: Fetch = (input, init) => fetch(input, init)): ThemeApi {
  const url = (path: string) => new URL(`__theme/${path}`, base).toString();
  const read = async <T>(response: Response): Promise<T> => {
    if (!response.ok && response.status !== 409 && response.status !== 400) throw new Error(`${response.status} ${response.statusText}`);
    return (await response.json()) as T;
  };
  return {
    list: async () => (await read<{ themes: StoredTheme[] }>(await fetchImpl(url('list'), undefined))).themes,
    get: async (name) => read<StoredTheme>(await fetchImpl(url(name), undefined)),
    put: async (name, definition, baseHash) =>
      read<PutResult>(
        await fetchImpl(url(name), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ definition, hash: baseHash }),
        }),
      ),
  };
}

/** The built themes, read-only: what a static build of the app, with no dev server behind it, can offer. */
export function bundledThemeApi(): ThemeApi {
  const themes: StoredTheme[] = Object.values(THEME_SOURCES).map((definition) => ({
    name: definition.name,
    hash: '',
    emits: true,
    definition: definition as ThemeDefinition,
  }));
  return {
    list: async () => themes,
    get: async (name) => {
      const theme = themes.find((t) => t.name === name);
      if (!theme) throw new Error(`no theme "${name}"`);
      return theme;
    },
    put: async () => ({ status: 'invalid', message: 'Saving needs the dev server: run `npm run dev:theme-editor`.' }),
  };
}
```

- [ ] **Step 4: Run both tests** → PASS. `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit** — the four files; message `keep theme drafts across reloads and talk to the theme store`.

---
### Task 6: `lightBias` in the chroma envelope

Decided by Mike, 2026-09-14: the envelope becomes `sin(πt) + lightBias·(1−t) + darkBias·t`, `lightBias` defaulting to 0. The spec's phase 1 "Ramps" bullet already says so.

**Files:**
- Modify: `packages/theme/src/engine/ramps.ts`, `packages/theme/src/engine/ramps.test.ts`, `packages/theme/src/engine/derive.ts` (`rampColors`), `packages/theme/src/definition.ts` (`LightnessRampDef.chroma`), `packages/theme/src/engine/derive.test.ts`
- Create: `.changeset/theme-ramp-light-bias.md`

- [ ] **Step 1: Failing tests.** Append to `ramps.test.ts` (import `toLch` from `./color/oklch` if the file lacks it):

```ts
describe('lightBias', () => {
  const base = { steps: ['a', 'b', 'c', 'd', 'e'], lightness: [0.9, 0.3] as const, curve: 0, hue: 250, peak: 0.1, darkBias: 0 };

  it('leaves a ramp that omits it unchanged', () => {
    expect(lightnessRamp({ ...base, lightBias: 0 })).toEqual(lightnessRamp(base));
  });

  it('lifts the first step off zero chroma', () => {
    expect(toLch(lightnessRamp(base).a).C).toBeLessThan(0.005);
    expect(toLch(lightnessRamp({ ...base, lightBias: 0.5 }).a).C).toBeGreaterThan(0.02);
  });
});
```

Append to `derive.test.ts`, inside its top-level `describe` (reuse its imports; add `toLch` from `./color/oklch`):

```ts
it('reads chroma.lightBias, so an anchored ramp keeps chroma at both ends', () => {
  const ramp = (chroma?: object) => ({
    name: 't',
    ramps: { accent: { kind: 'lightness' as const, steps: ['soft', 'base', 'strong'], lightness: [0.72, 0.34] as [number, number], anchor: { base: '#0b6e8a' }, ...(chroma ? { chroma } : {}) } },
  });
  const C = (def: ReturnType<typeof ramp>, step: string) => toLch(String(derive(def).tokens[`accent-${step}`].value)).C;
  expect(C(ramp(), 'soft')).toBeLessThan(0.005);
  const biased = ramp({ peak: 0, lightBias: 1, darkBias: 1 });
  expect(C(biased, 'soft')).toBeGreaterThan(0.02);
  expect(C(biased, 'strong')).toBeGreaterThan(0.02);
});
```

- [ ] **Step 2: Run** `npx vitest run --project=weasel-ui packages/theme/src/engine/ramps.test.ts packages/theme/src/engine/derive.test.ts` → the new cases FAIL (the others pass).

- [ ] **Step 3: Implement.** In `ramps.ts`:

```ts
export interface LightnessParams {
  // ...existing fields...
  /** Lifts the first step's chroma off zero, as `darkBias` lifts the last. Default 0. */
  readonly lightBias?: number;
}

const envelope = (t: number, lightBias: number, darkBias: number) => Math.sin(Math.PI * t) + lightBias * (1 - t) + darkBias * t;

function envelopeMax(lightBias: number, darkBias: number): number {
  let max = 0;
  for (let i = 0; i <= 1000; i += 1) max = Math.max(max, envelope(i / 1000, lightBias, darkBias));
  return max;
}
```

and inside `lightnessRamp` read `const lightBias = p.lightBias ?? 0;`, then pass `lightBias, p.darkBias` to every `envelope`/`envelopeMax` call. Update the docstring's formula. In `definition.ts`, `chroma?: Varying<{ readonly peak: NumberParam; readonly lightBias?: NumberParam; readonly darkBias?: NumberParam }>`. In `derive.ts` `rampColors`, beside `darkBias`: `lightBias: read.optNum(chroma.lightBias, \`${path}.chroma.lightBias\`, 0),`.

- [ ] **Step 4: Run** the two files, plus `npx vitest run --project=weasel-ui packages/theme/src/generated/determinism.test.ts` (weasel's output must not move) → PASS. `npx tsc --noEmit` clean.

- [ ] **Step 5: Changeset** `.changeset/theme-ramp-light-bias.md`, `patch`:

```md
A lightness ramp's `chroma` takes `lightBias`, which lifts the first step's chroma off zero as `darkBias` lifts the last: the envelope is now `sin(πt) + lightBias·(1−t) + darkBias·t`. It defaults to 0, so existing ramps are unchanged. Without it, a ramp anchored on one brand color with `darkBias` 0 came out gray at both ends.
```

- [ ] **Step 6: Commit** the six paths; message `add lightBias so a ramp can keep chroma at its first step`.

---

### Task 7: a theme's own ramps shadow inherited pins

Decided by Mike, 2026-09-14: a theme that declares a ramp or scale generates those steps itself; pins its parents hold on them stop applying, its own pins still do. The spec's "Pins" paragraph already says so.

**Files:**
- Modify: `packages/theme/src/engine/merge.ts`, `packages/theme/src/engine/merge.test.ts`, `packages/theme/src/engine/derive.test.ts`
- Create: `.changeset/theme-own-ramps-shadow-pins.md`

- [ ] **Step 1: Failing tests.** Append to `merge.test.ts` (import `ThemeDefinition` from `../definition` if missing):

```ts
describe('a theme that declares a ramp or scale', () => {
  const parent: ThemeDefinition = {
    name: 'p',
    ramps: { gray: { kind: 'lightness', steps: ['a', 'b'], lightness: [0.9, 0.2] } },
    scales: { space: { steps: ['sm'], base: 4, step: 4 } },
    pins: { 'gray-a': '#ffffff', 'gray-b': '#000000', 'space-sm': '3px', radius: '4px' },
  };
  const lookup = (name: string) => (name === 'p' ? parent : undefined);

  it("drops the parent's pins on its steps and keeps its own", () => {
    const child: ThemeDefinition = {
      name: 'c',
      extends: 'p',
      ramps: { gray: { kind: 'lightness', steps: ['a', 'b'], lightness: [0.8, 0.3] } },
      scales: { space: { steps: ['sm'], base: 2, step: 2 } },
      pins: { 'gray-b': '#111111' },
    };
    expect(mergeChain(child, lookup).pins).toEqual({ radius: '4px', 'gray-b': '#111111' });
  });

  it('keeps every inherited pin when it only inherits the ramp', () => {
    expect(mergeChain({ name: 'c', extends: 'p' }, lookup).pins).toEqual(parent.pins);
  });
});
```

Append to `derive.test.ts`:

```ts
it("generates a child's own gray over weasel's pinned one", () => {
  const weasel = JSON.parse(readFileSync(resolve(__dirname, '../../themes/weasel.json'), 'utf8')) as ThemeDefinition;
  const child: ThemeDefinition = { name: 'c', extends: 'weasel', ramps: { gray: weasel.ramps!.gray } };
  const result = derive(child, { mode: 'dark' }, (n) => (n === 'weasel' ? weasel : undefined));
  expect(result.tokens['gray-800'].value).toBe('#1a1c21');
  expect(result.provenance['gray-800'].pinned).toBe(false);
  expect(result.tokens['accent-base'].value).toBe(derive(weasel, { mode: 'dark' }).tokens['accent-base'].value);
});
```

(If `derive.test.ts` already loads `weasel.json` another way, reuse that instead of `readFileSync`; if `__dirname` is unavailable there, use `fileURLToPath(import.meta.url)` as `tokens.test.ts` does.)

- [ ] **Step 2: Run** `npx vitest run --project=weasel-ui packages/theme/src/engine/merge.test.ts packages/theme/src/engine/derive.test.ts` → the new cases FAIL.

- [ ] **Step 3: Implement** in `merge.ts`:

```ts
import { mergeAxes } from '../axes';
import type { ThemeDefinition } from '../definition';
import { declaredSteps } from './steps';

// ...Lookup and LAYERS unchanged...

/** Steps of the ramps and scales `def` declares itself, which it generates rather than inherits pinned. */
function ownSteps(def: ThemeDefinition): Set<string> {
  const names = new Set<string>();
  for (const layer of [def.ramps, def.scales]) {
    for (const [name, entry] of Object.entries(layer ?? {})) for (const step of declaredSteps(entry)) names.add(`${name}-${step}`);
  }
  return names;
}

export function mergeChain(def: ThemeDefinition, lookup?: Lookup, seen: ReadonlySet<string> = new Set()): ThemeDefinition {
  // ...unchanged up to the LAYERS loop...
  for (const layer of LAYERS) out[layer] = { ...(parent[layer] ?? {}), ...(def[layer] ?? {}) };
  const shadowed = ownSteps(def);
  const inherited = Object.entries(parent.pins ?? {}).filter(([name]) => !shadowed.has(name));
  out.pins = { ...Object.fromEntries(inherited), ...(def.pins ?? {}) };
  out.axes = mergeAxes(parent.axes ?? {}, def.axes ?? {});
  return out as unknown as ThemeDefinition;
}
```

Check `steps.ts` does not import `merge.ts` (a cycle would load `declaredSteps` as undefined).

- [ ] **Step 4: Run** the two files and `packages/theme/src/generated/determinism.test.ts`, `packages/theme/src/engine/bake.test.ts`, `packages/theme/src/engine/deps.test.ts` → PASS. `npx tsc --noEmit` clean.

- [ ] **Step 5: Changeset** `.changeset/theme-own-ramps-shadow-pins.md`, `patch`:

```md
A theme that declares a ramp or scale now generates those steps itself: pins held on them by the themes it extends no longer apply, while its own pins still do. Previously a theme extending weasel inherited weasel's pins on every gray, accent and swatch step, so none of its own ramps could show. A theme that redeclares a ramp and relied on the parent's pins must pin those steps itself.
```

- [ ] **Step 6: Commit** the four paths; message `let a theme's own ramps and scales shadow the pins it inherits`.

---
### Task 8: the preview

**Files:**
- Create: `apps/theme-editor/src/ThemePreview.tsx`, `apps/theme-editor/src/ThemePreview.test.tsx`, `apps/theme-editor/src/ThemeEditor.module.css`

- [ ] **Step 1: Failing test** — `ThemePreview.test.tsx`

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemePreview } from './ThemePreview';
import { child, lookupOf } from './theme/fixtures';
import { runtimeTheme } from './theme/model';

const theme = runtimeTheme(child, lookupOf(child), 'draft-child');

describe('<ThemePreview>', () => {
  afterEach(cleanup);

  it('applies the draft theme to one pane per mode', () => {
    render(<ThemePreview variants={[{ label: 'Draft', theme }]} selection={{}} />);
    const panes = [...document.querySelectorAll('[data-wzl-theme="draft-child"]')];
    expect(panes.map((p) => p.getAttribute('data-wzl-mode'))).toEqual(['dark', 'light']);
  });

  it('labels each variant once there is more than one', () => {
    render(<ThemePreview variants={[{ label: 'Pinned', theme }, { label: 'Generated', theme: { ...theme, name: 'draft-child-generated' } }]} selection={{}} />);
    expect(screen.getByRole('region', { name: 'Pinned' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Generated' })).toBeInTheDocument();
  });

  it('while inspecting, hands the clicked element and its pane to onInspect', async () => {
    const onInspect = vi.fn();
    render(<ThemePreview variants={[{ label: 'Draft', theme }]} selection={{}} inspecting onInspect={onInspect} />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Primary' })[0]);
    expect(onInspect).toHaveBeenCalledTimes(1);
    const [target, pane] = onInspect.mock.calls[0] as [Element, Element];
    expect(pane.contains(target)).toBe(true);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run --project=draw apps/theme-editor/src/ThemePreview.test.tsx` → FAIL.

- [ ] **Step 3: Implement** — `ThemePreview.tsx`

```tsx
import { themeAxes, type Selection, type Theme } from '@weasel-js/theme';
import { ThemeProvider } from '@weasel-js/theme/react';
import { Button, Checkbox, Input, SidebarPanel, Slider, Switch, ToggleBar, type Thumb } from '@weasel-js/ui';
import { useState, type MouseEvent } from 'react';
import styles from './ThemeEditor.module.css';

export interface PreviewVariant {
  readonly label: string;
  readonly theme: Theme;
}

export interface ThemePreviewProps {
  readonly variants: readonly PreviewVariant[];
  /** Every axis but `mode`, which the preview shows all of. */
  readonly selection: Selection;
  readonly inspecting?: boolean;
  readonly onInspect?: (target: Element, pane: Element) => void;
}

const ALIGN = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

function Specimen({ caption }: { caption: string }) {
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(true);
  const [thumbs, setThumbs] = useState<Thumb[]>([{ value: 40 }]);
  const [align, setAlign] = useState<string | null>('left');
  return (
    <SidebarPanel title={`Panel · ${caption}`}>
      <div className={styles.specimenBody}>
        <div className={styles.specimenRow}>
          <Button variant="primary" size="sm">Primary</Button>
          <Button size="sm">Secondary</Button>
          <Button variant="ghost" size="sm">Ghost</Button>
        </div>
        <Checkbox isSelected={checked} onChange={setChecked}>Checkbox</Checkbox>
        <Switch isSelected={on} onChange={setOn}>Switch</Switch>
        <Slider thumbs={thumbs} onInput={setThumbs} min={0} max={100} density="slim" ariaLabel="Slider" />
        <ToggleBar size="sm" ariaLabel="Alignment" items={ALIGN} value={align} onChange={setAlign} />
        <div className={styles.sunken}>
          <Input label="Sunken field" defaultValue="Text" />
        </div>
      </div>
    </SidebarPanel>
  );
}

/** Real kit components under the draft theme, one pane per mode, so an edit shows in both at once. */
export function ThemePreview({ variants, selection, inspecting = false, onInspect }: ThemePreviewProps) {
  const capture = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onInspect?.(e.target as Element, e.currentTarget);
  };
  return (
    <div className={styles.preview}>
      {variants.map((variant) => {
        const modes = Object.keys(themeAxes(variant.theme).mode?.values ?? {});
        return (
          <section key={variant.label} className={styles.previewVariant} aria-label={variant.label}>
            {variants.length > 1 && <h2 className={styles.previewLabel}>{variant.label}</h2>}
            <div className={styles.previewModes}>
              {(modes.length > 0 ? modes : [undefined]).map((mode) => (
                <ThemeProvider
                  key={mode ?? 'default'}
                  theme={variant.theme}
                  selection={mode === undefined ? selection : { ...selection, mode }}
                  className={styles.previewPane}
                >
                  <div className={inspecting ? styles.inspecting : undefined} onClickCapture={inspecting ? capture : undefined}>
                    <Specimen caption={mode ?? 'default'} />
                  </div>
                </ThemeProvider>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

Read `SidebarPanel.tsx` and `ToggleBar.tsx` once before running: if either prop name differs from what is written here, follow the component.

- [ ] **Step 4: Styles** — `ThemeEditor.module.css` (later tasks append to it):

```css
.preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.previewVariant {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.previewLabel {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--wzl-fg-muted);
}

.previewModes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 8px;
}

.previewPane {
  background: var(--wzl-surface);
  color: var(--wzl-fg);
  border: 1px solid var(--wzl-border);
  border-radius: var(--wzl-radius-md);
  padding: 8px;
}

.inspecting {
  cursor: crosshair;
}

.specimenBody {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px;
}

.specimenRow {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sunken {
  background: var(--wzl-surface-sunken);
  border-radius: var(--wzl-radius-md);
  padding: 8px;
}
```

- [ ] **Step 5: Run** the test → PASS; `npx tsc --noEmit` clean; `npx eslint apps/theme-editor/src/ThemePreview.tsx` clean. If `jsx-a11y` objects to `onClickCapture` on the div, give the div `role="presentation"`; inspecting is a pointer affordance, and the tokens it reveals are all reachable from the layer editors by keyboard.

- [ ] **Step 6: Commit** the three files; message `preview a draft theme on real kit components in every mode`.

---

### Task 9: the layer rail and read-only token rows

**Files:**
- Create: `apps/theme-editor/src/theme/rows.ts`, `rows.test.ts` (under `src/theme/`), `apps/theme-editor/src/LayerRail.tsx`, `LayerRail.test.tsx`, `apps/theme-editor/src/TokenList.tsx`
- Modify: `apps/theme-editor/src/ThemeEditor.module.css`

- [ ] **Step 1: Failing tests**

`src/theme/rows.test.ts`:

```ts
import { derive } from '@weasel-js/theme/engine';
import { describe, expect, it } from 'vitest';
import { child, lookupOf, weasel } from './fixtures';
import { layerRows } from './rows';

const lookup = lookupOf(child);

describe('layerRows', () => {
  it('lists every pin, with what each override replaced', () => {
    const rows = layerRows('pins', weasel, derive(weasel, { mode: 'dark' }, lookup));
    expect(rows).toHaveLength(89);
    expect(rows.find((r) => r.name === 'gray-800')).toMatchObject({ type: 'color', replaced: '#1a1c21' });
    expect(rows.find((r) => r.name === 'radius-md')).not.toHaveProperty('replaced');
  });

  it("lists a layer's own tokens only", () => {
    expect(layerRows('semantics', weasel, derive(weasel, { mode: 'dark' }, lookup)).map((r) => r.name)).toHaveLength(11);
    const childRows = layerRows('semantics', child, derive(child, { mode: 'dark' }, lookup));
    expect(childRows).toEqual([{ name: 'surface', type: 'color', value: '#0a0a14', replaced: '{gray-800}' }]);
  });

  it('lists seeds by name', () => {
    const seeded = { ...weasel, seeds: { brand: '#0b6e8a', unit: 4 } };
    expect(layerRows('seeds', seeded, derive(seeded, { mode: 'dark' }, lookup))).toEqual([
      { name: 'seeds.brand', type: 'seed', value: '#0b6e8a' },
      { name: 'seeds.unit', type: 'seed', value: '4' },
    ]);
  });
});
```

`src/LayerRail.test.tsx`:

```tsx
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LayerRail } from './LayerRail';

const counts = {
  seeds: { count: 0, pinned: 0 },
  ramps: { count: 23, pinned: 23 },
  scales: { count: 0, pinned: 0 },
  semantics: { count: 11, pinned: 0 },
  components: { count: 0, pinned: 0 },
  pins: { count: 89, pinned: 23 },
};

describe('<LayerRail>', () => {
  afterEach(cleanup);

  it('lists the six layers in derivation order with their counts', () => {
    render(<LayerRail counts={counts} selected="ramps" onSelect={() => {}} />);
    const buttons = within(screen.getByRole('navigation', { name: 'Layers' })).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Seeds0', 'Ramps2323 pinned', 'Scales0', 'Semantics11', 'Components0', 'Pins8923 pinned']);
    expect(buttons[1]).toHaveAttribute('aria-current', 'true');
  });

  it('selects a layer', async () => {
    const onSelect = vi.fn();
    render(<LayerRail counts={counts} selected="ramps" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /^Pins/ }));
    expect(onSelect).toHaveBeenCalledWith('pins');
  });
});
```

- [ ] **Step 2: Run both** → FAIL.

- [ ] **Step 3: Implement**

`src/theme/rows.ts`:

```ts
import type { ThemeDefinition } from '@weasel-js/theme';
import type { DeriveResult } from '@weasel-js/theme/engine';
import { ownTokenNames, type LayerId } from './model';

export interface TokenRow {
  readonly name: string;
  readonly type: string;
  readonly value: string;
  /** What the rule produced before a pin replaced it. */
  readonly replaced?: string;
}

const text = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

export function layerRows(layer: LayerId, def: ThemeDefinition, result: DeriveResult): TokenRow[] {
  if (layer === 'seeds') {
    return Object.entries(def.seeds ?? {}).map(([name, v]) => ({ name: `seeds.${name}`, type: 'seed', value: text(v) }));
  }
  const names = layer === 'pins' ? Object.keys(def.pins ?? {}) : ownTokenNames(def).filter((n) => result.provenance[n]?.layer === layer);
  return names
    .filter((name) => Object.hasOwn(result.tokens, name))
    .map((name) => {
      const token = result.tokens[name];
      const p = result.provenance[name];
      return { name, type: token.type, value: text(token.value), ...(p.pinned && p.generated ? { replaced: text(p.generated.value) } : {}) };
    });
}
```

`src/LayerRail.tsx`:

```tsx
import styles from './ThemeEditor.module.css';
import { LAYERS, type Counts, type LayerId } from './theme/model';

export interface LayerRailProps {
  readonly counts: Counts['layers'];
  readonly selected: LayerId;
  readonly onSelect: (layer: LayerId) => void;
}

export function LayerRail({ counts, selected, onSelect }: LayerRailProps) {
  return (
    <nav className={styles.rail} aria-label="Layers">
      <ul className={styles.railList}>
        {LAYERS.map(({ id, label }) => (
          <li key={id}>
            <button type="button" className={styles.railItem} aria-current={id === selected ? 'true' : undefined} onClick={() => onSelect(id)}>
              <span className={styles.railLabel}>{label}</span>
              <span className={styles.railCount}>{counts[id].count}</span>
              {counts[id].pinned > 0 && <span className={styles.railPinned}>{counts[id].pinned} pinned</span>}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

`src/TokenList.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import styles from './ThemeEditor.module.css';
import type { TokenRow } from './theme/rows';

export interface TokenListProps {
  readonly rows: readonly TokenRow[];
  /** Tokens click-to-inspect jumped to; the first is scrolled into view. */
  readonly highlight: readonly string[];
  readonly empty: string;
}

export function TokenList({ rows, highlight, empty }: TokenListProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('[data-highlight]')?.scrollIntoView?.({ block: 'nearest' });
  }, [highlight]);
  if (rows.length === 0) return <p className={styles.empty}>{empty}</p>;
  return (
    <div ref={ref} className={styles.tableScroll}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Token</th>
            <th scope="col">Type</th>
            <th scope="col">Value</th>
            <th scope="col">Replaced</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const lit = highlight.includes(row.name);
            return (
              <tr key={row.name} className={lit ? styles.highlight : undefined} data-highlight={lit || undefined}>
                <td><code>{row.name}</code></td>
                <td>{row.type}</td>
                <td><code>{row.value}</code></td>
                <td>{row.replaced !== undefined && <code>{row.replaced}</code>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Styles** — append to `ThemeEditor.module.css`:

```css
.rail {
  border-right: 1px solid var(--wzl-border);
  overflow-y: auto;
}

.railList {
  list-style: none;
  margin: 0;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.railItem {
  display: flex;
  align-items: baseline;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: var(--wzl-radius-md);
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.railItem[aria-current='true'] {
  background: var(--wzl-surface-raised);
}

.railLabel {
  flex: 1;
}

.railCount,
.railPinned {
  font-variant-numeric: tabular-nums;
  color: var(--wzl-fg-muted);
  font-size: 12px;
}

.empty {
  color: var(--wzl-fg-muted);
}

.tableScroll {
  overflow-x: auto;
}

.table {
  border-collapse: collapse;
  width: 100%;
  font-size: 12px;
}

.table th,
.table td {
  text-align: left;
  padding: 3px 8px;
  border-bottom: 1px solid var(--wzl-border);
  white-space: nowrap;
}

.highlight {
  background: var(--wzl-surface-raised);
  outline: 1px solid var(--wzl-border-strong);
}
```

- [ ] **Step 5: Run both tests** → PASS; `npx tsc --noEmit` and `npx eslint apps/theme-editor/src/LayerRail.tsx apps/theme-editor/src/TokenList.tsx apps/theme-editor/src/theme/rows.ts` clean. `LayerRail` sits in `labkit`'s `.lk-root`, whose `:where()` button defaults can force a height on it (repo `CLAUDE.md`, Traps); the controller checks that in the browser.

- [ ] **Step 6: Commit** the six files; message `add the theme editor's layer rail and token rows`.

---
### Task 10: the workbench and the `#/theme` route

**Files:**
- Create: `apps/theme-editor/src/theme/draft.ts`, `draft.test.ts`, `issues.ts` (under `src/theme/`), `apps/theme-editor/src/ThemeWorkbench.tsx`, `ThemeWorkbench.test.tsx`, `apps/theme-editor/src/ThemeEditor.tsx`, `ThemeEditor.test.tsx`
- Modify: `apps/theme-editor/src/App.tsx`, `apps/theme-editor/src/ThemeEditor.module.css`, `apps/theme-editor/src/PaletteLab.module.css` (drop `.stub` if nothing else uses it)

- [ ] **Step 1: Failing tests**

`src/theme/draft.test.ts`:

```ts
import { resolveTheme, weaselTheme, type ThemeDefinition } from '@weasel-js/theme';
import { describe, expect, it } from 'vitest';
import { deriveDraft } from './draft';
import { lookupOf, weasel } from './fixtures';

describe('deriveDraft', () => {
  it('derives every mode and bakes a runtime theme under the draft name', () => {
    const d = deriveDraft(weasel, lookupOf(), {});
    expect(d.theme.name).toBe('draft-weasel');
    expect(d.views.map((v) => v.mode)).toEqual(['dark', 'light']);
    expect(d.primary.mode).toBe('dark');
    expect(d.primary.resolved['--wzl-surface']).toBe(resolveTheme(weaselTheme, { mode: 'dark' })['--wzl-surface']);
  });

  it('carries the viewed value of every other axis into each view', () => {
    const dense: ThemeDefinition = {
      name: 'dense',
      axes: { density: { default: 'comfortable', values: { comfortable: {}, compact: {} } } },
      pins: { gap: { value: { by: 'density', comfortable: '8px', compact: '4px' } as never, type: 'dimension' } },
    };
    const d = deriveDraft(dense, lookupOf(dense), { density: 'compact' });
    expect(d.views.map((v) => v.mode)).toEqual([undefined]);
    expect(d.primary.selection).toEqual({ density: 'compact' });
  });
});
```

(If a `by` inside a pin's `value` is not how a varying pin is written, write the pin as `gap: { by: 'density', comfortable: { value: '8px', type: 'dimension' }, compact: { value: '4px', type: 'dimension' } }` instead; the assertion is about the selection, not the pin.)

`src/ThemeWorkbench.test.tsx`:

```tsx
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeWorkbench, type WorkbenchProps } from './ThemeWorkbench';
import type { ThemeApi } from './theme/api';
import { weasel } from './theme/fixtures';
import type { PutResult, StoredTheme } from './theme/store';

const stored: StoredTheme = { name: 'weasel', hash: 'h1', emits: true, definition: weasel };
const apiWith = (put: ThemeApi['put'] = vi.fn()): ThemeApi => ({ list: async () => [stored], get: async () => stored, put });
const edited = { ...weasel, description: 'edited' };

function renderBench(overrides: Partial<WorkbenchProps> = {}): WorkbenchProps {
  const props: WorkbenchProps = {
    api: apiWith(),
    themes: [stored],
    stored,
    start: { definition: weasel, baseHash: 'h1' },
    onPick: vi.fn(),
    onSaved: vi.fn(),
    onReload: vi.fn(),
    ...overrides,
  };
  render(<ThemeWorkbench {...props} />);
  return props;
}

describe('<ThemeWorkbench>', () => {
  afterEach(cleanup);

  it('reports how many own tokens a pin overrides, and each layer in the rail', () => {
    renderBench();
    expect(screen.getByText('23 of 100 overridden')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Ramps/ })).toHaveTextContent('23 pinned');
  });

  it('holds Save until the draft differs from what is on disk', () => {
    renderBench();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves against the hash the draft began at, then reads clean', async () => {
    const put = vi.fn(async () => ({ status: 'saved', hash: 'h2', issues: [], regenerated: true, problems: [] }) as PutResult);
    const props = renderBench({ api: apiWith(put), start: { definition: edited, baseHash: 'h1' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save, with unsaved changes' }));
    expect(put).toHaveBeenCalledWith('weasel', edited, 'h1');
    expect(await screen.findByText(/^Saved\./)).toBeInTheDocument();
    expect(props.onSaved).toHaveBeenCalledWith({ ...stored, hash: 'h2', definition: edited });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('offers to reload when the file moved on since the draft began', async () => {
    const put = vi.fn(async () => ({ status: 'conflict', hash: 'h9' }) as PutResult);
    const props = renderBench({ api: apiWith(put), start: { definition: edited, baseHash: 'h0' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save, with unsaved changes' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('changed on disk');
    await userEvent.click(within(alert).getByRole('button', { name: 'Reload from disk' }));
    expect(props.onReload).toHaveBeenCalled();
  });
});
```

`src/ThemeEditor.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeEditor } from './ThemeEditor';
import type { ThemeApi } from './theme/api';

describe('<ThemeEditor>', () => {
  afterEach(cleanup);

  it('falls back to the built themes, read-only, when no dev server answers', async () => {
    const failing: ThemeApi = { list: () => Promise.reject(new Error('404')), get: vi.fn(), put: vi.fn() };
    render(<ThemeEditor api={failing} />);
    expect(await screen.findByText('23 of 100 overridden')).toBeInTheDocument();
    expect(failing.put).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the three** → FAIL.

- [ ] **Step 3: Implement `src/theme/draft.ts`**

```ts
import { fullSelection, resolveTheme, type AxisDefs, type ResolvedTheme, type Selection, type Theme, type ThemeDefinition } from '@weasel-js/theme';
import { derive, mergeChain, type DeriveResult, type Lookup } from '@weasel-js/theme/engine';
import { runtimeTheme } from './model';

export interface ModeView {
  /** `undefined` when the theme declares no mode axis. */
  readonly mode: string | undefined;
  readonly selection: Selection;
  readonly result: DeriveResult;
  readonly resolved: ResolvedTheme;
}

export interface DerivedDraft {
  readonly merged: ThemeDefinition;
  readonly axes: AxisDefs;
  readonly theme: Theme;
  readonly views: readonly ModeView[];
  /** The view at the default mode: what counts and single-value columns read. */
  readonly primary: ModeView;
}

/** Everything the workbench shows for one draft. Throws as `derive` does, on a cycle or a dangling reference. */
export function deriveDraft(def: ThemeDefinition, lookup: Lookup, axisValues: Selection): DerivedDraft {
  const merged = mergeChain(def, lookup);
  const axes = merged.axes ?? {};
  const theme = runtimeTheme(def, lookup, `draft-${def.name}`);
  const modes = axes.mode ? Object.keys(axes.mode.values) : [undefined];
  const views = modes.map((mode) => {
    const selection = fullSelection(axes, mode === undefined ? axisValues : { ...axisValues, mode });
    return { mode, selection, result: derive(def, selection, lookup), resolved: resolveTheme(theme, selection) };
  });
  const primary = views.find((v) => v.mode === axes.mode?.default) ?? views[0];
  return { merged, axes, theme, views, primary };
}
```

`src/theme/issues.ts`:

```ts
import type { Issue } from '@weasel-js/theme/engine';

export function describeIssue(issue: Issue): string {
  switch (issue.kind) {
    case 'missing-axis-value':
      return `${issue.path} has no value for ${issue.axis}=${issue.value}`;
    case 'untyped-pin':
      return `${issue.token} needs a type`;
    case 'infeasible-ramp':
      return `no arrangement of ${issue.ramp} meets its gates`;
    case 'contrast-unmet':
      return `${issue.token}: no step reaches ${issue.min}:1 against ${issue.against.join(', ')}; using ${issue.picked} at ${issue.ratio.toFixed(2)}:1`;
    case 'check-failed':
      return `${issue.token} reaches ${issue.ratio.toFixed(2)}:1 against ${issue.against}, under ${issue.min}:1`;
    case 'invalid':
      return `${issue.path}: ${issue.message}`;
  }
}
```

- [ ] **Step 4: Implement `src/ThemeWorkbench.tsx`.** Read `Select.tsx`'s `SelectOption` type first and shape `options` to it.

```tsx
import { LabShell, ToolbarRegion, type LabContribution } from '@weasel-js/labkit';
import { fullSelection, type Selection, type ThemeDefinition } from '@weasel-js/theme';
import type { Lookup } from '@weasel-js/theme/engine';
import { Button, RedoIcon, Select, UndoIcon } from '@weasel-js/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LayerRail } from './LayerRail';
import styles from './ThemeEditor.module.css';
import { ThemePreview, type PreviewVariant } from './ThemePreview';
import { TokenList } from './TokenList';
import type { ThemeApi } from './theme/api';
import { deriveDraft, type DerivedDraft } from './theme/draft';
import { clearDraft, persistDraft, type StoredDraft } from './theme/draftStorage';
import { describeIssue } from './theme/issues';
import { LAYERS, countTokens, type LayerId } from './theme/model';
import { layerRows } from './theme/rows';
import type { IssueReport, PutResult, StoredTheme } from './theme/store';
import { useLabHistory, type LabHistory } from './useLabHistory';

export interface WorkbenchProps {
  readonly api: ThemeApi;
  readonly themes: readonly StoredTheme[];
  readonly stored: StoredTheme;
  /** Read once, at mount: a restored draft, or the stored definition. */
  readonly start: StoredDraft;
  readonly onPick: (name: string) => void;
  readonly onSaved: (stored: StoredTheme) => void;
  readonly onReload: () => void;
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const selectionText = (s: Selection) => Object.values(s).join(', ') || 'every selection';

function IssueList({ title, issues }: { title: string; issues: readonly IssueReport[] }) {
  return (
    <div className={styles.status}>
      <p className={styles.statusTitle}>{title}</p>
      <ul className={styles.issues}>
        {issues.map((r, i) => (
          <li key={i}>
            <code>{selectionText(r.selection)}</code> {describeIssue(r.issue)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SaveReport({ report, onReload, onDismiss }: { report: PutResult; onReload: () => void; onDismiss: () => void }) {
  if (report.status === 'conflict') {
    return (
      <div role="alert" className={styles.status}>
        <p>
          <strong>The file changed on disk since this draft began.</strong> Saving would overwrite that change.
        </p>
        <div className={styles.statusActions}>
          <Button size="sm" onClick={onReload}>Reload from disk</Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>Keep editing</Button>
        </div>
      </div>
    );
  }
  if (report.status === 'invalid') return <p role="alert" className={styles.status}>{report.message}</p>;
  return (
    <>
      <p className={styles.status}>
        Saved.{report.regenerated ? ' The generated token files were rewritten.' : ''}
        {report.problems.length > 0 ? ` The generated token files were left alone: ${report.problems.length} problem(s) across the themes.` : ''}
      </p>
      {report.issues.length > 0 && <IssueList title="Saved with issues" issues={report.issues} />}
    </>
  );
}

export function ThemeWorkbench({ api, themes, stored, start, onPick, onSaved, onReload }: WorkbenchProps) {
  const history = useLabHistory<ThemeDefinition>(start.definition);
  const { state: draft, canUndo, canRedo } = history;
  const [saved, setSaved] = useState<ThemeDefinition>(() => (sameJson(start.definition, stored.definition) ? start.definition : stored.definition));
  const [baseHash, setBaseHash] = useState(start.baseHash);
  const [report, setReport] = useState<PutResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [layer, setLayer] = useState<LayerId>('ramps');
  const [axisValues, setAxisValues] = useState<Selection>({});
  const [highlight] = useState<readonly string[]>([]);
  const dirty = draft !== saved;

  useEffect(() => {
    if (dirty) persistDraft({ definition: draft, baseHash });
    else clearDraft(draft.name);
  }, [dirty, draft, baseHash]);

  const lookup = useMemo<Lookup>(() => {
    const byName = new Map(themes.map((t) => [t.name, t.definition]));
    byName.set(draft.name, draft);
    return (name) => byName.get(name);
  }, [themes, draft]);

  // A draft mid-edit can fail to derive (a reference typed half-way); the editor keeps showing the last one that did.
  const lastGood = useRef<DerivedDraft | null>(null);
  const { derived, error } = useMemo(() => {
    try {
      const next = deriveDraft(draft, lookup, axisValues);
      lastGood.current = next;
      return { derived: next, error: null };
    } catch (e) {
      return { derived: lastGood.current, error: (e as Error).message };
    }
  }, [draft, lookup, axisValues]);

  const contributions = useMemo<readonly LabContribution<LabHistory<ThemeDefinition>>[]>(
    () => [
      { id: 'undo', group: 'history', region: 'header', item: { icon: UndoIcon, label: 'Undo', shortcut: '⌘Z', disabled: !canUndo, onActivate: (h) => h.undo() } },
      { id: 'redo', group: 'history', region: 'header', item: { icon: RedoIcon, label: 'Redo', shortcut: '⇧⌘Z', disabled: !canRedo, onActivate: (h) => h.redo() } },
    ],
    [canUndo, canRedo],
  );

  if (!derived) {
    return (
      <LabShell title="Theme editor">
        <div role="alert" className={styles.status}>
          <p>
            {stored.name} does not derive: {error}
          </p>
          <div className={styles.statusActions}>
            <Button size="sm" onClick={onReload}>Discard the draft and reload from disk</Button>
          </div>
        </div>
      </LabShell>
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      const result = await api.put(draft.name, draft, baseHash);
      setReport(result);
      if (result.status === 'saved') {
        setSaved(draft);
        setBaseHash(result.hash);
        onSaved({ ...stored, hash: result.hash, definition: draft });
      }
    } catch (e) {
      setReport({ status: 'invalid', message: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const counts = countTokens(draft, derived.primary.result);
  const liveIssues: IssueReport[] = derived.views.flatMap((v) => v.result.issues.map((issue) => ({ selection: v.selection, issue })));
  const layerLabel = LAYERS.find((l) => l.id === layer)!.label;
  const previewVariants: readonly PreviewVariant[] = [{ label: 'Draft', theme: derived.theme }];

  const layerEditor = (() => {
    switch (layer) {
      default:
        return <TokenList rows={layerRows(layer, draft, derived.primary.result)} highlight={highlight} empty={`${draft.name} has no ${layerLabel.toLowerCase()}.`} />;
    }
  })();

  const header = (
    <div className={styles.header}>
      <Select aria-label="Theme" width="fit" options={themes.map((t) => ({ value: t.name, label: t.name }))} selectedKey={stored.name} onSelectionChange={onPick} />
      {Object.entries(derived.axes)
        .filter(([axis]) => axis !== 'mode')
        .map(([axis, def]) => (
          <Select
            key={axis}
            aria-label={axis}
            width="fit"
            options={Object.keys(def.values).map((v) => ({ value: v, label: `${axis}: ${v}` }))}
            selectedKey={fullSelection(derived.axes, axisValues)[axis]}
            onSelectionChange={(v) => setAxisValues((s) => ({ ...s, [axis]: v }))}
          />
        ))}
      <span className={styles.overridden}>
        {counts.overridden} of {counts.total} overridden
      </span>
      <ToolbarRegion region="header" label="Theme actions" contributions={contributions} ctx={history} />
      <Button variant="primary" size="sm" disabled={!dirty || saving} onClick={save} ariaLabel={dirty ? 'Save, with unsaved changes' : 'Save'}>
        {dirty && <span className={styles.dirtyDot} aria-hidden="true" />}
        Save
      </Button>
    </div>
  );

  return (
    <LabShell title="Theme editor" header={header}>
      <div className={styles.workbench}>
        <LayerRail counts={counts.layers} selected={layer} onSelect={setLayer} />
        <section className={styles.editor} aria-label={`${layerLabel} layer`}>
          {report && <SaveReport report={report} onReload={onReload} onDismiss={() => setReport(null)} />}
          {error && (
            <p role="alert" className={styles.status}>
              This draft does not derive: {error}. The preview shows the last version that did.
            </p>
          )}
          {liveIssues.length > 0 && <IssueList title="Issues" issues={liveIssues} />}
          {layerEditor}
        </section>
        <aside className={styles.previewColumn} aria-label="Preview">
          <ThemePreview variants={previewVariants} selection={axisValues} />
        </aside>
      </div>
    </LabShell>
  );
}
```

`highlight`'s setter arrives with click-to-inspect (Task 14); until then the tuple destructures only the value. The `switch` gains a case per layer editor in Tasks 12–13.

- [ ] **Step 5: Implement `src/ThemeEditor.tsx`**

```tsx
import { LabShell } from '@weasel-js/labkit';
import { useCallback, useEffect, useState } from 'react';
import styles from './ThemeEditor.module.css';
import { ThemeWorkbench } from './ThemeWorkbench';
import { bundledThemeApi, httpThemeApi, type ThemeApi } from './theme/api';
import { clearDraft, loadDraft, loadLastTheme, persistLastTheme } from './theme/draftStorage';
import type { StoredTheme } from './theme/store';

interface Loaded {
  readonly api: ThemeApi;
  readonly themes: readonly StoredTheme[];
}

export function ThemeEditor({ api }: { readonly api?: ThemeApi }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [name, setName] = useState<string | null>(loadLastTheme);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let live = true;
    const primary = api ?? httpThemeApi();
    primary
      .list()
      .then((themes) => ({ api: primary, themes }))
      .catch(async () => {
        const fallback = bundledThemeApi();
        return { api: fallback, themes: await fallback.list() };
      })
      .then((next) => {
        if (live) setLoaded(next);
      });
    return () => {
      live = false;
    };
  }, [api]);

  const replace = useCallback(
    (theme: StoredTheme) => setLoaded((l) => l && { ...l, themes: l.themes.map((t) => (t.name === theme.name ? theme : t)) }),
    [],
  );

  if (!loaded) {
    return (
      <LabShell title="Theme editor">
        <p className={styles.loading}>Loading themes…</p>
      </LabShell>
    );
  }

  const current = loaded.themes.find((t) => t.name === name) ?? loaded.themes[0];
  const draft = loadDraft(current.name);
  const reload = async () => {
    clearDraft(current.name);
    replace(await loaded.api.get(current.name));
    setGeneration((g) => g + 1);
  };

  return (
    <ThemeWorkbench
      key={`${current.name}:${generation}`}
      api={loaded.api}
      themes={loaded.themes}
      stored={current}
      start={draft ?? { definition: current.definition, baseHash: current.hash }}
      onPick={(next) => {
        persistLastTheme(next);
        setName(next);
      }}
      onSaved={replace}
      onReload={reload}
    />
  );
}
```

- [ ] **Step 6: Route** — in `App.tsx` replace the `route === 'theme'` stub with `return <ThemeEditor />;`, import it, and rewrite the file's docstring to say the app holds the palette lab and the theme editor. Remove `.stub` from `PaletteLab.module.css` if `grep -rn "styles.stub" apps/theme-editor/src` finds nothing else.

- [ ] **Step 7: Styles** — append to `ThemeEditor.module.css`:

```css
/* `.lk-shell-body` is a block container, so the workbench takes its height rather than flexing. */
.workbench {
  display: grid;
  grid-template-columns: 11rem minmax(0, 1fr) minmax(18rem, 30rem);
  height: 100%;
  min-height: 0;
}

.editor {
  overflow: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.previewColumn {
  overflow: auto;
  padding: 12px;
  border-left: 1px solid var(--wzl-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

@media (max-width: 900px) {
  .workbench {
    grid-template-columns: 1fr;
    height: auto;
  }

  .rail {
    border-right: 0;
    border-bottom: 1px solid var(--wzl-border);
  }

  .previewColumn {
    border-left: 0;
  }
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.overridden {
  font-variant-numeric: tabular-nums;
  color: var(--wzl-fg-muted);
  font-size: 12px;
}

.dirtyDot {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 6px;
  border-radius: 50%;
  background: currentColor;
}

.status {
  margin: 0;
  padding: 8px 10px;
  border: 1px solid var(--wzl-border);
  border-radius: var(--wzl-radius-md);
  background: var(--wzl-surface-raised);
}

.statusTitle {
  margin: 0 0 4px;
  font-weight: 600;
}

.statusActions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.issues {
  margin: 0;
  padding-left: 16px;
}

.loading {
  padding: 16px;
  color: var(--wzl-fg-muted);
}
```

- [ ] **Step 8: Run** the three test files, `apps/theme-editor/src/PaletteLab.test.tsx`, `npx tsc --noEmit`, `npx eslint apps/theme-editor/src` → clean.

- [ ] **Step 9: Commit** the files above; message `add the theme editor workbench at #/theme`.

---
### Task 11: move the palette constraints into shared files

**Files:**
- Create: `apps/theme-editor/src/palette/ConstraintsPanel.tsx`, `ConstraintsPanel.test.tsx`, `unmetGates.ts` (under `src/palette/`)
- Modify: `apps/theme-editor/src/PaletteLab.tsx`

`forge-sidebar-clicks` adds an import and two `LabShell` props to `PaletteLab.tsx`. Keep this task's edits to that file inside the constraint groups and `unmetGates`, so the two branches touch different hunks.

- [ ] **Step 1: Failing test** — `src/palette/ConstraintsPanel.test.tsx`

```tsx
import { DEFAULT_CONSTRAINTS } from '@weasel-js/theme/engine';
import { PropertyPanel } from '@weasel-js/ui';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConstraintsPanel } from './ConstraintsPanel';

describe('<ConstraintsPanel>', () => {
  afterEach(cleanup);

  it('shows every gate group, and the count unless the caller fixes it', () => {
    const { rerender } = render(<PropertyPanel title="c"><ConstraintsPanel c={DEFAULT_CONSTRAINTS} onSet={vi.fn()} /></PropertyPanel>);
    for (const label of ['Colors', 'Order', 'Min hue gap', 'Min contrast', 'From surface', 'Between colors', 'Target', 'Pull', 'Fraction of cap', 'Equalize']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    rerender(<PropertyPanel title="c"><ConstraintsPanel c={DEFAULT_CONSTRAINTS} onSet={vi.fn()} fixedCount /></PropertyPanel>);
    expect(screen.queryByText('Colors')).toBeNull();
  });
});
```

- [ ] **Step 2: Run** `npx vitest run --project=draw apps/theme-editor/src/palette/ConstraintsPanel.test.tsx` → FAIL.

- [ ] **Step 3: Move `unmetGates`** verbatim, with its docstring, from `PaletteLab.tsx` into `src/palette/unmetGates.ts` as `export function unmetGates(...)`, importing `floorDegrees`, `type generate` and `type Constraints` from `@weasel-js/theme/engine`. `PaletteLab.tsx` imports it back.

- [ ] **Step 4: Move the groups.** `src/palette/ConstraintsPanel.tsx` holds the four `PropertyGroup`s now inline in `PaletteLab.tsx` ("Set", "Gates", "Lightness law", "Chroma"), copied verbatim except: every `set(` becomes `onSet(`; the "Colors" `SliderRow` renders only when `!fixedCount`; the "Surface" `ToggleRow` is removed from the Set group and replaced by `{setRows}`.

```tsx
import type { Constraints } from '@weasel-js/theme/engine';
import { PropertyGroup, SliderRow, ToggleRow } from '@weasel-js/ui';
import type { ReactNode } from 'react';

export type SetConstraint = <K extends keyof Constraints>(key: K, value: Constraints[K]) => void;

export interface ConstraintsPanelProps {
  readonly c: Constraints;
  readonly onSet: SetConstraint;
  /** A categorical ramp's count is its step list, so the ramp editor hides the slider. */
  readonly fixedCount?: boolean;
  /** Rows appended to the Set group. */
  readonly setRows?: ReactNode;
}

/** The palette generator's constraints as property groups, for a `PropertyPanel`. */
export function ConstraintsPanel({ c, onSet, fixedCount = false, setRows }: ConstraintsPanelProps) {
  return (
    <>
      <PropertyGroup title="Set">
        {!fixedCount && <SliderRow label="Colors" value={c.count} min={5} max={32} step={1} onChange={(v) => onSet('count', v)} />}
        {/* ...the Order ToggleRow, verbatim... */}
        {setRows}
      </PropertyGroup>
      {/* ...Gates, Lightness law and Chroma groups, verbatim, with onSet... */}
    </>
  );
}
```

The two `{/* ... */}` lines stand for the JSX being moved: paste it from `PaletteLab.tsx`, don't retype it. In `PaletteLab.tsx` the four groups become:

```tsx
<ConstraintsPanel
  c={c}
  onSet={set}
  setRows={
    <ToggleRow
      label="Surface"
      value={surfaceKey}
      options={[
        { value: 'dark', label: 'Dark' },
        { value: 'light', label: 'Light' },
      ]}
      onChange={setSurfaceKey}
      description="Which background the contrast floor is measured against."
    />
  }
/>
```

Drop the `@weasel-js/ui` imports `PaletteLab.tsx` no longer uses (`SliderRow`; `ToggleRow` stays).

- [ ] **Step 5: Run** the new test and `apps/theme-editor/src/PaletteLab.test.tsx` → PASS. `npx tsc --noEmit`, `npx eslint apps/theme-editor/src/palette apps/theme-editor/src/PaletteLab.tsx` clean.

- [ ] **Step 6: Commit** the four files; message `move the palette lab's constraint groups into a shared panel`.

---

### Task 12: the ramps layer

**Files:**
- Create: `apps/theme-editor/src/theme/ramps.ts`, `ramps.test.ts` (under `src/theme/`), `apps/theme-editor/src/layers/RampsLayer.tsx`, `RampsLayer.test.tsx` (under `src/layers/`)
- Modify: `apps/theme-editor/src/ThemeWorkbench.tsx`, `apps/theme-editor/src/ThemeEditor.module.css`

- [ ] **Step 1: Failing tests**

`src/theme/ramps.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { deriveDraft } from './draft';
import { lookupOf, weasel } from './fixtures';
import { rampView, readParam, writeParam } from './ramps';

describe('rampView', () => {
  const d = deriveDraft(weasel, lookupOf(), {});
  const gray = rampView('gray', d.merged.ramps!.gray, d.primary.result, d.primary.resolved);

  it('lists each step with its final color, and the generated one under a pin', () => {
    expect(gray.steps.map((s) => s.step)).toEqual(['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']);
    expect(gray.steps.every((s) => s.pinned)).toBe(true);
    expect(gray.steps.find((s) => s.step === '800')?.generated).toBe('#1a1c21');
  });

  it('measures the spread of the lightness steps, pinned and generated', () => {
    expect(gray.dL).toHaveLength(9);
    expect(gray.spread).toBeCloseTo(3.609, 2);
    expect(gray.generatedSpread).toBeCloseTo(1.753, 2);
  });
});

describe('writeParam', () => {
  const entry = { kind: 'lightness' as const, steps: ['a', 'b'], lightness: [0.9, 0.2] as [number, number] };

  it('writes into the lightness pair and into chroma, creating it', () => {
    expect(writeParam(entry, 'lightness.1', 0.3).lightness).toEqual([0.9, 0.3]);
    expect(writeParam(entry, 'chroma.darkBias', 0.5).chroma).toEqual({ darkBias: 0.5 });
    expect(readParam(writeParam(entry, 'curve', 0.4), 'curve')).toBe(0.4);
  });
});
```

Spread is the largest step in L over the smallest, measured from the engine on 2026-09-14: 3.609 pinned, 1.753 generated (the spec's 1.79 was the hand-fitted figure). If the printed values differ, report them to the controller rather than editing the assertion.

`src/layers/RampsLayer.test.tsx`:

```tsx
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ThemeDefinition } from '@weasel-js/theme';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveDraft } from '../theme/draft';
import { lookupOf, weasel } from '../theme/fixtures';
import { RampsLayer, type RampsLayerProps } from './RampsLayer';

function renderRamps(): RampsLayerProps & { onChange: ReturnType<typeof vi.fn> } {
  const lookup = lookupOf();
  const props = { draft: weasel, derived: deriveDraft(weasel, lookup, {}), lookup, highlight: [], focused: null, onFocus: vi.fn(), onChange: vi.fn() };
  render(<RampsLayer {...props} />);
  return props;
}
const nextDef = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[0][0] as ThemeDefinition;

describe('<RampsLayer>', () => {
  afterEach(cleanup);

  it('shows the generated gray beneath the pinned one', () => {
    renderRamps();
    const gray = screen.getByRole('region', { name: 'gray ramp' });
    expect(within(gray).getByRole('rowheader', { name: 'Generated' })).toBeInTheDocument();
    expect(within(gray).getAllByText('#1a1c21').length).toBeGreaterThan(0);
  });

  it('unpins a step', async () => {
    const props = renderRamps();
    await userEvent.click(screen.getByRole('button', { name: 'Unpin gray-800' }));
    expect(nextDef(props.onChange).pins).not.toHaveProperty('gray-800');
  });

  it("asks before adopting weasel's generated ramp", async () => {
    const props = renderRamps();
    await userEvent.click(within(screen.getByRole('region', { name: 'gray ramp' })).getByRole('button', { name: 'Adopt generated' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(props.onChange).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Adopt' }));
    expect(Object.keys(nextDef(props.onChange).pins ?? {}).filter((n) => n.startsWith('gray-'))).toEqual([]);
  });

  it('opens the palette constraints in place for a categorical ramp', async () => {
    renderRamps();
    await userEvent.click(within(screen.getByRole('region', { name: 'swatch ramp' })).getByRole('button', { name: 'Edit gates' }));
    expect(screen.getByText('Min contrast')).toBeInTheDocument();
    expect(screen.queryByText('Colors')).toBeNull();
  });
});
```

- [ ] **Step 2: Run both** → FAIL.

- [ ] **Step 3: Implement `src/theme/ramps.ts`**

```ts
import type { ResolvedTheme } from '@weasel-js/theme';
import { declaredSteps, toLch, type DeriveResult, type LightnessRampDef, type RampDef } from '@weasel-js/theme/engine';

export interface StepView {
  readonly step: string;
  readonly token: string;
  /** The final color, pins applied. */
  readonly hex: string;
  readonly L: number;
  readonly pinned: boolean;
  /** What the generator made, when a pin replaced it. */
  readonly generated: string | undefined;
}

export interface RampView {
  readonly name: string;
  readonly kind: RampDef['kind'];
  readonly steps: readonly StepView[];
  /** |ΔL| between neighbors, one fewer than the steps. */
  readonly dL: readonly number[];
  readonly generatedDL: readonly number[];
  /** Largest step in L over the smallest; null under two measurable steps. */
  readonly spread: number | null;
  readonly generatedSpread: number | null;
  readonly anyPinned: boolean;
}

const HEX = /^#[0-9a-f]{6}$/i;
const lightnessOf = (hex: string) => (HEX.test(hex) ? toLch(hex).L : Number.NaN);
const deltas = (Ls: readonly number[]) => Ls.slice(1).map((L, i) => Math.abs(L - Ls[i]));

function spreadOf(ds: readonly number[]): number | null {
  const usable = ds.filter((d) => Number.isFinite(d) && d > 0);
  return usable.length < 2 ? null : Math.max(...usable) / Math.min(...usable);
}

export function rampView(name: string, entry: RampDef, result: DeriveResult, resolved: ResolvedTheme): RampView {
  const final = resolved as Readonly<Record<string, string>>;
  const steps = declaredSteps(entry)
    .filter((step) => Object.hasOwn(result.tokens, `${name}-${step}`))
    .map((step): StepView => {
      const token = `${name}-${step}`;
      const p = result.provenance[token];
      const hex = final[`--wzl-${token}`] ?? String(result.tokens[token].value);
      const generated = p?.pinned && typeof p.generated?.value === 'string' ? p.generated.value : undefined;
      return { step, token, hex, L: lightnessOf(hex), pinned: p?.pinned ?? false, generated };
    });
  const dL = deltas(steps.map((s) => s.L));
  const generatedDL = deltas(steps.map((s) => lightnessOf(s.generated ?? s.hex)));
  return {
    name,
    kind: entry.kind,
    steps,
    dL,
    generatedDL,
    spread: spreadOf(dL),
    generatedSpread: spreadOf(generatedDL),
    anyPinned: steps.some((s) => s.pinned),
  };
}

/** `curve`, `lightness.0`, `chroma.peak`: one level of nesting, which is all a lightness ramp has. */
export function readParam(entry: LightnessRampDef, key: string): unknown {
  const [head, tail] = key.split('.');
  const top = (entry as unknown as Record<string, unknown>)[head];
  if (tail === undefined) return top;
  return top && typeof top === 'object' ? (top as Record<string, unknown>)[tail] : undefined;
}

export function writeParam(entry: LightnessRampDef, key: string, value: number): LightnessRampDef {
  const [head, tail] = key.split('.');
  if (tail === undefined) return { ...entry, [head]: value };
  const top = (entry as unknown as Record<string, unknown>)[head];
  if (Array.isArray(top)) {
    const next = [...top];
    next[Number(tail)] = value;
    return { ...entry, [head]: next } as LightnessRampDef;
  }
  return { ...entry, [head]: { ...(top as object | undefined), [tail]: value } } as LightnessRampDef;
}
```

- [ ] **Step 4: Implement `src/layers/RampsLayer.tsx`.** `PinIcon` is the app's own (`../PinIcon`), used as `PalettePreview.tsx` uses it; `AnchorList` takes `anchors` and `onChange` as `PaletteLab.tsx` passes them.

```tsx
import { isByAxis, type ThemeDefinition } from '@weasel-js/theme';
import {
  DEFAULT_CONSTRAINTS,
  declaredSteps,
  generate,
  type CategoricalRampDef,
  type Constraints,
  type LightnessRampDef,
  type Lookup,
  type RampDef,
} from '@weasel-js/theme/engine';
import { Button, Dialog, PropertyGroup, PropertyPanel, SliderRow } from '@weasel-js/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnchorList } from '../AnchorList';
import { PinIcon } from '../PinIcon';
import styles from '../ThemeEditor.module.css';
import { ConstraintsPanel, type SetConstraint } from '../palette/ConstraintsPanel';
import { unmetGates } from '../palette/unmetGates';
import type { DerivedDraft } from '../theme/draft';
import { adoptGenerated, removePin, setPin, setRamp } from '../theme/model';
import { rampView, readParam, writeParam, type StepView } from '../theme/ramps';

export interface RampsLayerProps {
  readonly draft: ThemeDefinition;
  readonly derived: DerivedDraft;
  readonly lookup: Lookup;
  readonly highlight: readonly string[];
  /** The ramp the preview compares pinned against generated. */
  readonly focused: string | null;
  readonly onFocus: (ramp: string | null) => void;
  readonly onChange: (next: ThemeDefinition, key: string, label?: string) => void;
}

const PARAMS = [
  { key: 'lightness.0', label: 'First L', min: 0, max: 1, step: 0.001, digits: 3 },
  { key: 'lightness.1', label: 'Last L', min: 0, max: 1, step: 0.001, digits: 3 },
  { key: 'curve', label: 'Curve', min: 0, max: 1, step: 0.01, digits: 2 },
  { key: 'hue', label: 'Hue', min: 0, max: 360, step: 1, digits: 0 },
  { key: 'chroma.peak', label: 'Chroma peak', min: 0, max: 0.37, step: 0.0005, digits: 4 },
  { key: 'chroma.lightBias', label: 'Light bias', min: 0, max: 2, step: 0.01, digits: 2 },
  { key: 'chroma.darkBias', label: 'Dark bias', min: 0, max: 2, step: 0.01, digits: 2 },
] as const;

function Swatch({ hex, caption }: { hex: string; caption?: string }) {
  return (
    <span className={styles.swatchCell}>
      <span className={styles.swatch} style={{ background: hex }} title={hex} />
      <code className={styles.hex}>{hex}</code>
      {caption !== undefined && <span className={styles.metric}>{caption}</span>}
    </span>
  );
}

type Edit = RampsLayerProps['onChange'];

function LightnessParams({ name, entry, draft, lookup, onChange }: { name: string; entry: LightnessRampDef; draft: ThemeDefinition; lookup: Lookup; onChange: Edit }) {
  const anchored = entry.anchor !== undefined;
  return (
    <PropertyPanel title={`${name} parameters`}>
      <PropertyGroup title="Walk">
        {PARAMS.filter((p) => !(anchored && (p.key === 'hue' || p.key === 'chroma.peak'))).map((p) => {
          const raw = readParam(entry, p.key);
          if (raw !== undefined && typeof raw !== 'number') {
            return (
              <p key={p.key} className={styles.paramNote}>
                {p.label}: <code>{JSON.stringify(raw)}</code>
              </p>
            );
          }
          return (
            <SliderRow
              key={p.key}
              label={p.label}
              value={raw ?? 0}
              min={p.min}
              max={p.max}
              step={p.step}
              format={(v) => v.toFixed(p.digits)}
              onChange={(v) => onChange(setRamp(draft, lookup, name, (e) => writeParam(e as LightnessRampDef, p.key, v)), `ramps.${name}.${p.key}`)}
            />
          );
        })}
        {anchored && <p className={styles.paramNote}>Hue and chroma peak come from the anchor.</p>}
      </PropertyGroup>
    </PropertyPanel>
  );
}

function GatesEditor({ name, entry, draft, lookup, onChange }: { name: string; entry: CategoricalRampDef; draft: ThemeDefinition; lookup: Lookup; onChange: Edit }) {
  const c = useMemo<Constraints>(() => {
    const gates = isByAxis(entry.gates) ? {} : Object.fromEntries(Object.entries(entry.gates ?? {}).filter(([, v]) => !isByAxis(v)));
    return { ...DEFAULT_CONSTRAINTS, ...gates, count: declaredSteps(entry).length, anchors: entry.anchors ?? [] } as Constraints;
  }, [entry]);
  const palette = useMemo(() => generate(c), [c]);
  if (isByAxis(entry.gates)) {
    return <p className={styles.paramNote}>{name}&apos;s gates vary by {entry.gates.by}; edit them in the definition file.</p>;
  }
  const edit = (update: (e: CategoricalRampDef) => CategoricalRampDef, key: string) =>
    onChange(setRamp(draft, lookup, name, (e) => update(e as CategoricalRampDef) as RampDef), key);
  const setGate: SetConstraint = (key, value) => edit((e) => ({ ...e, gates: { ...(e.gates as object | undefined), [key]: value } }), `ramps.${name}.gates.${String(key)}`);
  const unmet = palette.feasible ? [] : unmetGates(c, palette.stats);
  return (
    <div className={styles.gates}>
      <PropertyPanel title={`${name} gates`}>
        <ConstraintsPanel c={c} onSet={setGate} fixedCount />
        <AnchorList anchors={c.anchors} onChange={(anchors) => edit((e) => ({ ...e, anchors }), `ramps.${name}.anchors`)} />
      </PropertyPanel>
      {!palette.feasible && (
        <p role="status" className={styles.status}>
          <strong>No arrangement satisfies these gates.</strong> {unmet.join('; ') || 'Loosen a gate.'}
        </p>
      )}
    </div>
  );
}

export function RampsLayer({ draft, derived, lookup, highlight, focused, onFocus, onChange }: RampsLayerProps) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [editingGates, setEditingGates] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('[data-highlight]')?.scrollIntoView?.({ block: 'nearest' });
  }, [highlight]);

  const ramps = Object.entries(derived.merged.ramps ?? {});
  if (ramps.length === 0) return <p className={styles.empty}>{draft.name} has no ramps.</p>;

  const adopt = (ramp: string) => onChange(adoptGenerated(draft, lookup, ramp), `adopt:${ramp}`, `adopt generated ${ramp}`);
  // weasel's own ramps feed every surface the visual baselines record.
  const requestAdopt = (ramp: string) => (draft.name === 'weasel' ? setConfirming(ramp) : adopt(ramp));
  const ownPin = (token: string) => Object.hasOwn(draft.pins ?? {}, token);
  const togglePin = (s: StepView) =>
    s.pinned
      ? onChange(removePin(draft, s.token), `pin:${s.token}`, `unpin ${s.token}`)
      : onChange(setPin(draft, s.token, { value: s.hex, type: 'color' }), `pin:${s.token}`, `pin ${s.token}`);

  return (
    <div ref={ref} className={styles.ramps}>
      {ramps.map(([name, entry]) => {
        const view = rampView(name, entry, derived.primary.result, derived.primary.resolved);
        const lit = (token: string) => highlight.includes(token);
        return (
          <section key={name} className={focused === name ? `${styles.ramp} ${styles.rampFocused}` : styles.ramp} aria-label={`${name} ramp`}>
            <header className={styles.rampHeader}>
              <h3 className={styles.rampTitle}>{name}</h3>
              <span className={styles.metric}>{view.kind}</span>
              {view.spread !== null && <span className={styles.metric}>spread {view.spread.toFixed(2)}×</span>}
              {view.anyPinned && view.generatedSpread !== null && <span className={styles.metric}>generated {view.generatedSpread.toFixed(2)}×</span>}
              <span className={styles.rampActions}>
                {view.anyPinned && (
                  <Button size="sm" pressed={focused === name} onClick={() => onFocus(focused === name ? null : name)}>
                    Compare in preview
                  </Button>
                )}
                <Button size="sm" disabled={!view.steps.some((s) => s.pinned && ownPin(s.token))} onClick={() => requestAdopt(name)}>
                  Adopt generated
                </Button>
                {entry.kind === 'categorical' && (
                  <Button size="sm" pressed={editingGates === name} onClick={() => setEditingGates(editingGates === name ? null : name)}>
                    Edit gates
                  </Button>
                )}
              </span>
            </header>
            <div className={styles.tableScroll}>
              <table className={styles.strip}>
                <tbody>
                  <tr>
                    <th scope="row">{view.anyPinned ? 'Pinned' : 'Generated'}</th>
                    {view.steps.map((s) => (
                      <td key={s.step} className={lit(s.token) ? styles.highlight : undefined} data-highlight={lit(s.token) || undefined}>
                        <Swatch hex={s.hex} caption={s.step} />
                      </td>
                    ))}
                  </tr>
                  {view.anyPinned && (
                    <tr>
                      <th scope="row">Generated</th>
                      {view.steps.map((s) => (
                        <td key={s.step}>{s.generated !== undefined ? <Swatch hex={s.generated} /> : <span className={styles.metric}>—</span>}</td>
                      ))}
                    </tr>
                  )}
                  {entry.kind === 'lightness' && (
                    <>
                      <tr>
                        <th scope="row">L</th>
                        {view.steps.map((s) => (
                          <td key={s.step} className={styles.num}>{s.L.toFixed(3)}</td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row">ΔL</th>
                        <td />
                        {view.dL.map((d, i) => (
                          <td key={view.steps[i + 1].step} className={styles.num}>{d.toFixed(3)}</td>
                        ))}
                      </tr>
                    </>
                  )}
                  <tr>
                    <th scope="row">Pin</th>
                    {view.steps.map((s) => (
                      <td key={s.step}>
                        <Button
                          size="sm"
                          variant="ghost"
                          iconOnly
                          ariaLabel={`${s.pinned ? 'Unpin' : 'Pin'} ${s.token}`}
                          pressed={s.pinned}
                          disabled={s.pinned && !ownPin(s.token)}
                          onClick={() => togglePin(s)}
                        >
                          <PinIcon />
                        </Button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            {entry.kind === 'lightness' && <LightnessParams name={name} entry={entry} draft={draft} lookup={lookup} onChange={onChange} />}
            {entry.kind === 'categorical' && editingGates === name && <GatesEditor name={name} entry={entry} draft={draft} lookup={lookup} onChange={onChange} />}
          </section>
        );
      })}
      <Dialog
        isOpen={confirming !== null}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        role="alertdialog"
        title="Adopt the generated ramp?"
        footer={
          <>
            <Button onClick={() => setConfirming(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (confirming !== null) adopt(confirming);
                setConfirming(null);
              }}
            >
              Adopt
            </Button>
          </>
        }
      >
        <p>
          This removes the pins on every {confirming} step, so each takes its generated color. Every surface that reads them moves, and the
          visual baselines have to be re-recorded.
        </p>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 5: Wire it into the workbench.** In `ThemeWorkbench.tsx`: add `const [focusRamp, setFocusRamp] = useState<string | null>(null);` beside the other state; add a `case 'ramps':` to the layer switch returning `<RampsLayer draft={draft} derived={derived} lookup={lookup} highlight={highlight} focused={focusRamp} onFocus={setFocusRamp} onChange={history.update} />`; and build the preview variants, above `previewVariants`' current line, as:

```tsx
const generatedTheme = useMemo(
  () => (focusRamp === null ? null : runtimeTheme(adoptGenerated(draft, lookup, focusRamp), lookup, `draft-${draft.name}-generated`)),
  [focusRamp, draft, lookup],
);
```

(declared with the other hooks, before the `if (!derived)` return) and

```tsx
const previewVariants: readonly PreviewVariant[] = generatedTheme
  ? [{ label: 'Pinned', theme: derived.theme }, { label: `Generated ${focusRamp}`, theme: generatedTheme }]
  : [{ label: 'Draft', theme: derived.theme }];
```

- [ ] **Step 6: Styles** — append to `ThemeEditor.module.css`:

```css
.ramps {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ramp {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--wzl-border);
  border-radius: var(--wzl-radius-md);
}

.rampFocused {
  border-color: var(--wzl-border-strong);
}

.rampHeader {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
}

.rampTitle {
  margin: 0;
  font-size: 14px;
}

.rampActions {
  margin-left: auto;
  display: flex;
  gap: 6px;
}

.metric {
  color: var(--wzl-fg-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.strip {
  border-collapse: collapse;
  font-size: 11px;
}

.strip th {
  text-align: left;
  padding-right: 8px;
  color: var(--wzl-fg-muted);
  font-weight: 500;
  white-space: nowrap;
}

.strip td {
  padding: 2px 3px;
  text-align: center;
}

.num {
  font-variant-numeric: tabular-nums;
}

.swatchCell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.swatch {
  display: block;
  width: 44px;
  height: 28px;
  border-radius: 4px;
  border: 1px solid var(--wzl-border);
}

.hex {
  font-size: 10px;
}

.paramNote {
  margin: 0;
  font-size: 12px;
  color: var(--wzl-fg-muted);
}

.gates {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
```

- [ ] **Step 7: Run** both new tests and `ThemeWorkbench.test.tsx` → PASS; tsc and `npx eslint apps/theme-editor/src` clean.

- [ ] **Step 8: Commit** the six files; message `edit ramps in the theme editor: steps, pins, parameters, gates`.

---
### Task 13: the scales layer

weasel has no scales, so this layer is exercised on a fixture with a density axis.

**Files:**
- Create: `apps/theme-editor/src/theme/scales.ts`, `scales.test.ts` (under `src/theme/`), `apps/theme-editor/src/layers/ScalesLayer.tsx`, `ScalesLayer.test.tsx` (under `src/layers/`)
- Modify: `apps/theme-editor/src/theme/fixtures.ts`, `apps/theme-editor/src/ThemeWorkbench.tsx`, `apps/theme-editor/src/ThemeEditor.module.css`

- [ ] **Step 1: Fixture** — append to `src/theme/fixtures.ts`:

```ts
/** A root theme whose spacing scale steps differently per density. */
export const spaced: ThemeDefinition = {
  name: 'spaced',
  axes: { density: { default: 'comfortable', values: { comfortable: {}, compact: {} } } },
  scales: { space: { steps: ['xs', 'sm', 'md'], base: 4, step: { by: 'density', comfortable: 4, compact: 3 } } },
};
```

- [ ] **Step 2: Failing tests**

`src/theme/scales.test.ts`:

```ts
import type { ThemeDefinition } from '@weasel-js/theme';
import { describe, expect, it } from 'vitest';
import { lookupOf, spaced } from './fixtures';
import { scaleTable } from './scales';

describe('scaleTable', () => {
  it('gives one column per value of each axis the scale varies on', () => {
    expect(scaleTable(spaced, lookupOf(spaced), 'space')).toEqual({
      steps: ['xs', 'sm', 'md'],
      columns: [
        { label: 'density=comfortable', selection: { density: 'comfortable' }, values: { xs: '4px', sm: '8px', md: '12px' } },
        { label: 'density=compact', selection: { density: 'compact' }, values: { xs: '4px', sm: '7px', md: '10px' } },
      ],
    });
  });

  it('gives a single column to a scale that varies on nothing', () => {
    const flat: ThemeDefinition = { ...spaced, scales: { space: { steps: ['xs', 'sm'], base: 4, ratio: 2 } } };
    expect(scaleTable(flat, lookupOf(flat), 'space').columns).toEqual([{ label: 'value', selection: {}, values: { xs: '4px', sm: '8px' } }]);
  });
});
```

`src/layers/ScalesLayer.test.tsx`:

```tsx
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveDraft } from '../theme/draft';
import { lookupOf, spaced, weasel } from '../theme/fixtures';
import { ScalesLayer } from './ScalesLayer';

describe('<ScalesLayer>', () => {
  afterEach(cleanup);

  it('draws a ladder per scale with a column per density', () => {
    const lookup = lookupOf(spaced);
    render(<ScalesLayer draft={spaced} derived={deriveDraft(spaced, lookup, {})} lookup={lookup} highlight={[]} onChange={vi.fn()} />);
    const space = screen.getByRole('region', { name: 'space scale' });
    expect(within(space).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Step', 'density=comfortable', 'density=compact']);
    expect(within(space).getByText('7px')).toBeInTheDocument();
  });

  it('says so when the theme has no scales', () => {
    const lookup = lookupOf();
    render(<ScalesLayer draft={weasel} derived={deriveDraft(weasel, lookup, {})} lookup={lookup} highlight={[]} onChange={vi.fn()} />);
    expect(screen.getByText('weasel has no scales.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run both** → FAIL.

- [ ] **Step 4: Implement `src/theme/scales.ts`.** Before writing it, confirm `axisDependencies` returns a record keyed by token name (`deps.ts`, and how `emit/css.ts` reads it).

```ts
import { enumerateSelections, type AxisDefs, type Selection, type ThemeDefinition } from '@weasel-js/theme';
import { axisDependencies, declaredSteps, derive, mergeChain, type Lookup } from '@weasel-js/theme/engine';

export interface ScaleColumn {
  readonly label: string;
  readonly selection: Selection;
  /** Step → value, e.g. `8px`. */
  readonly values: Readonly<Record<string, string>>;
}

export interface ScaleTable {
  readonly steps: readonly string[];
  readonly columns: readonly ScaleColumn[];
}

export function scaleTable(def: ThemeDefinition, lookup: Lookup, scale: string): ScaleTable {
  const merged = mergeChain(def, lookup);
  const entry = merged.scales?.[scale];
  if (!entry) return { steps: [], columns: [] };
  const steps = declaredSteps(entry);
  const deps = axisDependencies(def, lookup);
  const varying = new Set(steps.flatMap((step) => deps[`${scale}-${step}`]?.all ?? []));
  const axes: AxisDefs = Object.fromEntries(Object.entries(merged.axes ?? {}).filter(([axis]) => varying.has(axis)));
  const columns = enumerateSelections(axes).map((selection) => {
    const tokens = derive(def, selection, lookup).tokens;
    const values: Record<string, string> = {};
    for (const step of steps) {
      const token = tokens[`${scale}-${step}`];
      if (token) values[step] = String(token.value);
    }
    const label = Object.entries(selection).map(([axis, value]) => `${axis}=${value}`).join(', ') || 'value';
    return { label, selection, values };
  });
  return { steps, columns };
}
```

- [ ] **Step 5: Implement `src/layers/ScalesLayer.tsx`**

```tsx
import { isByAxis, type ThemeDefinition } from '@weasel-js/theme';
import type { Lookup, ScaleDef } from '@weasel-js/theme/engine';
import { PropertyGroup, PropertyPanel, SliderRow } from '@weasel-js/ui';
import { useEffect, useMemo, useRef } from 'react';
import styles from '../ThemeEditor.module.css';
import type { DerivedDraft } from '../theme/draft';
import { setScale } from '../theme/model';
import { scaleTable } from '../theme/scales';

export interface ScalesLayerProps {
  readonly draft: ThemeDefinition;
  readonly derived: DerivedDraft;
  readonly lookup: Lookup;
  readonly highlight: readonly string[];
  readonly onChange: (next: ThemeDefinition, key: string, label?: string) => void;
}

const PARAMS = [
  { key: 'base', label: 'Base', min: 0, max: 64, step: 1 },
  { key: 'step', label: 'Step', min: 0, max: 32, step: 1 },
  { key: 'ratio', label: 'Ratio', min: 1, max: 3, step: 0.01 },
] as const;

function ScaleSection({ name, entry, draft, lookup, highlight, onChange }: Omit<ScalesLayerProps, 'derived'> & { name: string; entry: ScaleDef }) {
  const table = useMemo(() => scaleTable(draft, lookup, name), [draft, lookup, name]);
  const px = (v: string | undefined) => (v === undefined ? 0 : Number.parseFloat(v));
  const widest = Math.max(1, ...table.columns.flatMap((c) => Object.values(c.values).map(px)));
  const plain = isByAxis(entry) ? null : entry;
  return (
    <section className={styles.ramp} aria-label={`${name} scale`}>
      <header className={styles.rampHeader}>
        <h3 className={styles.rampTitle}>{name}</h3>
        {plain && <span className={styles.metric}>{plain.step !== undefined ? 'linear' : 'geometric'}</span>}
      </header>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Step</th>
              {table.columns.map((c) => (
                <th key={c.label} scope="col">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.steps.map((step) => {
              const token = `${name}-${step}`;
              const lit = highlight.includes(token);
              return (
                <tr key={step} className={lit ? styles.highlight : undefined} data-highlight={lit || undefined}>
                  <th scope="row"><code>{token}</code></th>
                  {table.columns.map((c) => (
                    <td key={c.label} className={styles.ladderCell}>
                      <span className={styles.num}>{c.values[step]}</span>
                      <span className={styles.ladderBar} style={{ width: `${(px(c.values[step]) / widest) * 100}%` }} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {plain ? (
        <PropertyPanel title={`${name} parameters`}>
          <PropertyGroup title="Scale">
            {PARAMS.map((p) => {
              const raw = plain[p.key];
              if (raw === undefined) return null;
              if (typeof raw !== 'number') {
                return (
                  <p key={p.key} className={styles.paramNote}>
                    {p.label}: <code>{JSON.stringify(raw)}</code>
                  </p>
                );
              }
              return (
                <SliderRow
                  key={p.key}
                  label={p.label}
                  value={raw}
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  onChange={(v) => onChange(setScale(draft, lookup, name, (e) => ({ ...e, [p.key]: v })), `scales.${name}.${p.key}`)}
                />
              );
            })}
          </PropertyGroup>
        </PropertyPanel>
      ) : (
        <p className={styles.paramNote}>{name} varies by {entry.by} as a whole; edit it in the definition file.</p>
      )}
    </section>
  );
}

export function ScalesLayer({ draft, derived, lookup, highlight, onChange }: ScalesLayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('[data-highlight]')?.scrollIntoView?.({ block: 'nearest' });
  }, [highlight]);
  const scales = Object.entries(derived.merged.scales ?? {});
  if (scales.length === 0) return <p className={styles.empty}>{draft.name} has no scales.</p>;
  return (
    <div ref={ref} className={styles.ramps}>
      {scales.map(([name, entry]) => (
        <ScaleSection key={name} name={name} entry={entry} draft={draft} lookup={lookup} highlight={highlight} onChange={onChange} />
      ))}
    </div>
  );
}
```

If `isByAxis(entry)` does not narrow `entry` so that `entry.by` typechecks, read it as `(entry as { by: string }).by`.

- [ ] **Step 6: Wire it** — in the workbench's layer switch add `case 'scales': return <ScalesLayer draft={draft} derived={derived} lookup={lookup} highlight={highlight} onChange={history.update} />;`

- [ ] **Step 7: Styles** — append:

```css
.ladderCell {
  min-width: 8rem;
}

.ladderBar {
  display: block;
  height: 4px;
  margin-top: 2px;
  border-radius: 2px;
  background: var(--wzl-fg-muted);
}
```

- [ ] **Step 8: Run** both tests and `ThemeWorkbench.test.tsx` → PASS; tsc and eslint clean.

- [ ] **Step 9: Commit** the seven files; message `edit scales in the theme editor as a ladder per axis value`.

---
### Task 14: the semantics layer and its drawer

**Files:**
- Create: `apps/theme-editor/src/theme/semantics.ts`, `semantics.test.ts` (under `src/theme/`), `apps/theme-editor/src/layers/SemanticsLayer.tsx`, `SemanticDrawer.tsx`, `SemanticsLayer.test.tsx` (under `src/layers/`)
- Modify: `apps/theme-editor/src/ThemeWorkbench.tsx`, `apps/theme-editor/src/ThemeEditor.module.css`

- [ ] **Step 1: Failing tests**

`src/theme/semantics.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { deriveDraft } from './draft';
import { lookupOf, weasel } from './fixtures';
import { setPin, setSemantic } from './model';
import { defaultRule, ruleKind, semanticRows } from './semantics';
import type { ThemeDefinition } from '@weasel-js/theme';

const rowsOf = (def: ThemeDefinition) => {
  const d = deriveDraft(def, lookupOf(def), {});
  return semanticRows(def, d.merged, d.views);
};

describe('semanticRows', () => {
  it("reads weasel's references per mode, with nothing to measure", () => {
    const surface = rowsOf(weasel).find((r) => r.name === 'surface')!;
    expect(surface.summary).toBe('by mode: gray-800 / gray-50');
    expect(surface.cells.map((c) => c.step)).toEqual(['gray-800', 'gray-50']);
    expect(surface.worst).toBeNull();
    expect(surface.pinned).toBe(false);
  });

  it('measures a contrast rule against its surfaces in every mode', () => {
    const def = setSemantic(weasel, 'fg-muted', { ramp: 'gray', contrast: { min: 4.5, against: ['surface'] } });
    const row = rowsOf(def).find((r) => r.name === 'fg-muted')!;
    expect(row.cells.map((c) => c.checks.map((k) => k.against))).toEqual([['surface'], ['surface']]);
    expect(row.worst?.pass).toBe(true);
    expect(row.worst!.ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps what the rule produced beneath a pin', () => {
    const row = rowsOf(setPin(weasel, 'fg', { value: '#ffffff', type: 'color' })).find((r) => r.name === 'fg')!;
    expect(row.cells[0]).toMatchObject({ mode: 'dark', produced: '{gray-100}', pin: '#ffffff' });
    expect(row.ownPin).toBe(true);
  });
});

describe('defaultRule', () => {
  it('starts a rule of the chosen kind and keeps type, description and check', () => {
    const current = { ref: 'gray-100', type: 'color', description: 'd', check: { contrast: 3, against: ['surface'] } };
    expect(ruleKind(defaultRule('offset', current, { gray: ['50', '100'] }, ['surface']))).toBe('offset');
    expect(defaultRule('literal', current, {}, [])).toEqual({ type: 'color', description: 'd', check: current.check, value: '' });
    expect(defaultRule('step', current, { gray: ['50', '100'] }, [])).toMatchObject({ ramp: 'gray', step: '50' });
  });
});
```

`src/layers/SemanticsLayer.test.tsx`:

```tsx
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ThemeDefinition } from '@weasel-js/theme';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deriveDraft } from '../theme/draft';
import { lookupOf, weasel } from '../theme/fixtures';
import { setPin } from '../theme/model';
import { SemanticsLayer } from './SemanticsLayer';

function renderSemantics(def: ThemeDefinition) {
  const lookup = lookupOf(def);
  const onChange = vi.fn();
  render(<SemanticsLayer draft={def} derived={deriveDraft(def, lookup, {})} lookup={lookup} highlight={[]} onChange={onChange} />);
  return onChange;
}
const firstDef = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[0][0] as ThemeDefinition;

describe('<SemanticsLayer>', () => {
  afterEach(cleanup);

  it('shows the step each mode ends on', () => {
    renderSemantics(weasel);
    const row = screen.getByRole('button', { name: 'surface' }).closest('tr')!;
    expect(within(row).getByText('gray-800')).toBeInTheDocument();
    expect(within(row).getByText('gray-50')).toBeInTheDocument();
  });

  it("opens a drawer with each mode's produced value and pin, and reverts the pin", async () => {
    const onChange = renderSemantics(setPin(weasel, 'fg', { value: '#ffffff', type: 'color' }));
    await userEvent.click(screen.getByRole('button', { name: 'fg' }));
    const drawer = screen.getByRole('complementary', { name: 'fg rule' });
    const dark = within(drawer).getByRole('rowheader', { name: 'dark' }).closest('tr')!;
    expect(within(dark).getByText('{gray-100}')).toBeInTheDocument();
    expect(within(dark).getByText('#ffffff')).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Revert pin' }));
    expect(firstDef(onChange).pins).not.toHaveProperty('fg');
  });

  it('stops a rule varying by mode, keeping the branch being edited', async () => {
    const onChange = renderSemantics(weasel);
    await userEvent.click(screen.getByRole('button', { name: 'surface' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Varies by mode' }));
    expect(firstDef(onChange).semantics!.surface).toEqual({ ref: 'gray-800', type: 'color' });
  });
});
```

- [ ] **Step 2: Run both** → FAIL.

- [ ] **Step 3: Implement `src/theme/semantics.ts`**

```ts
import { isByAxis, type Selection, type ThemeDefinition, type Varying } from '@weasel-js/theme';
import { contrast, type SemanticRule } from '@weasel-js/theme/engine';
import type { ModeView } from './draft';
import { ruleSummary, stepOf } from './model';

export type RuleKind = 'step' | 'offset' | 'contrast' | 'ref' | 'literal';

export const RULE_KINDS: readonly { readonly value: RuleKind; readonly label: string }[] = [
  { value: 'step', label: 'Step' },
  { value: 'offset', label: 'Offset' },
  { value: 'contrast', label: 'Contrast' },
  { value: 'ref', label: 'Reference' },
  { value: 'literal', label: 'Literal' },
];

export function ruleKind(rule: SemanticRule): RuleKind {
  if ('ref' in rule) return 'ref';
  if ('contrast' in rule) return 'contrast';
  if ('offset' in rule) return 'offset';
  if ('step' in rule) return 'step';
  return 'literal';
}

/** A new rule of `kind`, carrying over the type, description and check of the one it replaces. */
export function defaultRule(kind: RuleKind, current: SemanticRule, ramps: Readonly<Record<string, readonly string[]>>, semantics: readonly string[]): SemanticRule {
  const common = {
    ...(current.type !== undefined ? { type: current.type } : {}),
    ...(current.description !== undefined ? { description: current.description } : {}),
    ...(current.check !== undefined ? { check: current.check } : {}),
  };
  const [ramp, steps] = Object.entries(ramps)[0] ?? ['gray', []];
  const surface = semantics[0] ?? 'surface';
  switch (kind) {
    case 'step':
      return { ...common, ramp, step: steps[0] ?? '' };
    case 'offset':
      return { ...common, from: surface, offset: 1, dir: 'away' };
    case 'contrast':
      return { ...common, ramp, contrast: { min: 4.5, against: [surface] } };
    case 'ref':
      return { ...common, ref: `${ramp}-${steps[0] ?? ''}` };
    case 'literal':
      return { ...common, value: '' };
  }
}

export function pickRule(rule: Varying<SemanticRule>, selection: Selection): SemanticRule | undefined {
  let r: unknown = rule;
  while (isByAxis(r)) {
    const value = selection[r.by];
    if (value === undefined || !Object.hasOwn(r, value)) return undefined;
    r = (r as Record<string, unknown>)[value];
  }
  return r as SemanticRule;
}

export interface ContrastCheck {
  readonly against: string;
  readonly min: number;
  /** null when either side is not a solid hex color. */
  readonly ratio: number | null;
}

export interface SemanticCell {
  readonly mode: string | undefined;
  readonly hex: string;
  readonly step: string | undefined;
  /** What the rule alone produced. */
  readonly produced: string;
  readonly pin: string | undefined;
  readonly checks: readonly ContrastCheck[];
}

export interface SemanticRowView {
  readonly name: string;
  readonly summary: string;
  readonly pinned: boolean;
  /** A pin this definition holds, which it can revert; an inherited pin it cannot. */
  readonly ownPin: boolean;
  readonly cells: readonly SemanticCell[];
  /** The lowest measured ratio, and whether every check cleared its minimum. */
  readonly worst: { readonly ratio: number; readonly pass: boolean } | null;
}

const HEX = /^#[0-9a-f]{6}$/i;
const text = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

export function semanticRows(draft: ThemeDefinition, merged: ThemeDefinition, views: readonly ModeView[]): SemanticRowView[] {
  return Object.entries(merged.semantics ?? {}).map(([name, rule]) => {
    const cells = views
      .filter((v) => Object.hasOwn(v.result.tokens, name))
      .map((v): SemanticCell => {
        const final = v.resolved as Readonly<Record<string, string>>;
        const token = v.result.tokens[name];
        const p = v.result.provenance[name];
        const hex = final[`--wzl-${name}`] ?? text(token.value);
        const picked = pickRule(rule, v.selection);
        const wanted = [
          ...(picked && 'contrast' in picked ? picked.contrast.against.map((against) => ({ against, min: picked.contrast.min })) : []),
          ...(picked?.check ? picked.check.against.map((against) => ({ against, min: picked.check!.contrast })) : []),
        ];
        const checks = wanted.map((w) => {
          const other = final[`--wzl-${w.against}`];
          return { ...w, ratio: HEX.test(hex) && other !== undefined && HEX.test(other) ? contrast(hex, other) : null };
        });
        return {
          mode: v.mode,
          hex,
          step: stepOf(name, v.result),
          produced: text(p.pinned ? p.generated?.value : token.value),
          pin: p.pinned ? text(token.value) : undefined,
          checks,
        };
      });
    const measured = cells.flatMap((c) => c.checks).filter((c): c is ContrastCheck & { ratio: number } => c.ratio !== null);
    const worst = measured.length === 0 ? null : { ratio: Math.min(...measured.map((c) => c.ratio)), pass: measured.every((c) => c.ratio >= c.min) };
    return { name, summary: ruleSummary(rule), pinned: cells.some((c) => c.pin !== undefined), ownPin: Object.hasOwn(draft.pins ?? {}, name), cells, worst };
  });
}
```

- [ ] **Step 4: Implement `src/layers/SemanticDrawer.tsx`**

```tsx
import { isByAxis, type Varying } from '@weasel-js/theme';
import type { SemanticRule } from '@weasel-js/theme/engine';
import { Button, CheckboxRow, NumberRow, PropertyGroup, PropertyPanel, SelectRow, TextRow, ToggleRow } from '@weasel-js/ui';
import { useState } from 'react';
import styles from '../ThemeEditor.module.css';
import { RULE_KINDS, defaultRule, ruleKind, type SemanticRowView } from '../theme/semantics';

type Ramps = Readonly<Record<string, readonly string[]>>;

export interface SemanticDrawerProps {
  readonly name: string;
  readonly rule: Varying<SemanticRule>;
  readonly row: SemanticRowView;
  readonly modes: readonly (string | undefined)[];
  readonly ramps: Ramps;
  readonly semantics: readonly string[];
  readonly onRule: (rule: Varying<SemanticRule>, key: string) => void;
  readonly onRevert: () => void;
  readonly onClose: () => void;
}

const DIRECTIONS = [
  { value: 'lighter', label: 'Lighter' },
  { value: 'darker', label: 'Darker' },
  { value: 'away', label: 'Away' },
] as const;

function RuleFields({ rule, ramps, semantics, onChange }: { rule: SemanticRule; ramps: Ramps; semantics: readonly string[]; onChange: (next: SemanticRule, field: string) => void }) {
  const rampOptions = Object.keys(ramps).map((r) => ({ value: r, label: r }));
  if ('ref' in rule) {
    return (
      <>
        <TextRow label="Reference" value={rule.ref} onChange={(ref) => onChange({ ...rule, ref }, 'ref')} />
        <NumberRow label="Alpha" value={rule.alpha ?? null} min={0} max={1} step={0.01} onChange={(alpha) => onChange({ ...rule, alpha }, 'alpha')} />
      </>
    );
  }
  if ('contrast' in rule) {
    return (
      <>
        <SelectRow label="Ramp" value={rule.ramp} options={rampOptions} onChange={(ramp) => onChange({ ...rule, ramp }, 'ramp')} />
        <NumberRow label="Minimum" value={rule.contrast.min} min={1} max={21} step={0.1} onChange={(min) => onChange({ ...rule, contrast: { ...rule.contrast, min } }, 'contrast.min')} />
        <TextRow
          label="Against"
          value={rule.contrast.against.join(', ')}
          onChange={(v) => onChange({ ...rule, contrast: { ...rule.contrast, against: v.split(',').map((s) => s.trim()).filter(Boolean) } }, 'contrast.against')}
        />
      </>
    );
  }
  if ('offset' in rule) {
    return (
      <>
        <SelectRow label="From" value={rule.from} options={semantics.map((s) => ({ value: s, label: s }))} onChange={(from) => onChange({ ...rule, from }, 'from')} />
        <NumberRow label="Offset" value={rule.offset} min={0} step={1} onChange={(offset) => onChange({ ...rule, offset }, 'offset')} />
        <ToggleRow label="Direction" value={rule.dir} options={DIRECTIONS} onChange={(dir) => onChange({ ...rule, dir }, 'dir')} />
      </>
    );
  }
  if ('step' in rule) {
    return (
      <>
        <SelectRow label="Ramp" value={rule.ramp} options={rampOptions} onChange={(ramp) => onChange({ ...rule, ramp, step: ramps[ramp]?.[0] ?? '' }, 'ramp')} />
        {isByAxis(rule.step) ? (
          <p className={styles.paramNote}>The step varies by {rule.step.by}; edit it in the definition file.</p>
        ) : (
          <SelectRow label="Step" value={rule.step} options={(ramps[rule.ramp] ?? []).map((s) => ({ value: s, label: s }))} onChange={(step) => onChange({ ...rule, step }, 'step')} />
        )}
      </>
    );
  }
  return <TextRow label="Value" value={String(rule.value)} onChange={(value) => onChange({ ...rule, value }, 'value')} />;
}

export function SemanticDrawer({ name, rule, row, modes, ramps, semantics, onRule, onRevert, onClose }: SemanticDrawerProps) {
  const modeValues = modes.filter((m): m is string => m !== undefined);
  const varies = isByAxis(rule) && rule.by === 'mode';
  const [branch, setBranch] = useState(modeValues[0] ?? '');
  const current = (varies ? (rule as unknown as Record<string, unknown>)[branch] : rule) as SemanticRule | undefined;

  const write = (next: SemanticRule, field: string) =>
    onRule(varies ? ({ ...(rule as object), [branch]: next } as Varying<SemanticRule>) : next, `semantics.${name}.${varies ? `${branch}.` : ''}${field}`);
  const setVaries = (on: boolean) => {
    if (!current) return;
    onRule(on ? ({ by: 'mode', ...Object.fromEntries(modeValues.map((m) => [m, current])) } as Varying<SemanticRule>) : current, `semantics.${name}.by`);
  };

  return (
    <aside className={styles.drawer} aria-label={`${name} rule`}>
      <header className={styles.rampHeader}>
        <h3 className={styles.rampTitle}>{name}</h3>
        <span className={styles.rampActions}>
          {row.ownPin && <Button size="sm" onClick={onRevert}>Revert pin</Button>}
          <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
        </span>
      </header>
      {current ? (
        <PropertyPanel title="Rule">
          <PropertyGroup title="Kind">
            {modeValues.length > 1 && <CheckboxRow label="Varies by mode" value={varies} onChange={setVaries} />}
            {varies && <ToggleRow label="Editing" value={branch} options={modeValues.map((m) => ({ value: m, label: m }))} onChange={setBranch} />}
            <SelectRow label="Rule" value={ruleKind(current)} options={RULE_KINDS} onChange={(kind) => write(defaultRule(kind, current, ramps, semantics), 'kind')} />
          </PropertyGroup>
          <PropertyGroup title="Fields">
            <RuleFields rule={current} ramps={ramps} semantics={semantics} onChange={write} />
          </PropertyGroup>
        </PropertyPanel>
      ) : (
        <p className={styles.paramNote}>This rule has no {branch} branch.</p>
      )}
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Mode</th>
              <th scope="col">Rule produced</th>
              <th scope="col">Pin</th>
              <th scope="col">Contrast</th>
            </tr>
          </thead>
          <tbody>
            {row.cells.map((c) => (
              <tr key={c.mode ?? 'value'}>
                <th scope="row">{c.mode ?? 'value'}</th>
                <td><code>{c.produced}</code></td>
                <td>{c.pin !== undefined ? <code>{c.pin}</code> : '—'}</td>
                <td className={styles.num}>
                  {c.checks.length === 0
                    ? '—'
                    : c.checks.map((k) => `${k.against} ${k.ratio === null ? 'n/a' : k.ratio.toFixed(2)} of ${k.min}`).join('; ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </aside>
  );
}
```

- [ ] **Step 5: Implement `src/layers/SemanticsLayer.tsx`**

```tsx
import type { ThemeDefinition } from '@weasel-js/theme';
import { declaredSteps, type Lookup } from '@weasel-js/theme/engine';
import { Button } from '@weasel-js/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from '../ThemeEditor.module.css';
import type { DerivedDraft } from '../theme/draft';
import { removePin, setSemantic } from '../theme/model';
import { semanticRows } from '../theme/semantics';
import { SemanticDrawer } from './SemanticDrawer';

export interface SemanticsLayerProps {
  readonly draft: ThemeDefinition;
  readonly derived: DerivedDraft;
  readonly lookup: Lookup;
  readonly highlight: readonly string[];
  readonly onChange: (next: ThemeDefinition, key: string, label?: string) => void;
}

export function SemanticsLayer({ draft, derived, highlight, onChange }: SemanticsLayerProps) {
  const rows = useMemo(() => semanticRows(draft, derived.merged, derived.views), [draft, derived]);
  const ramps = useMemo(
    () => Object.fromEntries(Object.entries(derived.merged.ramps ?? {}).map(([name, entry]) => [name, declaredSteps(entry)])),
    [derived],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('[data-highlight]')?.scrollIntoView?.({ block: 'nearest' });
  }, [highlight]);

  if (rows.length === 0) return <p className={styles.empty}>{draft.name} has no semantics.</p>;

  const modes = derived.views.map((v) => v.mode);
  const revert = (name: string) => onChange(removePin(draft, name), `pin:${name}`, `revert ${name}`);
  const open = rows.find((r) => r.name === selected);

  return (
    <div ref={ref} className={styles.semantics}>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Swatch</th>
              <th scope="col">Token</th>
              <th scope="col">Rule</th>
              {modes.map((m) => (
                <th key={m ?? 'value'} scope="col">{m ?? 'Step'}</th>
              ))}
              <th scope="col">Contrast</th>
              <th scope="col">Pin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const lit = highlight.includes(r.name);
              const classes = [lit ? styles.highlight : '', selected === r.name ? styles.selectedRow : ''].filter(Boolean).join(' ');
              return (
                <tr key={r.name} className={classes || undefined} data-highlight={lit || undefined}>
                  <td>
                    <span className={styles.swatchPair}>
                      {r.cells.map((c) => (
                        <span key={c.mode ?? 'value'} className={styles.swatchSmall} style={{ background: c.hex }} title={`${c.mode ?? ''} ${c.hex}`.trim()} />
                      ))}
                    </span>
                  </td>
                  <td>
                    <button type="button" className={styles.linkButton} aria-expanded={selected === r.name} onClick={() => setSelected(selected === r.name ? null : r.name)}>
                      {r.name}
                    </button>
                  </td>
                  <td><code>{r.summary}</code></td>
                  {modes.map((m) => {
                    const cell = r.cells.find((c) => c.mode === m);
                    return (
                      <td key={m ?? 'value'}><code>{cell?.step ?? cell?.hex ?? '—'}</code></td>
                    );
                  })}
                  <td className={styles.num}>{r.worst ? `${r.worst.ratio.toFixed(2)} ${r.worst.pass ? 'pass' : 'fail'}` : '—'}</td>
                  <td>
                    {r.ownPin ? (
                      <Button size="sm" variant="ghost" ariaLabel={`Revert ${r.name}`} onClick={() => revert(r.name)}>Revert</Button>
                    ) : r.pinned ? (
                      <span className={styles.metric}>inherited</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open && (
        <SemanticDrawer
          key={open.name}
          name={open.name}
          rule={derived.merged.semantics![open.name]}
          row={open}
          modes={modes}
          ramps={ramps}
          semantics={rows.map((r) => r.name)}
          onRule={(rule, key) => onChange(setSemantic(draft, open.name, rule), key)}
          onRevert={() => revert(open.name)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Wire it** — add `case 'semantics': return <SemanticsLayer draft={draft} derived={derived} lookup={lookup} highlight={highlight} onChange={history.update} />;` to the workbench switch.

- [ ] **Step 7: Styles** — append:

```css
.semantics {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.selectedRow {
  background: var(--wzl-surface-raised);
}

.swatchPair {
  display: inline-flex;
  gap: 2px;
}

.swatchSmall {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid var(--wzl-border);
}

.linkButton {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.drawer {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--wzl-border-strong);
  border-radius: var(--wzl-radius-md);
}
```

- [ ] **Step 8: Run** both tests and `ThemeWorkbench.test.tsx` → PASS; tsc and eslint clean. If `CheckboxRow`'s checkbox is not named by its label, find its accessible name with `screen.debug()` and query by that, noting it.

- [ ] **Step 9: Commit** the seven files; message `edit semantics in the theme editor with a rule drawer per token`.

---
### Task 15: click to inspect

**Files:**
- Create: `apps/theme-editor/src/theme/inspect.ts`, `inspect.test.ts` (under `src/theme/`)
- Modify: `apps/theme-editor/src/ThemeWorkbench.tsx`, `apps/theme-editor/src/ThemeEditor.module.css`

jsdom's CSS parser drops some declarations a browser keeps (a `var()` inside a shorthand is the usual one), so the unit test uses longhands and the controller checks the real preview in the browser. A test that fails only because jsdom dropped a declaration is measuring jsdom.

- [ ] **Step 1: Failing test** — `src/theme/inspect.test.ts`

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { documentSheets, tokensReadAt } from './inspect';

describe('tokensReadAt', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('collects the tokens rules matching the element and its ancestors read, up to the pane', () => {
    document.head.innerHTML = `<style>
      .pane { background-color: var(--wzl-surface); }
      .btn { color: var(--wzl-fg); background-color: var(--wzl-accent); }
      .panel { --wzl-local: var(--wzl-gray-100); padding-top: var(--wzl-space-md); }
      .elsewhere { color: var(--wzl-danger); }
    </style>`;
    document.body.innerHTML = '<div class="pane"><div class="panel"><button class="btn"><span id="t">x</span></button></div></div>';
    const target = document.getElementById('t')!;
    const pane = document.querySelector('.pane')!;
    expect(tokensReadAt(target, pane, documentSheets())).toEqual(['fg', 'accent', 'space-md']);
  });
});
```

`surface` is read by the pane itself, which is excluded; `gray-100` appears only in a custom property's declaration, which defines a token rather than reads one.

- [ ] **Step 2: Run** `npx vitest run --project=draw apps/theme-editor/src/theme/inspect.test.ts` → FAIL.

- [ ] **Step 3: Implement** — `src/theme/inspect.ts`

```ts
const VAR = /var\(\s*--wzl-([\w-]+)/g;
const CUSTOM_DECLARATION = /--[\w-]+\s*:[^;]*;?/g;

function matches(el: Element, selector: string): boolean {
  try {
    return el.matches(selector);
  } catch {
    // A nested rule's `&` selector, or one the engine can't parse outside its context.
    return false;
  }
}

/**
 * Every `--wzl-*` token read by a stylesheet rule matching `target` or an element between it and `root` (exclusive), in
 * the order the rules appear. Custom property declarations are skipped: those define tokens, like the theme's own rules.
 */
export function tokensReadAt(target: Element, root: Element, sheets: Iterable<CSSStyleSheet>): string[] {
  const chain: Element[] = [];
  for (let el: Element | null = target; el && el !== root; el = el.parentElement) chain.push(el);
  const names = new Set<string>();
  const visit = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule && chain.some((el) => matches(el, rule.selectorText))) {
        for (const m of rule.style.cssText.replace(CUSTOM_DECLARATION, '').matchAll(VAR)) names.add(m[1]);
      }
      const nested = (rule as Partial<CSSGroupingRule>).cssRules;
      if (nested) visit(nested);
    }
  };
  for (const sheet of sheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      // A cross-origin sheet refuses to be read.
      continue;
    }
    visit(rules);
  }
  return [...names];
}

export function documentSheets(doc: Document = document): CSSStyleSheet[] {
  return [...Array.from(doc.styleSheets), ...(doc.adoptedStyleSheets ?? [])];
}
```

- [ ] **Step 4: Run** → PASS.

- [ ] **Step 5: Wire it into the workbench.**
  - Replace `const [highlight] = useState<readonly string[]>([]);` with `const [highlight, setHighlight] = useState<readonly string[]>([]);`, and add `const [inspecting, setInspecting] = useState(false);` and `const [reads, setReads] = useState<readonly string[]>([]);`.
  - Add, after `counts`:

```tsx
const layerOf = (token: string): LayerId => {
  const p = derived.primary.result.provenance[token];
  return p?.pinned || p?.layer === 'pins' ? 'pins' : (p?.layer ?? 'pins');
};
const jump = (tokens: readonly string[]) => {
  if (tokens.length === 0) return;
  setLayer(layerOf(tokens[0]));
  setHighlight(tokens);
};
const inspect = (target: Element, pane: Element) => {
  const known = tokensReadAt(target, pane, documentSheets()).filter((t) => Object.hasOwn(derived.primary.result.tokens, t));
  setReads(known);
  jump(known);
};
```

  A pinned token jumps to Pins, because the pin is what decides its value.
  - In the preview `aside`, above `<ThemePreview>`:

```tsx
<div className={styles.previewBar}>
  <Button size="sm" pressed={inspecting} onClick={() => setInspecting((on) => !on)}>
    Inspect
  </Button>
  {inspecting && reads.length === 0 && <span className={styles.metric}>Click a component to see the tokens it reads.</span>}
  {reads.length > 0 && (
    <ul className={styles.reads} aria-label="Tokens read">
      {reads.map((t) => (
        <li key={t}>
          <button type="button" className={styles.linkButton} onClick={() => jump([t])}>
            {t}
          </button>
        </li>
      ))}
    </ul>
  )}
</div>
```

  and pass `inspecting={inspecting} onInspect={inspect}` to `<ThemePreview>`.
  - Pass `highlight` to every layer editor (Ramps, Scales, Semantics already take it; TokenList does).

- [ ] **Step 6: Styles** — append:

```css
.previewBar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.reads {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 12px;
}
```

- [ ] **Step 7: Run** `inspect.test.ts` and `ThemeWorkbench.test.tsx` → PASS; tsc and eslint clean.

- [ ] **Step 8: Commit** the four files; message `jump from a clicked preview component to the tokens it reads`.

---

### Task 16: Export

**Files:**
- Create: `apps/theme-editor/src/theme/exportFiles.ts`, `exportFiles.test.ts` (under `src/theme/`)
- Modify: `apps/theme-editor/src/ThemeWorkbench.tsx`

- [ ] **Step 1: Failing test** — `src/theme/exportFiles.test.ts`

```ts
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { exportFile } from './exportFiles';
import { lookupOf, weasel } from './fixtures';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const lookup = lookupOf();

describe('exportFile', () => {
  it("emits weasel's CSS exactly as the build does", () => {
    const file = exportFile('css', weasel, lookup);
    expect(file.filename).toBe('weasel.tokens.css');
    expect(file.text).toBe(readFileSync(resolve(repo, 'packages/theme/src/generated/tokens.css'), 'utf8'));
  });

  it('writes the definition byte for byte as the store saves it', () => {
    expect(exportFile('definition', weasel, lookup).text).toBe(readFileSync(resolve(repo, 'packages/theme/themes/weasel.json'), 'utf8'));
  });

  it('writes DTCG that names the theme', () => {
    const file = exportFile('dtcg', weasel, lookup);
    expect(file.filename).toBe('weasel.tokens.json');
    expect(JSON.parse(file.text).name).toBe('weasel');
  });
});
```

The definition case compares `THEME_SOURCES.weasel` against the file; if `THEME_SOURCES` was generated before some edit to `weasel.json`, the determinism test is already failing and this one tells you nothing new.

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement** — `src/theme/exportFiles.ts`

```ts
import type { ThemeDefinition } from '@weasel-js/theme';
import { axisDependencies, bake, emitCss, toDTCG, type Lookup } from '@weasel-js/theme/engine';
import { runtimeTheme } from './model';
import { serializeDefinition } from './store';

export type ExportKind = 'css' | 'definition' | 'dtcg';

export interface ExportFile {
  readonly filename: string;
  readonly type: string;
  readonly text: string;
}

export const EXPORTS: readonly { readonly kind: ExportKind; readonly label: string }[] = [
  { kind: 'css', label: 'Emitted CSS' },
  { kind: 'definition', label: 'Definition' },
  { kind: 'dtcg', label: 'DTCG' },
];

/** The theme and every theme it extends, root first. */
function chainOf(def: ThemeDefinition, lookup: Lookup): ThemeDefinition[] {
  const parent = def.extends ? lookup(def.extends) : undefined;
  return [...(parent ? chainOf(parent, lookup) : []), def];
}

export function exportFile(kind: ExportKind, def: ThemeDefinition, lookup: Lookup): ExportFile {
  if (kind === 'definition') return { filename: `${def.name}.json`, type: 'application/json', text: serializeDefinition(def) };
  if (kind === 'dtcg') {
    return { filename: `${def.name}.tokens.json`, type: 'application/json', text: `${JSON.stringify(toDTCG(runtimeTheme(def, lookup)), null, 2)}\n` };
  }
  const themes = chainOf(def, lookup).map((d, i) => ({ baked: bake(d, lookup), deps: axisDependencies(d, lookup), isDefault: i === 0 }));
  return { filename: `${def.name}.tokens.css`, type: 'text/css', text: emitCss(themes) };
}

export function download(file: ExportFile): void {
  const url = URL.createObjectURL(new Blob([file.text], { type: file.type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = file.filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run** → PASS. If the CSS differs, diff the two texts before touching anything: `generateTokens` emits the same function over the same inputs, so a difference means the chain or `isDefault` is wrong here.

- [ ] **Step 5: Wire it.** In `ThemeWorkbench.tsx` add `const [exporting, setExporting] = useState(false);`, append to `contributions` (and add `ExportIcon` to the `@weasel-js/ui` import):

```tsx
{ id: 'export', region: 'header', item: { icon: ExportIcon, label: 'Export', showLabel: true, onActivate: () => setExporting(true) } },
```

and render, inside `LabShell` after the workbench grid:

```tsx
<Dialog
  isOpen={exporting}
  onOpenChange={setExporting}
  title={`Export ${draft.name}`}
  footer={<Button onClick={() => setExporting(false)}>Done</Button>}
>
  <p>The draft as it stands, saved or not.</p>
  <div className={styles.statusActions}>
    {EXPORTS.map(({ kind, label }) => (
      <Button key={kind} size="sm" onClick={() => download(exportFile(kind, draft, lookup))}>
        {label}
      </Button>
    ))}
  </div>
</Dialog>
```

Add to `ThemeWorkbench.test.tsx`:

```tsx
it('offers the three export formats', async () => {
  renderBench();
  await userEvent.click(screen.getByRole('button', { name: 'Export' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getAllByRole('button').map((b) => b.textContent)).toEqual(expect.arrayContaining(['Emitted CSS', 'Definition', 'DTCG']));
});
```

- [ ] **Step 6: Run** `exportFiles.test.ts` and `ThemeWorkbench.test.tsx` → PASS; tsc and eslint clean.

- [ ] **Step 7: Commit** the three files; message `export a theme draft as CSS, its definition, or DTCG`.

---
### Task 17: New theme

Needs Tasks 6 and 7: the starter's accent uses `lightBias`, and its own gray and accent show only because a theme's own ramps shadow weasel's pins.

**Files:**
- Create: `apps/theme-editor/src/theme/starter.ts`, `starter.test.ts` (under `src/theme/`)
- Modify: `apps/theme-editor/src/theme/draftStorage.ts`, `apps/theme-editor/src/ThemeEditor.tsx`, `apps/theme-editor/src/ThemeEditor.test.tsx`, `apps/theme-editor/src/ThemeWorkbench.tsx`

- [ ] **Step 1: Failing tests**

`src/theme/starter.test.ts`:

```ts
import { derive, toLch } from '@weasel-js/theme/engine';
import { describe, expect, it } from 'vitest';
import { lookupOf } from './fixtures';
import { countTokens } from './model';
import { starterDefinition, themeNameProblem } from './starter';

describe('starterDefinition', () => {
  const harbor = starterDefinition('harbor');
  const result = derive(harbor, { mode: 'dark' }, lookupOf(harbor));

  it("extends weasel and generates its own ramps over weasel's pins", () => {
    expect(harbor.extends).toBe('weasel');
    expect(result.issues).toEqual([]);
    expect(result.provenance['gray-800']).toMatchObject({ layer: 'ramps', pinned: false });
    expect(countTokens(harbor, result).overridden).toBe(0);
  });

  it('keeps chroma at both ends of its accent', () => {
    for (const step of ['soft', 'strong']) expect(toLch(String(result.tokens[`accent-${step}`].value)).C).toBeGreaterThan(0.02);
  });
});

describe('themeNameProblem', () => {
  it('accepts a new lowercase name and says what is wrong with anything else', () => {
    expect(themeNameProblem('harbor', ['weasel'])).toBeNull();
    expect(themeNameProblem('weasel', ['weasel'])).toBe('weasel already exists.');
    expect(themeNameProblem('Harbor', ['weasel'])).toMatch(/lowercase/);
  });
});
```

Append to `ThemeEditor.test.tsx`:

```tsx
it('starts a new theme as an unsaved draft extending weasel', async () => {
  const failing: ThemeApi = { list: () => Promise.reject(new Error('404')), get: vi.fn(), put: vi.fn() };
  render(<ThemeEditor api={failing} />);
  await userEvent.click(await screen.findByRole('button', { name: 'New theme' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'harbor');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create' }));
  expect(await screen.findByText('0 of 13 overridden')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save, with unsaved changes' })).toBeEnabled();
});
```

(13 = 10 gray steps + 3 accent steps. Import `within` alongside the other testing-library imports.)

- [ ] **Step 2: Run both** → FAIL.

- [ ] **Step 3: Implement** — `src/theme/starter.ts`

```ts
import type { ThemeDefinition } from '@weasel-js/theme';

const NAME = /^[a-z][a-z0-9-]*$/;

export function themeNameProblem(name: string, existing: readonly string[]): string | null {
  if (!NAME.test(name)) return 'Use lowercase letters, digits and hyphens, starting with a letter.';
  if (existing.includes(name)) return `${name} already exists.`;
  return null;
}

/** A new theme: three seeds, and a gray and an accent generated from them over weasel. */
export function starterDefinition(name: string): ThemeDefinition {
  return {
    name,
    extends: 'weasel',
    seeds: { brand: '#0b6e8a', neutralHue: 220, neutralChroma: 0.012 },
    ramps: {
      gray: {
        kind: 'lightness',
        steps: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
        lightness: [0.973, 0.163],
        curve: 0.41,
        hue: '{seeds.neutralHue}',
        chroma: { peak: '{seeds.neutralChroma}', darkBias: 0.84 },
      },
      accent: {
        kind: 'lightness',
        steps: ['soft', 'base', 'strong'],
        lightness: [0.252, 0.471],
        anchor: { base: '{seeds.brand}' },
        chroma: { peak: 0, lightBias: 1, darkBias: 1 },
      },
    },
  };
}
```

The gray is weasel's fitted walk with its hue and chroma taken from seeds.

- [ ] **Step 4: Drafts of themes not on disk.** Add to `draftStorage.ts`:

```ts
const DRAFT_PREFIX = 'weasel.theme-editor.draft.';

/** Every theme with a draft in storage, so a new theme not yet saved survives a reload. */
export function draftNames(): string[] {
  try {
    return Object.keys(localStorage)
      .filter((k) => k.startsWith(DRAFT_PREFIX))
      .map((k) => k.slice(DRAFT_PREFIX.length));
  } catch {
    return [];
  }
}
```

and define `draftKey` as `(name: string) => \`${DRAFT_PREFIX}${name}\``.

- [ ] **Step 5: ThemeEditor.** A theme not yet on disk is a `StoredTheme` with `hash: ''`.
  - When the list arrives, append a `StoredTheme` for each `draftNames()` entry the list lacks, using `loadDraft(name)?.definition`, skipping any that does not parse.
  - `start` becomes `draft ?? { definition: current.definition, baseHash: current.hash === '' ? null : current.hash }`.
  - Add, and pass to the workbench as `onNew`:

```tsx
const create = (newName: string): string | null => {
  const problem = themeNameProblem(newName, loaded.themes.map((t) => t.name));
  if (problem) return problem;
  const definition = starterDefinition(newName);
  setLoaded((l) => l && { ...l, themes: [...l.themes, { name: newName, hash: '', emits: true, definition }] });
  persistLastTheme(newName);
  setName(newName);
  return null;
};
```

- [ ] **Step 6: ThemeWorkbench.**
  - Props gain `readonly onNew: (name: string) => string | null;` (update `renderBench` in `ThemeWorkbench.test.tsx` with `onNew: vi.fn(() => null)`).
  - `dirty` becomes `draft !== saved || baseHash === null`: a theme with no file is unsaved even untouched.
  - State: `const [creating, setCreating] = useState(false); const [newName, setNewName] = useState(''); const [newProblem, setNewProblem] = useState<string | null>(null);`
  - Contribution (add `AddIcon` to the ui import): `{ id: 'new', region: 'header', item: { icon: AddIcon, label: 'New theme', showLabel: true, onActivate: () => setCreating(true) } }`.
  - Dialog (add `Input` to the ui import):

```tsx
<Dialog
  isOpen={creating}
  onOpenChange={setCreating}
  title="New theme"
  footer={
    <>
      <Button onClick={() => setCreating(false)}>Cancel</Button>
      <Button
        variant="primary"
        onClick={() => {
          const problem = onNew(newName.trim());
          setNewProblem(problem);
          if (!problem) setCreating(false);
        }}
      >
        Create
      </Button>
    </>
  }
>
  <p>It extends weasel, starts from three seeds, and stays a draft until you save it into packages/theme/themes/.</p>
  <Input label="Name" value={newName} onChange={setNewName} errorMessage={newProblem ?? undefined} isInvalid={newProblem !== null} />
</Dialog>
```

- [ ] **Step 7: Run** `starter.test.ts`, `ThemeEditor.test.tsx`, `ThemeWorkbench.test.tsx`, `draftStorage.test.ts` → PASS; tsc and eslint clean.

- [ ] **Step 8: Commit** the six files; message `start a new theme from seeds, extending weasel`.

---

### Task 18: Seeds, Components and Pins through `TokenPanel` — blocked

**Blocked until `forge-sidebar-clicks` merges to `main`** (Mike, 2026-09-14). Until then those three layers are the read-only `TokenList` from Task 9. Do not merge that branch here.

When it has merged: merge `main` into `theme-editor`; replace `TokenList` for the three layers with `TokenPanel`, feeding it `TokenEntry` rows built from `layerRows` (`name`, `type`, `group` = the name up to its first hyphen, as `emitManifest` groups, `value` resolved at the primary view, `overridden` = a pin that replaced a generator). Its `onChange(name, value)` becomes `setPin(draft, name, { value, type })`, and `null` becomes `removePin`. A seed edits `draft.seeds`. Write the failing tests first, as the tasks above do.

---

### Task 19: verify and hand off (controller)

- [ ] **Gates**, one at a time, after checking `ps` for another session's suite:

```sh
npx tsc --noEmit
npx vitest run --project=draw apps/theme-editor
npx vitest run --project=weasel-ui packages/theme
npm run lint
npm run check:test-projects
```

- [ ] **Browser**, headless, against the 5187 server after a hard reload of `http://localhost:5187/weasel/theme-editor/#/theme`: both lab modes by emulating `prefers-color-scheme` (`LabShell` here has no mode buttons; clicking "Light"/"Dark" hits the page's own controls); the rail's buttons are not crushed by `.lk-root`'s `:where()` height; both preview panes show dark and light; a ramp slider moves the preview; Compare shows pinned beside generated; Inspect on the primary button lands on its tokens; a New theme saved as `harbor` writes `packages/theme/themes/harbor.json` and regenerates `src/generated/`. Then delete `harbor.json`, run `npm run gen:tokens -w @weasel-js/theme`, and confirm `git status` shows no generated change.
- [ ] **Docs:** rewrite `docs/HANDOFF.md`'s top section for what is left (Task 18, anything the browser pass found); update `docs/TODO.md` for the theme editor; the spec's status line. The plan is deleted when the branch merges.
- [ ] **Not here:** the full `npm test` suite is the pre-push gate, and pushing is Mike's call.

---

### Task 20: fixes from the review of Tasks 1–5 (run right after Task 7)

A read-only review of commits `55b5524e..376a876f` found these; each was verified against the code.

**Files:**
- Modify: `packages/theme/src/engine/derive.ts`, `derive.test.ts`, `packages/theme/src/engine.ts`, `apps/theme-editor/server/themeStore.ts`, `themeStore.test.ts`, `apps/theme-editor/src/theme/model.ts`, `apps/theme-editor/src/theme/draftStorage.ts`
- Create: `.changeset/theme-token-name-characters.md`

- [ ] **1. Token and step names are limited to `[A-Za-z0-9_-]`.** Today `derive` drops a name containing a dot (`withoutDottedNames`, and the `steps` check in `settleEntry`) and nothing else, and `emitThemes` writes `'--wzl-${n}'` unescaped: a pin named `a'b` saves with no issue, regenerates, and leaves `src/generated/themes.ts` unparseable. Generalize both dot checks to `/^[A-Za-z0-9_-]+$/`, keeping the same behavior (an `invalid` issue, the entry dropped), with the message `"<name>" cannot name a token: use letters, digits, "-" and "_"`. Failing tests first, in `derive.test.ts`: a pin named `a'b` yields an `invalid` issue at `pins.a'b` and no token; a ramp step named `x y` yields an `invalid` issue at `ramps.<name>.steps`. Update any existing dot-name test that asserts the old message text. Changeset, `patch`:

  ```md
  Token and step names are limited to letters, digits, `-` and `_`. Any other name is reported as invalid and dropped, as a name containing a dot already was; a quote in a name used to reach the generated `themes.ts` unescaped.
  ```

- [ ] **2. The store refuses, before writing, a save that would break the build.** Today the file is written first, and `generateTokens` throwing is caught into `problems`, so `PUT /__theme/harbor` with `{ name: 'harbor' }` (a second root) or `extends: 'interstellar'` (a parent that does not emit) saves and makes `gen:tokens` throw on every later run. Also refuse when `derive` throws at any selection (a cycle, a dangling reference, an unknown `extends`), which breaks the build the same way. Issues still save. In `write`, after the name checks and the hash check and before `writeFileSync`, build the would-be set (every definition, this one substituted or added) and return `{ status: 'invalid', message }` when:
  - it emits, and the emitting set does not have exactly one theme that extends nothing, or an emitting theme's `extends` names a theme that does not emit;
  - it does not emit, and its `extends` names no known theme;
  - `derive(definition, selection, lookup)` throws for any selection of `mergeChain(definition, lookup).axes`.

  The derive loop already in `write` moves above the write and collects issues there. Failing tests first in `themeStore.test.ts`: `harbor` with no `extends` → `invalid`, `themes/harbor.json` absent; `harbor` extending `interstellar` → `invalid`; weasel with a semantic `{ ref: 'nope' }` added → `invalid`, `weasel.json` byte-identical to before. The existing "saves a definition with issues" case must still pass.

- [ ] **3. `runtimeTheme` bakes each theme once.** `bake` already bakes the whole chain internally (`bakeChain`, root first) and the recursion bakes each parent again. Export `bakeChain` from `packages/theme/src/engine/bake.ts` and `engine.ts` (docstring: "`definition` and every theme it extends, baked, root first"), and build the `Theme` chain in `runtimeTheme` from its result, naming only the leaf `name`. `model.test.ts`'s `runtimeTheme` case must pass unchanged. Mention `bakeChain` in the same changeset as item 1 or its own `patch` changeset.

- [ ] **4. Comments.** In `draftStorage.ts`, drop "or jsdom" from the first catch comment (the draw project's jsdom has `localStorage`) and delete the three `// As above.` comments, leaving those catch blocks with a single comment each only where one says something the first does not.

- [ ] **Run** `npx vitest run --project=weasel-ui packages/theme/src/engine/derive.test.ts packages/theme/src/generated/determinism.test.ts`, `npx vitest run --project=draw apps/theme-editor/server apps/theme-editor/src/theme`, `npx tsc --noEmit`, `npx eslint packages/theme/src apps/theme-editor` → clean.

- [ ] **Commit** in two commits: the engine half (items 1 and 3, with changesets) as `limit token names to safe characters and export bakeChain`, and the app half (items 2 and 4) as `refuse theme saves that would break the token build`.

---

### Task 21: fixes from the review of Tasks 6–7 (engine; run after Task 8)

A read-only review of `f9f41e2a` and `045998fa` found three edge cases, each confirmed with a probe; none affects `weasel.json`.

**Files:**
- Modify: `packages/theme/src/engine/merge.ts`, `merge.test.ts`, `packages/theme/src/engine/steps.ts`, `packages/theme/src/engine/ramps.ts`, `ramps.test.ts`, `packages/theme/src/engine/derive.ts`, `derive.test.ts`
- Create: `.changeset/theme-ramp-edge-cases.md`

- [ ] **1. Shadow only the steps a theme declares at every selection.** `ownSteps` in `merge.ts` uses `declaredSteps`, the union across `by` branches. A child whose `ramps.gray` is `{ by: 'mode', dark: { ...gray, steps without '900' }, light: gray }` shadows weasel's `gray-900` pin in dark too, where the child produces no `gray-900`, so `derive(child, { mode: 'dark' })` throws `Token "surface-sunken" references "gray-900", which is not defined` while the runtime CSS still falls through to weasel's pin. `mergeChain` knows no selection, so shadow the intersection instead: add `alwaysDeclaredSteps(entry)` to `steps.ts` (a `by` object intersects its branches; an entry reads its `steps`, which may itself vary), and use it in `ownSteps`. Where a branch omits a step, the inherited pin then applies at every selection, which is consistent between `derive` and emission. Failing test first in `merge.test.ts` (the example above, asserting `mergeChain(child).pins` keeps `gray-900` and drops `gray-50`) and in `derive.test.ts` (`derive(child, { mode: 'dark' })` does not throw).

- [ ] **2. An anchor's peak must not explode near a zero envelope.** `lightnessRamp` sets `peak = a.C · max / e`, guarded only at `e ≤ 1e-6`, where it switches to `a.C`. With 5 steps, `lightness: [0.95, 0.3]`, an anchor on the last step `#2e1f7a` and `lightBias` 0: `darkBias` 0 gives chroma 0.10–0.14 mid-ramp, 0.001 and 0.01 give pure grays (`#bababa`, `#878787`, `#595959`), 0.05 jumps to 0.27. Replace the guard with a floor: `peak = a.C · max / Math.max(e, ANCHOR_FLOOR · max)`, `ANCHOR_FLOOR = 0.1`, and pass `toHex` a chroma no larger than `0.4` (above anything sRGB holds, so the gamut clamp decides). This makes the peak continuous in both biases. Failing test first in `ramps.test.ts`: for `darkBias` in `[0, 0.001, 0.01, 0.05]` on that ramp, the middle step's chroma stays between 0.02 and 0.3 and never jumps more than 0.1 between neighboring bias values. Check that weasel's accent (anchor mid-ramp) and the determinism test are unchanged.

- [ ] **3. Negative biases are invalid.** `lightBias: -3, darkBias: -3` makes `envelopeMax` 0 and every step `#NaNNaNNaN`; `-0.5` gives negative chroma, turning hue 250 orange. In `rampColors`, report `{ kind: 'invalid', path: '<ramp>.chroma.lightBias', message: 'expected a number ≥ 0' }` (same for `darkBias` and `peak`) and fail the ramp as the other readers do. Failing test first in `derive.test.ts`.

- [ ] **Changeset**, `patch`:

  ```md
  Three lightness ramp edge cases: a theme whose ramp steps vary by axis now shadows only the inherited pins on steps it declares in every branch, so `derive` no longer throws where a branch omits one; an anchor on a step where the chroma envelope is near zero no longer sends the ramp gray or suddenly vivid as a bias moves off 0; and a negative `peak`, `lightBias` or `darkBias` is reported as invalid instead of producing `NaN` colors.
  ```

- [ ] **Run** `npx vitest run --project=weasel-ui packages/theme/src/engine/merge.test.ts packages/theme/src/engine/ramps.test.ts packages/theme/src/engine/derive.test.ts packages/theme/src/generated/determinism.test.ts packages/theme/src/engine/bake.test.ts`, `npx tsc --noEmit`, `npx eslint packages/theme/src` → clean.

- [ ] **Commit** the eight paths; message `fix three lightness ramp edge cases in shadowing, anchoring and bias validation`.

---

### Task 22: inspecting must not operate the preview (run after Task 21)

A review of `d11f945d` found the Slider still moves while inspecting: it starts a drag on `pointerdown`, and `ThemePreview` captures only `click`. Checkbox, Switch and ToggleBar are blocked correctly (React Aria's toggle changes state from the input's `change` event, which `preventDefault` on the click cancels; ToggleBar uses `onClick`). A click that does not drag also focuses the thumb, and the arrow keys then move it.

**Files:**
- Modify: `apps/theme-editor/src/ThemePreview.tsx`, `apps/theme-editor/src/ThemePreview.test.tsx`

- [ ] **Step 1: Failing tests** — append inside the `describe` of `ThemePreview.test.tsx` (import `createEvent, fireEvent` from `@testing-library/react`):

```tsx
it('while inspecting, a click leaves the components as they were', async () => {
  render(<ThemePreview variants={[{ label: 'Draft', theme }]} selection={{}} inspecting onInspect={() => {}} />);
  const checkbox = screen.getAllByRole('checkbox', { name: 'Checkbox' })[0];
  await userEvent.click(checkbox);
  expect(checkbox).toBeChecked();
});

// A proxy: jsdom cannot drag the Slider, so this asserts the press never reaches it.
it('while inspecting, a press is stopped before any component sees it', () => {
  render(<ThemePreview variants={[{ label: 'Draft', theme }]} selection={{}} inspecting onInspect={() => {}} />);
  const thumb = screen.getAllByRole('slider', { name: 'Slider' })[0];
  for (const make of [createEvent.pointerDown, createEvent.mouseDown]) {
    const event = make(thumb);
    fireEvent(thumb, event);
    expect(event.defaultPrevented).toBe(true);
  }
});
```

Run `npx vitest run --project=draw apps/theme-editor/src/ThemePreview.test.tsx`: the second case FAILS (the first may already pass, for the reason above; keep it as the guard).

- [ ] **Step 2: Fix.** In `ThemePreview.tsx`, give the capture div `onPointerDownCapture` and `onMouseDownCapture` while inspecting, each calling a `swallow` that does `e.preventDefault(); e.stopPropagation();` (preventing `mousedown` is what keeps focus off the thumb), alongside the existing `onClickCapture`.

- [ ] **Step 3: Run** the test file → PASS; tsc and `npx eslint apps/theme-editor/src/ThemePreview.tsx` clean.

- [ ] **Step 4: Commit** the two files; message `stop inspect presses from reaching the preview's components`.

---

### Task 23: take the anchor floor back out (engine; run after Task 9)

Task 21's item 2 was wrong, and this plan is where it came from. A review of `56cad3a5` found that `peak = a.C · max / Math.max(e, 0.1 · max)` changes the common case, not only the edge: an anchor on an end step with that end's bias at 0 has `e = 0`, where the phase 1 guard kept `peak = a.C`, and the floor now makes it `10 · a.C`. Steps `50…900`, `lightness [0.97, 0.2]`, both biases 0, anchor `#1f2328` on `900`: step `500` went from `#777c82` (C 0.011) to `#4a7ebc` (C 0.111). A gray ramp anchored on its darkest step became a blue one. `weasel.json` is unaffected (its only anchor is mid-ramp).

The singularity the floor was meant to remove is real but narrower than the fix: only while a bias on the anchor's end is small and non-zero does the peak explode. Whether an anchor should set the peak directly (`peak = a.C` at any position, which removes the singularity and changes anchors placed off the envelope's peak) is a design decision for Mike and is not made here.

**Files:**
- Modify: `packages/theme/src/engine/ramps.ts`, `packages/theme/src/engine/ramps.test.ts`, `.changeset/theme-ramp-edge-cases.md`

- [ ] **Step 1: Failing test** — append to `ramps.test.ts`:

```ts
it('keeps a low-chroma ramp low-chroma when its anchor sits on an end with that bias at 0', () => {
  const steps = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
  const ramp = lightnessRamp({ steps, lightness: [0.97, 0.2], curve: 0, hue: 0, peak: 0, darkBias: 0, anchor: { '900': '#1f2328' } });
  expect(toLch(ramp['500']).C).toBeLessThan(0.02);
});
```

Run `npx vitest run --project=weasel-ui packages/theme/src/engine/ramps.test.ts` → the new case FAILS (C ≈ 0.111).

- [ ] **Step 2: Restore the guard.** In `lightnessRamp`, go back to phase 1's anchor peak — `peak = e > 1e-6 ? (a.C * max) / e : a.C` — and delete `ANCHOR_FLOOR`. Keep the `0.4` cap on the chroma passed to `toHex`: it cannot bind for an in-gamut color, and it is what stops a very small non-zero bias from producing grays instead of gamut-clipped color.

- [ ] **Step 3: Adjust Task 21's continuity test** to what the restored guard guarantees, and nothing more: for `darkBias` in `[0.001, 0.01, 0.05]` the middle step's chroma stays between 0.02 and 0.3 (no gray band). Drop the bias-0 value and the "never jumps more than 0.1" clause; the jump off 0 is the open design question above. Print the four measured values in your report.

- [ ] **Step 4: Correct the changeset.** In `.changeset/theme-ramp-edge-cases.md`, replace the anchor clause with: "an anchor on a step where the chroma envelope is near zero no longer turns the ramp's other steps gray while a bias moves off 0 (the ramp's chroma still rises steeply there)", and replace "instead of producing `NaN` colors" with "instead of producing `NaN` colors or flipping the hue".

- [ ] **Step 5: Run** `npx vitest run --project=weasel-ui packages/theme/src/engine/ramps.test.ts packages/theme/src/engine/derive.test.ts packages/theme/src/generated/determinism.test.ts`, `npx tsc --noEmit`, `npx eslint packages/theme/src` → clean.

- [ ] **Step 6: Commit** the three paths; message `restore the anchored ramp's peak at a zero envelope`.

---

### Task 24: fixes from the review of Task 9 (run after Task 10)

A review of `8ef718a9` found these; each was verified against the code.

**Files:**
- Modify: `apps/theme-editor/src/theme/model.ts`, `model.test.ts`, `apps/theme-editor/src/theme/rows.ts`, `rows.test.ts`, `apps/theme-editor/src/LayerRail.tsx`, `LayerRail.test.tsx`, `apps/theme-editor/src/TokenList.tsx`, `apps/theme-editor/src/ThemeEditor.module.css`

- [ ] **1. The Pins row and the Pins table count the same pins.** `countTokens` counts every key of `def.pins`; `layerRows('pins')` lists only names with a token at the selection. A pin that fails at a selection (a `by` missing that value, an unknown seed) makes the rail say 89 and the table show 88, and a failing pin over a generated token shows the rule's value in the Pins table as though it were the pin. Both should count and list a pin only where it applies: `provenance[name]?.pinned || provenance[name]?.layer === 'pins'`. Put that predicate in `model.ts` as `export const pinApplies = (result: DeriveResult, name: string) => ...`, use it in both. Failing tests first: a definition with `pins: { gap: { by: 'mode', dark: { value: '4px', type: 'dimension' } } }` over weasel counts one more pin at `{ mode: 'dark' }` than at `{ mode: 'light' }` (in `model.test.ts`), and `layerRows('pins', …)` has the same length as `countTokens(…).layers.pins.count` at both selections (in `rows.test.ts`).

- [ ] **2. Rail buttons are forced to 24px.** `.railItem` sets no `height`, so labkit's `:where(button) { height: var(--wzl-control-h) }` applies under `.lk-root`, and its 6px padding leaves 12px for a line of text. Add `height: auto;` to `.railItem`, and a hover state: `.railItem:hover { background: var(--wzl-surface-raised); }` (the existing `[aria-current='true']` rule stays after it, so it still wins).

- [ ] **3. The rail's accessible names.** Give each rail button `aria-label={pinned > 0 ? \`${label}, ${count} tokens, ${pinned} pinned\` : \`${label}, ${count} tokens\`}`, keeping the visible spans. Update `LayerRail.test.tsx` to assert the names (`['Seeds, 0 tokens', 'Ramps, 23 tokens, 23 pinned', …]`) instead of the run-together `textContent`, and the workbench test's `getByRole('button', { name: /^Ramps/ })` still matches.

- [ ] **4. Alpha shows.** In `rows.ts`, a token with `alpha` shows its value as `${value} at ${Math.round(alpha * 100)}%` (as `ruleSummary` does). Failing test first: weasel's `line-subtle` row (pins layer) reads `{fg} at 10%` — check the real pin and its alpha in `weasel.json` first and assert what it holds.

- [ ] **5. Comment.** In `TokenList.tsx`, "the first is scrolled into view" becomes "the first highlighted row is scrolled into view".

- [ ] **Run** `npx vitest run --project=draw apps/theme-editor/src/theme/model.test.ts apps/theme-editor/src/theme/rows.test.ts apps/theme-editor/src/LayerRail.test.tsx apps/theme-editor/src/ThemeWorkbench.test.tsx`, `npx tsc --noEmit`, `npx eslint apps/theme-editor/src` → clean.

- [ ] **Commit** the eight paths; message `count and list pins where they apply, and fix the layer rail's height and names`.

---

### Task 25: fixes from the review of Tasks 10 and 24 (run after Task 12)

A review of `695ad747` and `a14ac65a` found these; each was verified against the code.

**Files:**
- Modify: `apps/theme-editor/src/ThemeEditor.tsx`, `ThemeEditor.test.tsx`, `apps/theme-editor/src/ThemeWorkbench.tsx`, `ThemeWorkbench.test.tsx`, `apps/theme-editor/src/App.tsx`

- [ ] **1. A failed reload must not lose the draft.** `ThemeEditor`'s `reload` calls `clearDraft` and then awaits `api.get`; when the fetch fails the rejection goes nowhere, the workbench still shows the dirty draft, its persist effect does not rerun, and a page refresh finds nothing. Fetch first, and clear the draft only once the fetch succeeded. `onReload` becomes `() => Promise<void>`; the workbench awaits it and, on rejection, shows `Couldn't reload ${stored.name} from disk: ${message}` in its status area (role `status`). Failing test first in `ThemeEditor.test.tsx`: with an api whose `list` returns a stored weasel with `hash: 'h1'` and whose `get` rejects, a workbench started from an edited draft (`put` answers `conflict`), clicking Save then "Reload from disk" shows the "Couldn't reload" message and the Save button still reads "Save, with unsaved changes". (Give `ThemeEditor` the draft through the api path it already has: if seeding a draft needs `localStorage`, which the draw project's jsdom provides, set it with `persistDraft` in the test and clear it in `afterEach`.)

- [ ] **2. Saving is announced and keeps focus somewhere.** The Save button disables itself on click, so keyboard focus falls to the body, and "Saved." is a bare paragraph. Wrap the save report in one status region: a `div` with `role="status"`, `tabIndex={-1}` and a ref, rendered whenever `report` is set, and focus it in an effect whenever `report` changes. The conflict case inside it keeps its buttons. Failing test first in `ThemeWorkbench.test.tsx`: after a successful save, `document.activeElement` is the element with `role="status"` that contains "Saved.".

- [ ] **3. The derive error is a status, not an alert.** Its text changes with each keystroke that breaks a reference. Change its `role="alert"` to `role="status"`. The conflict test that queries `findByRole('alert')` now finds the status region: update it to `findByRole('status')`.

- [ ] **4. Dirty means different, not a different object.** `dirty` becomes `draft !== saved && !sameJson(draft, saved)` (keep `baseHash === null` if Task 17 has added it). Failing test first: starting from `{ definition: { ...weasel }, baseHash: 'h1' }` (a copy equal to disk), Save is disabled.

- [ ] **5. Comment.** Delete `App.tsx`'s docstring sentence that lists the routes; `ROUTES` says it.

- [ ] **Run** `npx vitest run --project=draw apps/theme-editor/src/ThemeEditor.test.tsx apps/theme-editor/src/ThemeWorkbench.test.tsx`, `npx tsc --noEmit`, `npx eslint apps/theme-editor/src` → clean.

- [ ] **Commit** the five paths; message `keep a draft through a failed reload, and announce saves`.
