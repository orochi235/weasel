# Feature-Roles Convention + Focus/Grid Barrel Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Document the kit's dev-side feature-organization convention and apply barrel hygiene to the focus and grid features so the kit's main barrel imports through feature barrels, not internal paths.

**Architecture:** Pure documentation + import-routing change. No new public API, no behavior changes. Each `src/features/<name>/index.ts` becomes the feature's public surface; `src/index.ts` (the kit's main barrel) imports from those barrels exclusively. The role taxonomy (api/attrs/layers — already documented in `docs/taxonomy.md`) stays a thinking tool, not a code shape.

**Tech Stack:** TypeScript, Vitest, the kit's existing build (tsup). No new deps.

**Spec:** `docs/superpowers/specs/2026-05-09-feature-roles-focus-grid-design.md`.

---

## File map

**Modify:**
- `docs/taxonomy.md` — add a 5-point feature-authoring guide subsection under the Feature entry.
- `src/features/grid/index.ts` — replace inline `roundToCell` with proper barrel that re-exports every grid primitive.
- `src/index.ts` — drop deep imports of grid internals; rely on `export * from './features/grid'` (which is already there) for the full grid surface.
- `docs/TODO.md` — update the "Feature-roles taxonomy" entry from "in design — informal" to "shipped" with links.

**Create:**
- `src/features/grid/roundToCell.ts` — extract the existing one-line function into its own file (consistent with the rest of the grid primitives, each in their own file).

**Test (no new test files; verify existing tests still pass):**
- `src/features/grid/grid.test.ts` — currently imports `roundToCell` from `'.'`. After the move it'll resolve through the barrel. Run as a regression check.
- `src/features/grid/useGridCellHover.test.ts`, `cellHighlight.test.ts`, `layer.test.ts` — unchanged, regression only.
- `src/features/focus/useCanvasFocus.test.ts`, `gateLayer.test.ts` — unchanged, regression only.

---

## Task 1: Move `roundToCell` to its own file

**Files:**
- Create: `src/features/grid/roundToCell.ts`
- Modify: `src/features/grid/index.ts`
- Test: `src/features/grid/grid.test.ts` (existing — runs as regression)

- [ ] **Step 1.1: Create the new file**

Create `src/features/grid/roundToCell.ts` with this content:

```ts
/** Round `value` to the nearest multiple of `cellSize`. Returns 0 when the result would be -0. */
export function roundToCell(value: number, cellSize: number): number {
  return Math.round(value / cellSize) * cellSize || 0;
}
```

- [ ] **Step 1.2: Update the grid barrel to re-export `roundToCell` from its new location**

Replace the entire contents of `src/features/grid/index.ts` with:

```ts
export { roundToCell } from './roundToCell';
export { useGridCellHover } from './useGridCellHover';
export type {
  UseGridCellHoverOptions,
  UseGridCellHoverReturn,
} from './useGridCellHover';
export { createGridLayer } from './layer';
export type { GridLayerOpts } from './layer';
export { createCellHighlightLayer } from './cellHighlight';
export type { CellHighlightLayerOpts } from './cellHighlight';
```

This barrel now re-exports every public grid primitive. `grid.test.ts` imports `roundToCell` via `from '.'`, which still resolves correctly.

- [ ] **Step 1.3: Run the grid tests as a regression check**

Run: `npx vitest run src/features/grid/`
Expected: PASS — `grid.test.ts` still resolves `roundToCell` (now via the barrel re-export); the other grid tests are unchanged.

- [ ] **Step 1.4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 1.5: Commit**

```bash
git add src/features/grid/roundToCell.ts src/features/grid/index.ts
git commit -m "refactor(grid): extract roundToCell, complete the feature barrel"
```

---

## Task 2: Drop deep imports of grid internals from the kit's main barrel

**Files:**
- Modify: `src/index.ts`

The kit's main barrel currently imports grid primitives via two paths: `export * from './features/grid'` (line ~54, picks up `roundToCell`) AND deep imports like `from './features/grid/useGridCellHover'`. After Task 1, the feature barrel exports everything; the deep imports are redundant and should go.

- [ ] **Step 2.1: Find the lines that import grid internals**

Run: `grep -n "from './features/grid/" src/index.ts`
Expected output (line numbers may shift slightly):
```
67:export { useGridCellHover } from './features/grid/useGridCellHover';
68:export type {
69:  UseGridCellHoverOptions,
70:  UseGridCellHoverReturn,
71:} from './features/grid/useGridCellHover';
150:export { createGridLayer } from './features/grid/layer';
151:export type { GridLayerOpts } from './features/grid/layer';
152:export { createCellHighlightLayer } from './features/grid/cellHighlight';
153:export type { CellHighlightLayerOpts } from './features/grid/cellHighlight';
```

These are the deep imports to remove.

