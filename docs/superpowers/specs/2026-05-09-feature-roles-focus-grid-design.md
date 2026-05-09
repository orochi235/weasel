# Feature-Roles Taxonomy + Focus & Grid Migrations

**Status:** approved 2026-05-09 (informal back-and-forth in chat)
**Marker:** `@experimental` on the public surface introduced here

## Problem

Today's "features" in the kit are directories under `src/features/` that export primitives — hooks, layer factories, types, helpers. There's no consistent shape that says "a feature contributes these kinds of things." Consumers wire each part of a feature individually:

```ts
// Today — assembling focus by hand, every site:
const ref = useRef<HTMLCanvasElement>(null);
const { focused, focusProps, getFocused } = useCanvasFocus();
const baseSelection = createSelectionOverlayLayer({ ... });
const wrappedSelection = gateLayer({ layer: baseSelection, visible: getFocused });
return (
  <SceneCanvas ref={ref} {...focusProps}
    layers={{ selectionOverlay: wrappedSelection, ... }} />
);
```

Friction:

1. Every multi-part feature needs the same multi-part assembly at every consumer site.
2. No structural type tells a reader what a feature *does*. They have to read the imports.
3. Cross-feature composition (focus wraps the selection overlay) lives in the consumer's wiring, not in the type system.

The kit's TODO already names this — the "Plugin/bundling convention" entry notes that primitives are pluggable but "what's missing is a convention for bundling a feature's parts." The TODO defers extraction until ≥2 plugin-shaped features are in flight. With focus shipped (`694b4da`–`00e6675`) and grid ready to convert, we have the trigger.

## Goal

**Primary: dev-side packaging.** Establish a typed convention for how kit-internal feature modules are structured and how their parts compose. The aim is loose coupling, clear separation of concerns, and a shape that future plugin work can build on top of without re-architecting first.

**Secondary (and `@experimental`): consumer convenience.** Expose `useFocusFeature()` and `useGridFeature()` as feature-level entry points consumers *can* use if they want the bundled assembly. Consumers who prefer wiring primitives individually (`useCanvasFocus` + `gateLayer`, `useGridCellHover` + `createGridLayer` + …) keep doing so unchanged.

Concretely:

1. A documented dev-side convention (`api`/`Api`, `attrs`/`Attrs`, `layers`/`Layers`) covering how feature modules export and compose their parts.
2. `useFocusFeature()` and `useGridFeature()` as `@experimental` public hooks — the canonical assembly of each feature's primitives in the role shape. Convenience, not required.
3. `EMPTY_LAYER` constant in `core/layers/` so wrappers can rely on a non-null upstream layer.
4. A `<SceneCanvas features={[…]}>` prop (also `@experimental`) that spreads feature `attrs` and reduces feature `layers` contributions. This is the highest-level consumer convenience; if it sees no real-world use, it can be deprecated without touching the underlying convention.
5. One demo migrated to `useGridFeature` as proof that the dev-side shape composes cleanly into a real consumer.

The low-level primitives (`useCanvasFocus`, `gateLayer`, `useGridCellHover`, `createGridLayer`, `createCellHighlightLayer`, `roundToCell`) stay public and non-experimental. They're the durable surface; the feature-level hooks are the speculative bit.

## Non-goals

- **Capability registry / DAG / `provides`/`requires` resolution.** The "C" path from chat — typed indirect references between features — is deferred. TypeScript imports are the dependency graph for in-tree code.
- **Lifecycle / mixin hooks** (`onPointerDown`, `pre-/post-render`, etc.). The "B" path — chain-of-responsibility component-level behaviors — isn't in scope. Existing gesture behaviors (`MoveBehavior`, `ResizeBehavior`) cover that territory at the gesture level.
- **Module augmentation for typed string-id capability lookup.** Not relevant here; we're using direct typed function arguments.
- **`snapPreview` (or any new) system layer slot.** Cell-highlight stays grid-feature-internal. If a future second consumer (e.g., move-gesture snap previews, alignment-guide flashes) wants the same z-position, revisit then.
- **Migrating every demo.** One per feature; the rest stay on primitives until the convention is stable.
- **Promoting role-shape hooks to non-experimental.** The taxonomy is opt-in until 3+ features in this shape have stabilized.

