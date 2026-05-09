# Feature-Roles Taxonomy + Focus/Grid Barrel Hygiene

**Status:** revised 2026-05-09 (in-chat reframing — features are dev-side packaging, not consumer-facing assembly)

## Problem

The kit's `src/features/<name>/` directories bundle related primitives, but the bundling discipline is uneven:

- **Inconsistent barrels.** `src/features/grid/index.ts` exports just `roundToCell`; the rest of the grid feature's primitives (`useGridCellHover`, `createGridLayer`, `createCellHighlightLayer`) skip the barrel and are imported by the kit's main barrel directly from internal files. `src/features/focus/index.ts` is well-formed; the contrast is what makes the inconsistency visible.

- **No documented dev-side convention.** Authors of new features (or refactors of existing ones) have no shared answer to "what shape should a feature's exports take?" or "what counts as a primitive vs. an internal detail?" The role categories (api / attrs / layers — see `docs/taxonomy.md`) name the parts, but there's no spec that says "this is how features are organized."

- **No documented protocol-vs-bundle distinction.** Selection's protocol surface (`SelectionApi`, `AreaSelectAdapter`, the methods threaded into Move/Resize/Rotate adapters) is load-bearing across the kit; focus's reach is local. The taxonomy doc names the distinction; no spec has used it as a planning input.

The katamari risk: without the convention named, related code drifts into tangled multi-feature flows. The fix is dev-side discipline — not new public API.

## Goal

**Dev-side only.** Establish and apply a convention for how feature modules organize their internals; do not introduce new consumer-facing abstractions.

Concretely:

1. **Document the convention.** `docs/taxonomy.md` already covers the role taxonomy (api/attrs/layers as a thinking tool) and the bundle-vs-protocol distinction. This spec adds a short authoring guide referencing the taxonomy: how to structure a `src/features/<name>/` directory, what belongs in the barrel, what stays internal.

2. **Apply the convention to focus and grid.** Focus is already mostly conformant; verify and tighten. Grid needs barrel cleanup — the index re-exports just `roundToCell`; the rest of the primitives (`useGridCellHover`, `createGridLayer`, `createCellHighlightLayer`) need to flow through the barrel too.

3. **Update the kit's main barrel.** `src/index.ts` should import from feature barrels (`./features/grid`, `./features/focus`), not from feature-internal paths. This is the load-bearing discipline — once it's enforced, internal moves don't ripple through the main barrel.

That's it. No new consumer-facing types, no `useFocusFeature` / `useGridFeature` hooks, no `<SceneCanvas features={[…]}>` prop, no `EMPTY_LAYER` constant. Those were all consumer-side conveniences in the previous version of this spec; per the dev-side framing they're out of scope.

## Non-goals

- **`useFocusFeature()` / `useGridFeature()` public hooks.** Consumers compose the existing primitives. The role taxonomy is a *thinking tool* for kit authors; consumers don't see it as types or runtime structures.
- **`<SceneCanvas features={[…]}>` prop.** Consumer-facing composition slot. Out of scope.
- **`EMPTY_LAYER` constant.** Pays off only if features ship layer-wrapping functions to consumers — i.e., if the consumer-facing role taxonomy were public. It's not. Skip.
- **Capability registry / lifecycle behaviors / mixins.** The taxonomy doc names these as deferred concepts; this spec doesn't move on any of them.
- **Migrating the other six features (selection, groups, paths, text, drag, viewport, patterns).** Focus + grid is the proof. If the discipline holds, extend feature-by-feature in subsequent passes. A blanket sweep risks more churn than insight.
- **Selection's barrel.** Selection is protocol-shaped (per `docs/taxonomy.md` Feature §); its barrel + protocol surface deserve their own design pass. Out of scope here.

## Architecture

### §A — The dev-side convention (added to the docs)

The taxonomy doc already covers the substance. This spec contributes a short authoring guide — likely 30-60 lines added either to `docs/taxonomy.md` (under Feature) or to a new `docs/extending.md`. Pick during implementation; the simplest landing spot is `docs/taxonomy.md` since it's already the reference text.

The guide states:

1. **Each feature is a directory under `src/features/<name>/`.** The directory bundles related primitives that share a domain.

2. **Each feature has an `index.ts` barrel.** The barrel re-exports the feature's *public primitives* — the things a consumer or another feature might import. Internal helpers stay un-exported (or exported only through deeper paths if required for testing).

3. **The kit's main barrel (`src/index.ts`) imports from feature barrels, not from feature-internal paths.** This is the discipline that prevents internal restructures from rippling out.

4. **The role taxonomy (api/attrs/layers — `docs/taxonomy.md` §Role taxonomy) is a thinking tool, not a code shape.** When authoring a feature's primitives, sort them mentally: which ones are state surfaces (api), which contribute DOM attrs (attrs), which contribute render layers (layers). The categorization helps decide what belongs in the barrel and what stays internal. It does NOT manifest as TypeScript types or runtime structures.

5. **For protocol-shaped features** (per `docs/taxonomy.md` Feature §): document the protocol surface explicitly. Selection's `SelectionApi` and `AreaSelectAdapter` are the model. Other features that introduce cross-cutting concepts must do the same — name the contracts other code has to satisfy, in TypeScript interfaces.

### §B — Focus barrel verification

`src/features/focus/index.ts` currently exports:

