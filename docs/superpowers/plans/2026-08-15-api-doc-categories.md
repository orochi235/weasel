# API Doc Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group the generated `dist-demo/api` index by ten subject categories instead of by TypeScript kind, without touching any file under `packages/core/src`.

**Architecture:** A local TypeDoc plugin listens on `EVENT_RESOLVE_END` and pushes an `@category` block tag onto each top-level export's comment, choosing the category from the declaration's source path. TypeDoc's own `CategoryPlugin` listens on the same event at priority `-200`, and `on()` places higher priority earlier, so a plugin at the default priority 0 always runs first. The path→category decision is a pure function with its own tests; the plugin is a thin adapter.

**Tech Stack:** TypeDoc 0.28, plain ESM JavaScript (`.mjs`, so TypeDoc can `import` the plugin without a TS loader), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-15-api-doc-categories-design.md`.

---

## File structure

| File | Responsibility |
|---|---|
| `typedoc/categories.mjs` | The taxonomy: ordered rules, name overrides, sidebar order. The only file holding judgment. |
| `typedoc/categoryOf.mjs` | Pure `(sourcePath, symbolName) => category \| null`. |
| `typedoc/categoryOf.test.mjs` | Tests for the resolver. |
| `typedoc/plugin.mjs` | TypeDoc hook: reflections → `categoryOf` → `@category` tag; throws on any miss. |
| `typedoc.json` | Registers the plugin, turns off kind-grouping, fixes category order. |
| `vitest.config.ts` | Adds `typedoc/**/*.test.mjs` to the `kit` project. |

A rule is a **path prefix** relative to `packages/core/src/` — `'core/viewport'` matches everything beneath it. That is the `**` glob from the spec with no glob engine required.

---

### Task 1: The pure resolver

**Files:**
- Create: `typedoc/categories.mjs`
- Create: `typedoc/categoryOf.mjs`
- Test: `typedoc/categoryOf.test.mjs`
- Modify: `vitest.config.ts` (the `kit` project's `include`)

- [ ] **Step 1: Add the test glob so a new test is actually collected**

In `vitest.config.ts`, the `kit` project's `include` array, add a fourth entry:

```ts
          include: [
            'packages/core/src/**/*.test.{ts,tsx}',
            'apps/site/**/*.test.{ts,tsx}',
            'tests/e2e/helpers/**/*.test.{ts,tsx}',
            'typedoc/**/*.test.mjs',
          ],
```

- [ ] **Step 2: Write the failing test**

Create `typedoc/categoryOf.test.mjs`:

```js
import { describe, expect, it } from 'vitest';
import { categoryOf } from './categoryOf.mjs';

const abs = (rel) => `/Users/x/weasel/packages/core/src/${rel}`;

