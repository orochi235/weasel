# Demos by Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a **Packages** section to the demo site sidebar and move the single-package demos into it, each importing its package from `@weasel-js/<package>` itself.

**Architecture:** Each registry entry carries exactly one of `category` (feature section) or `package` (Packages section), enforced by a union type. One helper, `placeOf`, answers "where is this demo filed" for the sidebar, the eyebrow and What's new. A source-text test holds every package demo to importing its own package.

**Tech Stack:** React, Vite, vitest (`site` project), TypeScript.

Spec: `docs/superpowers/specs/2026-09-27-demos-by-package-design.md`. Delete both files in the final task.

**Test command** for everything here: `npx vitest run apps/site/__tests__` (never the whole suite). Typecheck: `npx tsc --noEmit` from the repo root.

---

### Task 0: Branch

- [ ] `git -C /Users/mike/src/weasel switch -c demos-by-package` (from an up-to-date `main`).

---

### Task 1: Registry placement

**Files:**
- Modify: `apps/site/registry.ts` (the `DemoMeta` interface, and the exports after `DEMO_META`)
- Test: `apps/site/__tests__/registry.test.ts`

- [ ] **Step 1: Write the failing tests.** In `registry.test.ts`, change the import to
  `import { CATEGORIES, DEMOS, DEMOS_BY_ID, PACKAGES, placeOf } from '../registry';`
  and replace the three tests `gives every demo a title, category and description`,
  `derives categories in first-appearance order, with no duplicates` and
  `partitions every demo into exactly one rendered category` with:

```ts
  it('gives every demo a title, a place and a description', () => {
    const blank = DEMOS.filter((d) => !d.title?.trim() || !placeOf(d).trim() || !d.description?.trim());
    expect(blank.map((d) => d.id)).toEqual([]);
  });

  it('files every demo under a category or a package, never both', () => {
    const both = DEMOS.filter((d) => (d.category === undefined) === (d.package === undefined));
    expect(both.map((d) => d.id)).toEqual([]);
  });

  it('derives categories and packages in first-appearance order, with no duplicates', () => {
    expect(CATEGORIES).toEqual([...new Set(DEMOS.flatMap((d) => (d.category ? [d.category] : [])))]);
    expect(PACKAGES).toEqual([...new Set(DEMOS.flatMap((d) => (d.package ? [d.package] : [])))]);
  });

  it('renders every demo under exactly one heading', () => {
    // The nav loops over CATEGORIES then PACKAGES and filters DEMOS by each, so
    // a demo reached by neither would silently never render.
    const placed = [
      ...CATEGORIES.flatMap((c) => DEMOS.filter((d) => d.category === c)),
      ...PACKAGES.flatMap((p) => DEMOS.filter((d) => d.package === p)),
    ];
    expect(placed).toHaveLength(DEMOS.length);
  });
```

- [ ] **Step 2: Run** `npx vitest run apps/site/__tests__/registry.test.ts`. Expected: FAIL, `PACKAGES`/`placeOf` not exported.

- [ ] **Step 3: Implement.** In `registry.ts`, remove `category: string;` from `DemoMeta` and make the placement a union:

```ts
/** Where the sidebar files a demo: a feature section, or a package's heading
 *  under Packages. Exactly one. */
type Placement =
  | { category: string; package?: never }
  | { package: string; category?: never };

interface DemoInfo {
  id: string;
  title: string;
  // …every other existing DemoMeta field, unchanged…
}

type DemoMeta = DemoInfo & Placement;
```

`DemoEntry` becomes `export type DemoEntry = DemoMeta & { Component: …; sources: …; created?: …; lastModified?: … }` (same fields, moved into the intersection, since an interface cannot extend a union). Then replace the `CATEGORIES` export with:

```ts
export const CATEGORIES = Array.from(new Set(DEMOS.flatMap((d) => (d.category ? [d.category] : []))));

/** Package names (unscoped) that have at least one demo, in registry order. */
export const PACKAGES = Array.from(new Set(DEMOS.flatMap((d) => (d.package ? [d.package] : []))));

/** The heading a demo is filed under. */
export function placeOf(d: DemoEntry): string {
  return d.category ?? d.package;
}
```

- [ ] **Step 4: Run** the registry test and `npx tsc --noEmit`. Expected: PASS; tsc errors only at `WeaselDemos.tsx` / `WhatsNew.tsx` uses of `category` if any are typed strictly (fixed in Task 2).

- [ ] **Step 5: Commit** `git commit -m "file each demo under a category or a package" -- apps/site/registry.ts apps/site/__tests__/registry.test.ts`

---

### Task 2: Sidebar, eyebrow, What's new

**Files:**
- Modify: `apps/site/WeaselDemos.tsx` (nav at ~108–123, eyebrow at ~188)
- Modify: `apps/site/WhatsNew.tsx` (`SortKey`, the Category column, `sortDemos`)
- Modify: `apps/site/canvas-kit-demo.css` (after `.ckd-nav-section h2`, ~line 107)
- Test: `apps/site/__tests__/WeaselDemos.routing.test.tsx`