## Architecture

### §A — Role taxonomy

Each `useFooFeature()` hook returns an object with any subset of three fields:

```ts
function useFooFeature(opts: ...): {
  api?: FooApi;          // typed surface for cross-feature consumption
  attrs?: FooAttrs;      // native DOM attrs/handlers for the canvas host
  layers?: FooLayers;    // slot-keyed render-layer contributions
};
```

**`api: FooApi`** — the typed live-state handle other features and consumer code consume. Live values, refs, getters, setters. Cross-feature deps are typed function arguments: `useBlurOnEscape(focus.api)`.

**`attrs: FooAttrs`** — DOM attributes/event handlers spread onto the canvas element via `<SceneCanvas {...feature.attrs}>`. Things the browser cares about: `tabIndex`, `onFocus`, `onPointerMove`, `aria-*`. Distinct from React props the SceneCanvas component itself defines.

**`layers: FooLayers`** — a slot-keyed map of `<T>(current: RenderLayer<T>) => RenderLayer<T>` contributions. Provider and wrapper roles deliberately collapsed: a "provider" returns a fresh layer ignoring `current`; a "wrapper" composes. SceneCanvas seeds each slot with `EMPTY_LAYER` and reduces all contributions in registration order.

Per-feature type names follow `Foo<Role>`: `FocusApi`, `FocusAttrs`, `FocusLayers`, `GridApi`, etc. No top-level type-alias `Api<S>` / `Attrs<P>` markers — the role lives in the field name and per-feature interface name.

### §B — `EMPTY_LAYER`

`core/layers/render.ts` (or a sibling file) gains:

```ts
export const EMPTY_LAYER: RenderLayer<unknown> = {
  id: 'empty',
  label: 'Empty',
  draw: () => [],
};
```

Or, if a generic factory reads cleaner, a function form:

```ts
export function emptyLayer<T>(): RenderLayer<T> { return EMPTY_LAYER as RenderLayer<T>; }
```

Either is fine; pick whichever the existing `core/layers/` patterns prefer at implementation time.

The constant exists so wrapper authors can rely on a non-null `current` argument. The "no upstream provider" case is a no-op layer, not a `null` to pattern-match against.

### §C — `useFocusFeature`

```ts
// src/features/focus/useFocusFeature.ts
import { useCanvasFocus } from './useCanvasFocus';
import { gateLayer } from './gateLayer';
import type { RenderLayer } from '../../core/layers/render';

export interface FocusApi {
  focused: boolean;
  getFocused: () => boolean;
  setFocused: (next: boolean) => void;
}

export interface FocusAttrs {
  tabIndex: number;
  onFocus: () => void;
  onBlur: () => void;
}

export interface FocusLayers {
  selectionOverlay: <T>(current: RenderLayer<T>) => RenderLayer<T>;
}

/**
 * @experimental
 * Focus feature in the role-taxonomy shape. Wraps `useCanvasFocus` +
 * `gateLayer` into a single hook a consumer can install with one call.
 *
 * The low-level primitives stay public and non-experimental.
 */
export function useFocusFeature(opts?: { initial?: boolean; tabIndex?: number }): {
  api: FocusApi;
  attrs: FocusAttrs;
  layers: FocusLayers;
} {
  const f = useCanvasFocus(opts);
  return {
    api: { focused: f.focused, getFocused: f.getFocused, setFocused: f.setFocused },
    attrs: f.focusProps,
    layers: {
      selectionOverlay: (current) => gateLayer({ layer: current, visible: f.getFocused }),
    },
  };
}
```

Re-exported from `src/features/focus/index.ts` and from the kit barrel `src/index.ts` (under the `@experimental` marker).

### §D — `useGridFeature`