describe('categoryOf', () => {
  it('maps a path to its category', () => {
    expect(categoryOf(abs('core/viewport/useViewTween.ts'), 'useViewTween')).toBe('Viewport');
  });

  it('takes the first matching rule, so a specific path beats a general one', () => {
    // createHistory lives under core/ops/, which the Scene rule would swallow.
    expect(categoryOf(abs('core/ops/createHistory.ts'), 'createHistory')).toBe('History');
    expect(categoryOf(abs('core/ops/insert.ts'), 'createInsertOp')).toBe('Scene');
  });

  it('lets a name override beat every path rule', () => {
    expect(categoryOf(abs('core/viewport/anything.ts'), 'VERSION')).toBe('Extension points');
  });

  it('returns null when no rule matches', () => {
    expect(categoryOf(abs('nowhere/atAll.ts'), 'mystery')).toBeNull();
  });

  it('handles a path that is already relative', () => {
    expect(categoryOf('packages/core/src/renderer/WeaselRenderer.ts', 'WeaselRenderer')).toBe('Rendering');
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npx vitest run --project=kit typedoc/categoryOf.test.mjs`
Expected: FAIL — `Failed to resolve import "./categoryOf.mjs"`.

- [ ] **Step 4: Write the taxonomy**

Create `typedoc/categories.mjs`. Rules are ordered; first match wins. Paths are relative to `packages/core/src/`.

```js
/** Sidebar order. Alphabetical would open on "Extension points". */
export const CATEGORY_ORDER = [
  'Scene',
  'Rendering',
  'Tools & gestures',
  'Selection & actions',
  'Paths & geometry',
  'Viewport',
  'Paint & fills',
  'Text',
  'History',
  'Extension points',
];

/** @type {ReadonlyArray<readonly [string, string]>} */
export const RULES = [
  // Specific-before-general pairs come first.
  ['core/ops/createHistory', 'History'],
  ['features/paths', 'Paths & geometry'],
  ['features/text', 'Text'],
  ['features/patterns', 'Paint & fills'],
  ['features/selection', 'Selection & actions'],
  ['features/groups', 'Scene'],
  ['features/ingestion', 'Extension points'],

  ['core/scene', 'Scene'],
  ['core/ops', 'Scene'],
  ['core/adapters', 'Scene'],
  ['core/selection', 'Selection & actions'],
  ['core/viewport', 'Viewport'],
  ['core/paint-types', 'Paint & fills'],
  ['core/units', 'Extension points'],
  ['core/stylus', 'Tools & gestures'],

  ['renderer', 'Rendering'],
  ['canvas', 'Rendering'],

  ['tools', 'Tools & gestures'],
  ['interactions/gestures', 'Tools & gestures'],
  ['interactions/actions/defaults/enterTextEdit', 'Text'],
  ['interactions/actions', 'Selection & actions'],
  ['interactions', 'Tools & gestures'],

  ['util/paint', 'Paint & fills'],
  ['contributions', 'Extension points'],
  ['layout', 'Extension points'],
  ['affordances', 'Selection & actions'],
  ['animation', 'Rendering'],
  ['debug', 'Extension points'],
  ['icons', 'Extension points'],
  ['features', 'Extension points'],
  ['util', 'Extension points'],
  ['core', 'Scene'],
];

/**
 * Symbol-name overrides, which beat every path rule. For the symbol whose file
 * is a poor guide to its subject. An override that could be a path rule should
 * be one.
 * @type {Record<string, string>}
 */
export const OVERRIDES = {
  VERSION: 'Extension points',
};
```

- [ ] **Step 5: Write the resolver**

Create `typedoc/categoryOf.mjs`:

```js
import { OVERRIDES, RULES } from './categories.mjs';

const ROOT = 'packages/core/src/';

/**
 * @param {string} sourcePath absolute or repo-relative path to the declaration
 * @param {string} symbolName the exported name
 * @returns {string | null} the category, or null when nothing matches
 */
export function categoryOf(sourcePath, symbolName) {
  const override = OVERRIDES[symbolName];
  if (override) return override;

  const normalized = sourcePath.replaceAll('\\', '/');
  const at = normalized.lastIndexOf(ROOT);
  const rel = at === -1 ? normalized : normalized.slice(at + ROOT.length);

  for (const [prefix, category] of RULES) {
    if (rel === prefix || rel.startsWith(`${prefix}/`) || rel.startsWith(`${prefix}.`)) {
      return category;
    }
  }
  return null;
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run --project=kit typedoc/categoryOf.test.mjs`
Expected: PASS, 5 tests.

- [ ] **Step 7: Commit**

```bash
git add typedoc/categories.mjs typedoc/categoryOf.mjs typedoc/categoryOf.test.mjs vitest.config.ts
git commit -m "map core's source paths to API doc categories"
```

---

### Task 2: The TypeDoc plugin

**Files:**
- Create: `typedoc/plugin.mjs`
- Modify: `typedoc.json`

- [ ] **Step 1: Write the plugin**

Create `typedoc/plugin.mjs`:

```js
import { Comment, CommentTag, Converter } from 'typedoc';
import { categoryOf } from './categoryOf.mjs';

/** @param {import('typedoc').Application} app */
export function load(app) {
  // TypeDoc's CategoryPlugin reads @category on this same event at priority
  // -200, and higher priority runs first, so the default 0 lands before it.
  app.converter.on(Converter.EVENT_RESOLVE_END, (context) => {
    /** @type {string[]} */
    const uncategorized = [];

    for (const child of context.project.children ?? []) {
      const sourcePath = child.sources?.[0]?.fileName ?? '';
      const category = categoryOf(sourcePath, child.name);

      if (!category) {
        uncategorized.push(`    ${child.name.padEnd(28)}${sourcePath || '(no source)'}`);
        continue;
      }

      child.comment ??= new Comment();
      const already = child.comment.blockTags.some((t) => t.tag === '@category');
      if (already) continue;

      child.comment.blockTags.push(
        new CommentTag('@category', [{ kind: 'text', text: category }]),
      );
    }

    if (uncategorized.length > 0) {
      throw new Error(
        `${uncategorized.length} export(s) match no category rule:\n` +
          `${uncategorized.join('\n')}\n\n` +
          `  Add a rule to typedoc/categories.mjs`,
      );
    }
  });
}
```

- [ ] **Step 2: Register it**

In `typedoc.json`, add three keys after `"readme": "README.md",`:

```json
  "plugin": ["./typedoc/plugin.mjs"],
  "categorizeByGroup": false,
  "categoryOrder": [
    "Scene",
    "Rendering",
    "Tools & gestures",
    "Selection & actions",
    "Paths & geometry",
    "Viewport",
    "Paint & fills",
    "Text",
    "History",
    "Extension points"
  ],
```

- [ ] **Step 3: Run the real build**

Run: `npx typedoc 2>&1 | tail -30`

Expected on the first run: the build **fails**, listing every export whose path no rule covers. That is the gate working. Do not proceed until the message is a real list of symbols — a crash inside the plugin (`Cannot read properties of undefined`) is a bug in the plugin, not a missing rule.

- [ ] **Step 4: Close the gaps**

For each symbol in the failure list, add a rule to `RULES` in `typedoc/categories.mjs` (preferred) or, only when the file is a poor guide to the subject, an entry in `OVERRIDES`. Re-run `npx typedoc` after each edit until it succeeds.

Every rule added here must also keep Task 1's tests passing:

Run: `npx vitest run --project=kit typedoc/categoryOf.test.mjs`
Expected: PASS.

- [ ] **Step 5: Verify the rendered index**

Run:

```bash
grep -oE '<h2>[^<]+</h2>' dist-demo/api/modules.html | head -12
```

Expected: the ten category names in `CATEGORY_ORDER`, **not** `Classes` / `Interfaces` / `Type Aliases` / `Variables` / `Functions`.

- [ ] **Step 6: Commit**

```bash
git add typedoc/plugin.mjs typedoc/categories.mjs typedoc.json
git commit -m "group the API docs by subject instead of by TypeScript kind"
```

---

### Task 3: Pin the failure mode

A gate nobody has watched fail is not known to work.

**Files:**
- Test: `typedoc/categoryOf.test.mjs`

- [ ] **Step 1: Add the test**

Append to `typedoc/categoryOf.test.mjs`:

```js
import { RULES } from './categories.mjs';

describe('the rule table', () => {
  it('has no rule shadowed by an earlier, more general one', () => {
    const shadowed = [];
    for (let i = 0; i < RULES.length; i++) {
      for (let j = 0; j < i; j++) {
        const [earlier] = RULES[j];
        const [later, category] = RULES[i];
        if (later.startsWith(`${earlier}/`) && RULES[j][1] !== category) {
          shadowed.push(`${later} is unreachable behind ${earlier}`);
        }
      }
    }
    expect(shadowed).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project=kit typedoc/categoryOf.test.mjs`
Expected: PASS.

- [ ] **Step 3: Prove the build gate fires**

Temporarily delete the last rule in `RULES` (`['core', 'Scene']`), then run:

Run: `npx typedoc 2>&1 | tail -20`
Expected: FAIL, naming symbols under `core/`.

Restore the rule and re-run:

Run: `npx typedoc 2>&1 | tail -3`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add typedoc/categoryOf.test.mjs
git commit -m "pin the category table against shadowed rules"
```

---

### Task 4: Full gate

- [ ] **Step 1: Run the suite the CI job runs**

Run: `npx vitest run --project=kit 2>&1 | tail -8`
Expected: PASS.

- [ ] **Step 2: Run the whole docs build**

Run: `npm run build:api 2>&1 | tail -5`
Expected: success, including `build:api:gestures` — the gestures build uses its own `typedoc.json` and must be unaffected, since the plugin is registered only in the root config.

- [ ] **Step 3: Typecheck and lint**

Run: `npm run typecheck && npm run lint 2>&1 | tail -5`
Expected: PASS. `typedoc/` is outside the root tsconfig's `include`, so the new `.mjs` files are not typechecked; this step confirms nothing else broke.