- [ ] **Step 1: Write the failing test.** Add to `WeaselDemos.routing.test.tsx` (reuse its existing render helper; read the file first):

```ts
  it('lists package demos under a Packages heading, by package', () => {
    // render <WeaselDemos /> as the other tests in this file do
    const packages = screen.getByRole('heading', { name: 'Packages' });
    const group = packages.closest('section')!;
    expect(within(group).getByRole('heading', { name: 'audio' })).toBeTruthy();
    expect(within(group).getByRole('link', { name: 'Audio' })).toBeTruthy();
  });
```

(This fails until Task 3 files `audio` under a package; run it after Task 3 if doing strict red/green, or temporarily set `package: 'audio'` on the audio entry now — Task 3 makes it permanent.)

- [ ] **Step 2: Implement the nav.** In `WeaselDemos.tsx`, import `PACKAGES` and `placeOf`, extract the link list so both loops share it, and render the Packages group after the categories:

```tsx
function DemoLinks({ demos, activeId, onPick }: { demos: DemoEntry[]; activeId: string; onPick: (id: string) => void }) {
  return (
    <ul>
      {demos.map((d) => (
        <li key={d.id}>
          <a
            href={`#${d.id}`}
            className={d.id === activeId ? 'active' : ''}
            onClick={(e) => { e.preventDefault(); onPick(d.id); }}
          >{d.title}</a>
        </li>
      ))}
    </ul>
  );
}
```

```tsx
          {CATEGORIES.map((cat) => (
            <section key={cat} className="ckd-nav-section">
              <h2>{cat}</h2>
              <DemoLinks demos={DEMOS.filter((d) => d.category === cat)} activeId={activeId} onPick={setActiveId} />
            </section>
          ))}
          {PACKAGES.length > 0 && (
            <section className="ckd-nav-section ckd-nav-packages">
              <h2>Packages</h2>
              {PACKAGES.map((pkg) => (
                <section key={pkg} className="ckd-nav-package">
                  <h3>{pkg}</h3>
                  <DemoLinks demos={DEMOS.filter((d) => d.package === pkg)} activeId={activeId} onPick={setActiveId} />
                </section>
              ))}
            </section>
          )}
```

Eyebrow: `{entry.category}` → `{placeOf(entry)}`.

- [ ] **Step 3: CSS.** After the `.ckd-nav-section h2` rule:

```css
.ckd-nav-package + .ckd-nav-package {
  margin-top: 10px;
}

.ckd-nav-package h3 {
  font-size: 11px;
  font-weight: 600;
  font-family: var(--ckd-mono, ui-monospace, monospace);
  color: var(--ckd-faint);
  margin: 0 0 4px 8px;
}
```

(Check whether `--ckd-mono` exists in the file; use the file's existing monospace token if it has another name, else drop the `var()`.)

- [ ] **Step 4: What's new.** In `WhatsNew.tsx`: `SortKey` `'category'` → `'place'`; the header `<Th label="Filed under" colKey="place" …/>`; the cell `<td>{placeOf(d)}</td>`; in `sortDemos` read the value through one accessor:

```ts
const valueOf = (d: DemoEntry, key: SortKey): string => (key === 'place' ? placeOf(d) : (d[key] ?? ''));
```

and use `valueOf(a, key)` / `valueOf(b, key)` in place of the two casts.

- [ ] **Step 5: Run** `npx vitest run apps/site/__tests__` and `npx tsc --noEmit`. Expected: PASS.

- [ ] **Step 6: Commit** `git commit -m "add a Packages section to the demo sidebar" -- apps/site/WeaselDemos.tsx apps/site/WhatsNew.tsx apps/site/canvas-kit-demo.css apps/site/__tests__/WeaselDemos.routing.test.tsx`

---

### Task 3: Move the entries

**Files:**
- Modify: `apps/site/registry.ts`
- Create: `apps/site/__tests__/packageDemos.test.ts`

- [ ] **Step 1: Write the failing test** `apps/site/__tests__/packageDemos.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEMOS } from '../registry';

const ROOT = resolve(__dirname, '../../..');