```ts
// src/features/grid/useGridFeature.ts
import { useCallback, useRef, useState } from 'react';
import type React from 'react';
import { screenToWorld, type ViewTransform } from '../viewport/viewTransform';
import { pointToGridCell } from '../../interactions/gestures/shared/strategies/grid';
import type { UnitSystem, UnitValue } from '../../core/units';
import type { RenderLayer } from '../../core/layers/render';
import type { Paint, Stroke } from '../../core/paint-types';
import { createGridLayer } from './layer';
import { createCellHighlightLayer } from './cellHighlight';

export interface GridApi {
  cell: { col: number; row: number } | null;
  getCell: () => { col: number; row: number } | null;
}

export interface GridAttrs {
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void;
}

export interface GridLayers {
  /** Grid lines layer in the well-known `grid` system slot. */
  grid: <T>(current: RenderLayer<T>) => RenderLayer<T>;
  /** Cell-hover highlight in a grid-feature-internal slot. NOT a system slot;
   *  consumers who want this slot's z-position pinned should consume it
   *  through this feature. */
  highlight: <T>(current: RenderLayer<T>) => RenderLayer<T>;
}

/** @experimental */
export function useGridFeature(opts: UseGridFeatureOptions): {
  api: GridApi;
  attrs: GridAttrs;
  layers: GridLayers;
};
```

Implementation: roughly what `src/features/grid/useGridFeature.ts` already contains in the uncommitted draft, refined to use `EMPTY_LAYER`-aware signatures (`current: RenderLayer<T>`, never `null`) and re-exported via `src/features/grid/index.ts` + the kit barrel.

The grid feature's `highlight` slot is *not* a `LayersMap` system slot. It lives under whatever custom string key the consumer plugs it into:

```tsx
layers={{
  grid: grid.layers.grid(EMPTY_LAYER),
  // 'gridHighlight' is just a custom key; nothing kit-level depends on it
  gridHighlight: grid.layers.highlight(EMPTY_LAYER),
}}
```

### §E — `<SceneCanvas features={[…]}>`

`SceneCanvas` accepts an `@experimental` `features` prop:

```ts
features?: ReadonlyArray<{
  api?: unknown;
  attrs?: Record<string, unknown>;
  layers?: Record<string, <T>(current: RenderLayer<T>) => RenderLayer<T>>;
}>;
```

When present, SceneCanvas:

1. Spreads each feature's `attrs` onto the underlying `<canvas>` element. Conflicting keys: later features win (documented).
2. Reduces each feature's `layers[slot]` per slot, seeded with `EMPTY_LAYER`. The reduce runs in `features` array order. The result is merged into the explicit `layers={{...}}` prop: explicit `layers[slot]` wins over the reduce when both are set.
3. Does *not* touch `feature.api` — that's for consumer code and other features to consume directly via direct typed reference.

Manual composition still works:

```tsx
const focus = useFocusFeature();
const selection = useSelectionFeature();
return (
  <SceneCanvas
    {...focus.attrs}
    layers={{
      selectionOverlay: focus.layers.selectionOverlay(
        selection.layers.selectionOverlay(EMPTY_LAYER)
      ),
    }}
  />
);
```

Both paths are supported. `features={[…]}` is the high-level convenience; manual composition is the escape hatch.

### §F — Demo migrations

One demo per feature. Pick the simplest current consumer of each feature's primitives:

- **Focus demo:** none of the existing demos directly wire focus today (focus shipped without a demo entry). Either add a tiny new demo (`FocusDemo.tsx`) or leave the new feature undemonstrated. Lean: skip the demo for focus this cycle; the SelectionContext / SceneCanvas existing demos that *would* benefit from focus stay on primitives until focus has a real consumer.
- **Grid demo:** one of the demos already uses `createGridLayer`/`createCellHighlightLayer`/`useGridCellHover`. Find one and migrate it to `useGridFeature`. Smoke-test that the migrated demo behaves identically.

The migration's value is showing the convention; we don't need exhaustive demo coverage to validate it.

## Risk surface