```ts
export { useCanvasFocus } from './useCanvasFocus';
export type { UseCanvasFocusOptions, CanvasFocusReturn } from './useCanvasFocus';
export { gateLayer } from './gateLayer';
export type { GateLayerOptions } from './gateLayer';
```

That's already in good shape: every public primitive flows through the barrel. The kit's main barrel `src/index.ts` should import these from `./features/focus`, not from internal paths. Verify during implementation; if the main barrel currently imports from `./features/focus/useCanvasFocus` directly, change to `./features/focus`.

### §C — Grid barrel cleanup

Today: `src/features/grid/index.ts` only exports `roundToCell`. The kit's main barrel imports the rest of the grid feature's primitives directly from internal paths.

Target shape:

```ts
// src/features/grid/index.ts
export { roundToCell } from './roundToCell'; // if it ends up moved out of index
export { useGridCellHover } from './useGridCellHover';
export type { UseGridCellHoverOptions, UseGridCellHoverReturn } from './useGridCellHover';
export { createGridLayer } from './layer';
export type { GridLayerOpts } from './layer';
export { createCellHighlightLayer } from './cellHighlight';
export type { CellHighlightLayerOpts } from './cellHighlight';
```

(Exact layout — whether `roundToCell` stays inline in `index.ts` or moves to its own file — to be decided during implementation. Either is fine.)

The kit's main barrel `src/index.ts` then imports grid's primitives from `./features/grid`, not from `./features/grid/useGridCellHover` etc.

### §D — Documentation: protocol-shape note in `docs/taxonomy.md`

The existing taxonomy doc already includes the bundle-vs-protocol distinction in the Feature entry. This spec doesn't add to it — but the focus+grid migrations are concrete bundle-shaped examples worth name-checking in the taxonomy or in a follow-up doc when more features land in this shape.

If during implementation the authoring guide grows beyond 60-80 lines, split it into `docs/extending.md` and link from `docs/taxonomy.md`. Don't pre-decide; let the doc length drive the placement.

## Risk surface

Three risks, none gating:

### R1 — Convention may not survive contact with selection

Selection is protocol-shaped; the convention here was crystallized against bundle-shaped features (focus, grid). When selection's eventual migration happens, it may surface convention misfits — e.g., the api/attrs/layers thinking tool may not naturally describe "selection's protocol surface". 

**Mitigation:** the taxonomy doc already names the bundle-vs-protocol distinction; the migration of selection isn't in scope here. When it happens, expect a separate spec that extends or revises the convention.

### R2 — Barrel-only refactor is a breaking change for consumers using deep imports

If any consumer currently imports from `'@orochi235/weasel/internal/...'` (or via TypeScript's path mapping into a feature-internal file), the barrel cleanup that re-routes the main barrel doesn't break them — but cleaning up *ad-hoc* internal imports as part of this work might.

**Mitigation:** the change in scope is the kit's main barrel and the feature barrels. Consumer-side import paths under `@orochi235/weasel` aren't widened or narrowed. If a deep-import consumer exists in eric or another consumer app, run the consumer's build after the change as a smoke check.

### R3 — Doc bloat without action

A "convention doc" that no future feature actually follows is dead weight. The convention only pays off if it shapes future work.

**Mitigation:** the doc is short (30-60 lines) and references concrete examples (focus, grid). Re-evaluate after the third feature migration: if the doc doesn't naturally inform decisions, prune it.

## Sequencing

Single PR. Build order:

1. **Taxonomy doc — authoring guide section.** Add the 5-point convention (per §A) to `docs/taxonomy.md` under the Feature entry, OR carve out `docs/extending.md` and link both directions. Single doc commit.

2. **Focus barrel verification.** Confirm `src/features/focus/index.ts` re-exports the primitives. Confirm `src/index.ts` imports from `./features/focus`. Fix any deep imports. No code-behavior changes; tests untouched. Commit.

3. **Grid barrel cleanup.** Update `src/features/grid/index.ts` to re-export all primitives. Update `src/index.ts` to import from `./features/grid`. Verify tsc and tests stay green. Commit.

4. **Final regression sweep.** `npm run prepublishOnly`. Demos still load.

No new code paths to test. The work is mechanical re-routing + a doc addition. Tests remain a regression contract; if anything was wired through a deep import path that I haven't caught, the tsc step exposes it.

## Open implementation questions

(Surfaced for resolution at implementation time, not gating spec approval.)

- **`docs/taxonomy.md` vs. `docs/extending.md`.** The 5-point authoring guide is short enough to fit inside the taxonomy doc's Feature entry as a sub-section. Alternative: a fresh `docs/extending.md` for kit-author-facing how-to. Pick during implementation based on doc length.

- **`roundToCell` placement.** Currently inline in `src/features/grid/index.ts` (a 4-line function). Three options: leave it; move to `src/features/grid/roundToCell.ts` and re-export; promote to a kit utility outside features. The cleanest dev-side choice: move to its own file (consistent with the rest of the grid primitives), barrel re-exports it. Verify the call sites that import `roundToCell` still resolve.

- **Feature-internal symbols that are tested but not exported.** `src/features/grid/grid.test.ts` (606 bytes — minimal) exists alongside `useGridCellHover.test.ts` etc. Confirm all tests still resolve their imports after the barrel cleanup.

- **`docs/TODO.md` "Feature-roles taxonomy" entry update.** The entry currently calls the taxonomy "in design — informal." After this PR, that's no longer true (the convention is documented). Update the TODO entry to "shipped" with a link to the taxonomy section and this spec.