// A demo under a package shows that package; importing it through core's
// re-exports teaches nothing about the package on its own.
describe('package demos', () => {
  it('import their own package', () => {
    const bad = DEMOS.filter((d) => d.package).filter((d) => {
      const src = readFileSync(resolve(ROOT, d.path), 'utf8');
      return !new RegExp(`from '@weasel-js/${d.package}(/[^']*)?'`).test(src);
    });
    expect(bad.map((d) => `${d.id} (${d.package})`)).toEqual([]);
  });

  it('never import a package by relative path', () => {
    const bad = DEMOS.filter((d) => /from '(\.\.\/)+packages\//.test(readFileSync(resolve(ROOT, d.path), 'utf8')));
    expect(bad.map((d) => d.id)).toEqual([]);
  });
});
```

- [ ] **Step 2: Refile.** In `registry.ts`, replace `category: …` with `package: …` on these ids, and move each entry into a block at the end of `DEMO_META` under a `// ─── Packages ───` banner, grouped in this order (the order becomes `PACKAGES`):

| package | ids |
|---|---|
| `ui` | `perceptual-color-sliders`, `layered-curve`, `layer-list`, `selection-panel` |
| `quantity` | `quantity` |
| `text` | `text-script`, `text-nodes` |
| `audio` | `audio` |
| `d3` | `d3-sortable` |
| `diagram` | `diagram-nodes`, `diagram-edges`, `diagram-layout`, `diagram-live` |
| `hud` | `hud`, `loupe` |
| `labkit` | `annotation-capture`, `lab-loupe`, `auto-controls` |

Delete the now-empty `// ─── weasel-hud ───` / `// ─── labkit ───` banners. Easings, Text outlines and Boolean ops keep their categories.

- [ ] **Step 3: Run** `npx vitest run apps/site/__tests__`. Expected: `packageDemos` FAILS on `text-script`, `text-nodes` (import text via core) and `hud` (relative path). Everything else passes.

- [ ] **Step 4: Commit** the refile alone: `git commit -m "move 18 single-package demos under Packages" -- apps/site/registry.ts apps/site/__tests__/packageDemos.test.ts` (test red is fixed in Task 4; if committing red is unwanted, do Task 4 first and commit together).

---

### Task 4: Imports from the package itself

**Files:**
- Modify: `apps/site/demos/HudDemo.tsx:3-4`
- Modify: `apps/site/demos/TextScriptDemo.tsx:2-8`
- Modify: `apps/site/demos/TextNodesDemo.tsx:2-5`

- [ ] **Step 1: HudDemo.**

```ts
import { useHud, useHudContribution } from '@weasel-js/hud/react';
import type { ButtonWidget } from '@weasel-js/hud';
```

- [ ] **Step 2: TextScriptDemo.** Text symbols from text; the stage and paint from core:

```ts
import { SceneCanvas, useScene, textCommandFromRuns, solid } from '@weasel-js/core';
import type { FillStyle, SceneViewDrawOne } from '@weasel-js/core';
import { SCRIPT_METRICS } from '@weasel-js/text';
import type { StyledRun, TextStyle } from '@weasel-js/text';
```

- [ ] **Step 3: TextNodesDemo.**

```ts
import { SceneCanvas, asNodeId, solid, useScene, useSceneTextEdit } from '@weasel-js/core';
import type { FillStyle } from '@weasel-js/core';
import type { StyledRun, TextStyle, TextVerticalAlign } from '@weasel-js/text';
```

(Keep whatever else those `import type` blocks already list — read lines 1–12 first and move only the names `packages/text/src/index.ts` exports.)

- [ ] **Step 4: Run** `npx vitest run apps/site/__tests__` and `npx tsc --noEmit`. Expected: PASS. Then `npm run check:manifests` — if the site's manifest must declare `@weasel-js/text` / `@weasel-js/hud`, it says so; add them the way the other `@weasel-js/*` deps are declared.

- [ ] **Step 5: Commit** `git commit -m "import text and hud from their own packages in their demos" -- apps/site/demos/HudDemo.tsx apps/site/demos/TextScriptDemo.tsx apps/site/demos/TextNodesDemo.tsx`

---

### Task 5: See it

- [ ] Start the site dev server in the background from this checkout (`npm run dev:kit`, `run_in_background: true`; check the per-turn process list for one already running first).
- [ ] With the headless playwright MCP, open it, screenshot the sidebar scrolled to Packages, and one moved demo (`#text-script`) showing the eyebrow `text`. Send both to the wall: `slop <file>` (zone `weasel`).
- [ ] Open `#hud` and `#text-nodes` and check the console is clean. Close the MCP page, stop the dev server.

---

### Task 6: TODO, and retire the scaffolding

**Files:**
- Modify: `docs/TODO.md` (section `## Demos & visual regression`, line ~1223)
- Delete: `docs/superpowers/specs/2026-09-27-demos-by-package-design.md`, this plan

- [ ] **Step 1:** Add under `## Demos & visual regression`:

```md
- **(P3) Demos for packages that have none.** The sidebar's Packages section lists only
  packages with a demo that imports them directly (`apps/site/__tests__/packageDemos.test.ts`).
  None yet for `gestures`, `history`, `routing`, `bidi`, `svg`, `paint`, `cursor`, `modes`,
  `kernel3d`, `loupe`, `geom`.
- **(P3) A minimal public stage for package demos.** Demos of scene-free packages
  (`quantity`, `text`, `bidi`, `geom`, `audio`) still mount a whole `SceneCanvas` to draw.
  Not the primitive `<Canvas>`, which was unexported on purpose. Enforce its reach in
  `packageDemos.test.ts`: only a Packages-section demo of a scene-free package may import it.
```

- [ ] **Step 2:** `git rm` the spec and this plan.
- [ ] **Step 3: Commit** `git commit -m "file follow-ups for package demos; drop the spec and plan" -- docs/TODO.md docs/superpowers/specs/2026-09-27-demos-by-package-design.md docs/superpowers/plans/2026-09-27-demos-by-package.md`
- [ ] **Step 4:** Offer to merge `demos-by-package` into `main`. No push without an explicit OK.