Three risks worth surfacing — all flagged in the existing `docs/TODO.md` "Feature-roles taxonomy" entry, restated here for completeness:

### R1 — Consumer-facing pieces may be unneeded

The `<SceneCanvas features={[…]}>` prop and the `useFooFeature()` hooks themselves may not see real consumer use. Today's wiring (manual composition of primitives) is already explicit and typed; the feature-level convenience only pays off if consumers stack 3+ features routinely.

The dev-side organizing value is independent of consumer adoption — keeping kit features loosely coupled and shaped consistently is worth doing whether or not anyone imports `useFocusFeature` directly. The risk is specifically that we built more public surface than needed.

**Mitigation:** the `@experimental` marker on `useFocusFeature`, `useGridFeature`, and the `features` prop signals "may evolve or be dropped." If after 6+ months they have zero or one user, deprecate and eventually remove them; the underlying primitives stay public and the dev-side convention stays intact internally.

### R2 — Layers-collapse risks (already documented in TODO)

1. Wrapper-vs-provider intent invisible at the type level.
2. Order becomes load-bearing without enforcement.
3. A wrapper accidentally replaces (return-fresh-from-wrapper-shape).

Rollback path: split `layers` into `layers: FooLayers` (provider, plain `RenderLayer<T>`) + `wrappers: FooWrappers` (slot-keyed transformer functions). Field names `api` and `attrs` stay.

### R3 — Lock-in on the field names

Once `api`, `attrs`, `layers` are public (even `@experimental`), changing them is a breaking change for opted-in consumers.

**Mitigation:** the `@experimental` marker is the kit's standard signal that the shape may evolve. Any rename happens in a single PR with a CHANGELOG note; consumers who opted in update their `useFooFeature` call sites.

## Sequencing

Single PR. Build order within the PR:

1. **`EMPTY_LAYER`.** Add to `core/layers/render.ts` (or wherever `RenderLayer` lives). Tests verify `draw()` returns `[]`.
2. **`useFocusFeature`.** Implement; export from `src/features/focus/index.ts` + kit barrel under `@experimental`. Tests: hook returns the right shape; `layers.selectionOverlay(EMPTY_LAYER)` returns a layer that emits empty when blurred and the overlay's commands when focused.
3. **`useGridFeature`.** Implement; export. Tests: hook returns the right shape; `layers.grid(EMPTY_LAYER)` returns a working grid layer; `layers.highlight(EMPTY_LAYER)` returns a working highlight layer; pointer attrs update `api.cell` correctly.
4. **`<SceneCanvas features={[…]}>` prop.** Add the prop, wire the reduce + attr-spread + layer-merge logic. Tests: providing focus + grid features installs both; explicit `layers` prop overrides reduced values.
5. **Demo migration.** One demo migrated to `useGridFeature`. Manual smoke-test parity vs. the pre-migration version.
6. **TODO refresh.** Update `docs/TODO.md` "Feature-roles taxonomy (in design — informal)" entry to reflect what shipped: drop "in design" from the heading, link to this spec, restate the watch list under "monitoring."
7. **Final regression sweep.** `npm run prepublishOnly`. Manual demo smoke for the migrated demo and a sample of unrelated demos.

## Open implementation questions

(Surfaced during chat; resolved at implementation time, not gating spec approval.)

- **Composition order of `features={[…]}` array vs. explicit `layers={{...}}`.** The spec says "explicit wins"; the implementation needs to confirm that the merge order is deterministic and documented.
- **Type for `features` prop.** Current sketch uses `unknown` for `api` (since SceneCanvas doesn't inspect it). May need refinement; if SceneCanvas wants to expose feature `api`s back to the consumer (via context, refs, etc.), the type tightens.
- **`EMPTY_LAYER` shape: constant vs. factory.** Pick during implementation based on existing `core/layers/` patterns.
- **`useFocusFeature` initial-state default.** `useCanvasFocus` defaults to `initial: false`. The feature wrapper inherits that. Confirm the demo behavior matches at smoke time.