- [ ] **Step 2.2: Verify the wildcard `export * from './features/grid'` is in place**

Run: `grep -n "export \* from './features/grid'" src/index.ts`
Expected: line 54 shows `export * from './features/grid';`. (If not, this task assumes it's there per the current state.)

- [ ] **Step 2.3: Delete the deep-import lines**

Open `src/index.ts` and delete the seven lines identified in step 2.1:
- The `useGridCellHover` value + type re-exports (around lines 67–71).
- The `createGridLayer` value + type re-exports (around lines 150–151).
- The `createCellHighlightLayer` value + type re-exports (around lines 152–153).

The kit's grid surface is now exposed exclusively via `export * from './features/grid'`. The wildcard re-exports the same names; consumers see no change.

- [ ] **Step 2.4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean. If consumers (or kit-internal files) imported these names from `@orochi235/weasel`, the names are still exported via the wildcard, so this should be a pure re-routing with no observable change.

- [ ] **Step 2.5: Run the full test suite as a regression check**

Run: `npx vitest run`
Expected: PASS — all tests green; the import-route change should be invisible to tests.

- [ ] **Step 2.6: Verify the kit builds**

Run: `npx tsup` (or `npm run build`)
Expected: clean build; `dist/index.js` and `dist/index.d.ts` regenerated. The d.ts should still expose `useGridCellHover`, `createGridLayer`, `createCellHighlightLayer`, etc., on the package surface.

Sanity-check by `grep`:
```bash
grep -E "useGridCellHover|createGridLayer|createCellHighlightLayer|roundToCell" dist/index.d.ts | head -10
```
Expected: each of those names appears in `dist/index.d.ts`. (Names may appear under re-export form, e.g., `export { useGridCellHover, ... }`.)

- [ ] **Step 2.7: Commit**

```bash
git add src/index.ts
git commit -m "refactor(barrel): route grid surface through feature barrel only"
```

---

## Task 3: Verify focus barrel discipline

**Files:**
- Verify: `src/features/focus/index.ts`
- Verify: `src/index.ts` (focus imports)

Focus is already conformant per the spec — its barrel re-exports `useCanvasFocus` + types and `gateLayer` + types, and the kit's main barrel imports from `./features/focus`. This task confirms.

- [ ] **Step 3.1: Inspect the focus barrel**

Run: `cat src/features/focus/index.ts`
Expected: matches this exact content (or close to it):

```ts
export { useCanvasFocus } from './useCanvasFocus';
export type { UseCanvasFocusOptions, CanvasFocusReturn } from './useCanvasFocus';
export { gateLayer } from './gateLayer';
export type { GateLayerOptions } from './gateLayer';
```

If it matches: the barrel is correct. Move on.

If it differs (e.g., a primitive is missing or a deep export is exposed): note the deviation and fix. Specifically, check that EVERY exported symbol from `useCanvasFocus.ts` and `gateLayer.ts` flows through this barrel.

- [ ] **Step 3.2: Inspect the kit's main barrel for focus imports**

Run: `grep -n "from './features/focus" src/index.ts`
Expected: every match imports `from './features/focus'` (the barrel). No matches should import from `'./features/focus/useCanvasFocus'` or `'./features/focus/gateLayer'` directly.

If any deep imports exist: replace with imports from `'./features/focus'`.

- [ ] **Step 3.3: If any changes were made in 3.1 or 3.2, run typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run src/features/focus/`
Expected: clean and PASS.

- [ ] **Step 3.4: If changes were made, commit**

```bash
git add src/features/focus/index.ts src/index.ts
git commit -m "refactor(focus): tighten barrel discipline"
```

If no changes were needed (the verification just confirmed today's state), skip the commit.

---

## Task 4: Add the feature-authoring guide to `docs/taxonomy.md`

**Files:**
- Modify: `docs/taxonomy.md`

The spec's §A asks for a 5-point convention added to the taxonomy doc. The cleanest landing spot is a sub-section under the existing Feature entry (which already names the bundle-vs-protocol distinction). Place the guide after the bundle-vs-protocol paragraph and before the Primitive entry.

- [ ] **Step 4.1: Read the current Feature entry to identify the insertion point**

Run: `grep -n "### Feature\|### Primitive\|### Role taxonomy\|### Hook" docs/taxonomy.md`
Note the line numbers for `### Feature` and `### Primitive`. The new sub-section will live between them.

- [ ] **Step 4.2: Add the authoring-guide sub-section**

Open `docs/taxonomy.md`. After the Feature entry's closing paragraph (the one ending with "...how this affects the kit's internal partial order.") and before `### Primitive`, insert:

```markdown
**Feature-authoring guide.** When adding or restructuring a feature:

1. **Each feature is a directory under `src/features/<name>/`.** The directory bundles related primitives that share a domain.

2. **Each feature has an `index.ts` barrel.** The barrel re-exports the feature's public primitives — every hook, layer factory, exported type, or helper a consumer or another feature might import. Internal helpers stay un-exported (or are exported only through deeper paths if needed for internal cross-feature wiring).

3. **The kit's main barrel (`src/index.ts`) imports from feature barrels, not from feature-internal paths.** This is the load-bearing discipline — once enforced, internal restructures (renaming a file, splitting a primitive into two) don't ripple through the main barrel.

4. **The [Role taxonomy](#role-taxonomy) is a thinking tool, not a code shape.** When authoring a feature's primitives, sort them mentally: which are state surfaces (api), which contribute DOM attrs (attrs), which contribute render layers (layers). The categorization helps decide what belongs in the barrel and what stays internal. It does NOT manifest as TypeScript types or runtime structures — there's no `Api<S>` alias, no `<SceneCanvas features={[…]}>` prop, no `useFooFeature()` convenience hook by convention.

5. **Protocol-shaped features document their protocol surface explicitly.** Selection's `SelectionApi`, `AreaSelectAdapter`, and the `getSelection`/`setSelection` methods threaded into Move/Resize/Rotate adapters are the model. When a feature introduces a cross-cutting concept other code must honor, name the contracts in TypeScript interfaces and reference them in the feature's docs.
```

- [ ] **Step 4.3: Verify the doc still reads coherently**

Run: `head -200 docs/taxonomy.md | tail -80`
Expected: the new sub-section flows naturally between the bundle-vs-protocol paragraph and the Primitive entry.

- [ ] **Step 4.4: Commit**

```bash
git add docs/taxonomy.md
git commit -m "docs(taxonomy): feature-authoring guide under the Feature entry"
```

---

## Task 5: Update the `docs/TODO.md` "Feature-roles taxonomy" entry

**Files:**
- Modify: `docs/TODO.md`

The TODO entry currently calls the taxonomy "in design — informal." After this PR it's documented in the taxonomy doc; update the entry to reflect the shipped state.

- [ ] **Step 5.1: Locate the entry**

Run: `grep -n "Feature-roles taxonomy" docs/TODO.md`
Expected: a single match around line 147 (under the `## Plugin/bundling convention` section).

- [ ] **Step 5.2: Replace the heading and adjust framing**

Find this line in `docs/TODO.md`:
```markdown
### Feature-roles taxonomy (in design — informal)
```

Replace with:
```markdown
### Feature-roles taxonomy

**Documented 2026-05-09** in `docs/taxonomy.md` (Feature § + the feature-authoring guide). The convention is: each feature is a directory under `src/features/<name>/`; the `index.ts` re-exports public primitives; the kit's main barrel imports through feature barrels, not internal paths. The role taxonomy (api / attrs / layers) is a thinking tool, not a code shape.

Spec: `docs/superpowers/specs/2026-05-09-feature-roles-focus-grid-design.md`.
Plan: `docs/superpowers/plans/2026-05-09-feature-roles-focus-grid.md`.
```

(The existing risk-watch list under the entry — "Watch the layers collapse decision" with three numbered risks — should stay if it's there; the rewrite above replaces only the heading + introductory paragraph. Verify the bullet list of risks is preserved.)

- [ ] **Step 5.3: Commit**

```bash
git add docs/TODO.md
git commit -m "docs(todo): mark feature-roles taxonomy as documented + link spec/plan"
```

---

## Task 6: Final regression sweep

**Files:**
- (none — verification only)

- [ ] **Step 6.1: Run the publish gate**

Run: `npm run prepublishOnly`
Expected: clean — `tsc --noEmit && vitest run && tsup build` all green. The full test suite passes; the kit builds; types resolve.

If anything fails, the most likely cause is a deep import this plan didn't catch. Inspect the failing file's imports — if it imports a grid primitive from `./features/grid/<internal-file>`, change to `./features/grid`.

- [ ] **Step 6.2: Spot-check the dist surface**

Run:
```bash
grep -E "roundToCell|useGridCellHover|createGridLayer|createCellHighlightLayer|useCanvasFocus|gateLayer" dist/index.d.ts | head -20
```
Expected: each name appears in `dist/index.d.ts`. If any are missing, the barrel re-export chain has a hole.

- [ ] **Step 6.3: Manual demo smoke (optional but recommended)**

Run: `npm run dev` and open the demo runner. Click through a few demos that use grid (any that show the grid layer or cell-highlight) and a few that don't (any selection / resize demo). Verify nothing visually regresses.

This step is optional because the change is mechanical re-routing with no behavior change — but cheap to do and catches any rendering-side regression that tests miss.

- [ ] **Step 6.4: No commit needed for verification**

If everything's green, the work is done. The previous five tasks each committed; the regression sweep doesn't add a commit.

---
