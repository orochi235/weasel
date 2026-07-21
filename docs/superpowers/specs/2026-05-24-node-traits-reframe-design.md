# Node-traits reframe — design

Date: 2026-05-24
Status: design, ready to implement.
Supersedes: `docs/superpowers/specs/2026-05-22-node-facets-reframe-design.md`

## Goal

Reframe the kit's kind-keyed registries as **node traits**: independent
axes of information about a node, each with its own per-axis registry.
"Shape" is one trait whose values are the 9 shape kinds. "Routing"
(today's `NodeKindRegistry`) is another. Future cross-cutting concerns
(`label`, `icon`, `propertyRows`, `affordances`, `bindings`,
`serialize`) land as additional trait registries, not as optional
fields on a single `NodeKind` type.

This spec also commits to a naming convention: registries are named
`Node<Trait>` (e.g. `NodeShape`, `NodeRouting`, `NodeLabel`), dropping
the redundant `Trait` / `Registry` suffix in type names where context
makes the role clear.

## Motivation

This spec replaces the May-22 facets reframe with three concrete
changes:

1. **Vocabulary: "trait" instead of "facet."** Trait is the standard
   industry word for "behavior axis keyed by type-name" (Rust traits,
   Scala traits, Haskell typeclasses, Swift protocols). Reading
   `NodeShape` as "the shape trait of a node" matches the
   typeclass-impl mental model precisely: the kind name is the type,
   the trait is the contract, the registry is the impl table. Facet
   was neutral but unfamiliar; trait is recognizable.

2. **Suffix-light naming.** `NodeShape` not `NodeShapeRegistry` /
   `NodeShapeTrait`. The role is clear from context (it's a kit
   subsystem keyed by kind name); the suffix is redundant. Keep
   suffixes only where a genuine name collision forces it.

3. **Rename `NodeKindRegistry` → `NodeRouting`.** The May-22 spec
   argued for keeping the old name on back-compat grounds because
   nothing was waiting on a rename. The next consumer (the
   affordances trait, which chrome-caps will consume) makes the new
   naming load-bearing — having `NodeRouting` and `NodeAffordances`
   side-by-side, but `NodeKindRegistry` for the third, is the kind
   of asymmetry that calcifies.

The rest of the May-22 reframe (per-axis registries, no mega-registry,
hierarchical inspector taxonomy) carries forward unchanged.

## Non-goals

1. **No runtime semantics change.** Painter dispatch, routing
   classification, and dispatcher reads all behave identically.
2. **No painter-routing unification.** Shape and routing remain
   independent traits; consumers may but need not co-register.
3. **No new traits shipped in this spec.** `NodeAffordances`,
   `NodeLabel`, `NodeIcon`, etc. each get their own spec when their
   consumer is ready. This spec only reshapes shape + routing under
   the new framing and renames the routing registry.
4. **No mega-registry-of-registries.** Traits are a vocabulary for
   talking about per-axis tables; each table stays what it is.
5. **No per-node trait values.** Traits are per-kind-name. Per-node
   storage is a different design (closer to ECS) and out of scope.

## Proposal

### Conceptual model

A node has *traits*. A trait is an axis of information keyed by
node-kind name. Each trait owns its own registry — a `Map<kindName,
TraitValue>` plus a lookup API.

The two traits that exist today:

- **Shape trait.** Value type: the current `ShapePainter` shape
  (`paint`, `silhouette`, ...). Backed by `shapePainters` today;
  **renamed to `NodeShape` in this spec**. The old `shapePainters`
  name understated the entry's contents (it carries silhouette and
  will carry more) and broke the per-trait naming convention.
- **Routing trait.** Value type: `{ matches: (data) => boolean }`.
  Backed by `NodeKindRegistry` today; **renamed to `NodeRouting` in
  this spec**.

### Naming convention

Trait registries are named `Node<TraitName>`:

- `NodeShape` — shape trait (paint + silhouette).
- `NodeRouting` — routing trait (data → routing-kind string).
- `NodeLabel` — future, layer-panel display strings per kind.
- `NodeIcon` — future, palette/layer icons per kind.
- `NodeAffordances` — future, list of affordances per kind. Consumer:
  chrome-caps.
- `NodePropertyRows` — landed 2026-07 as `NodeProperties`
  (schema-valued; see `2026-07-20-selection-panel-design.md`).
- `NodeBindings` — future, per-kind routing-table fragments.
- `NodeSerializer` — future, op-log serialization per kind.

**Drop the `Registry` / `Trait` suffix.** Context makes the role
clear: a top-level export named `NodeShape` in a kit module is
unambiguously the shape trait's registry, not (e.g.) a data type for
shape geometry. If a real collision arises (e.g. `NodeLabel` might
clash with a layer-panel component), the fallback is `NodeLabelTrait`
or `NodeLabelRegistry` — decide per-case, not pre-emptively.

No exceptions. `shapePainters` gets renamed to `NodeShape` in this
spec (the existing name predated the convention and understated the
entry contents). All current and future traits follow the convention.

### Type-level renames in this spec

| Old | New | Notes |
|---|---|---|
| `shapePainters` | `NodeShape` | Shape trait registry. |
| `ShapePainter` (entry type) | `NodeShapeEntry` | Per-kind shape entry (paint + silhouette + future fields). |
| `NodeKindRegistry` (type) | `NodeRouting` (type) | Routing trait. |
| `NodeKind` (entry type) | `NodeRoutingEntry` | Per-kind entry in the routing registry. |
| `defaultNodeKinds` | `defaultNodeRouting` | Default routing entries. |
| `inferredNodeKinds` (re-export) | `inferredNodeRouting` | Inferred-from-shapes routing. |
| `kinds` prop on `<SceneCanvas>` | `routing` prop on `<SceneCanvas>` | Honest about which trait it populates. |

The `kinds` prop rename is the most consumer-visible change. It only
just shipped (2026-05-21) and has zero external consumers (per the
May-22 spec's "consumer pressure is not a factor" framing); the rename
is cheap. Old name removed in the same pass.

### Inspector UI

`apps/draw/src/dev/RegistryInspector.tsx`:

- Top-level tree category `'nodeKinds'` → `'routing'` (matches the
  trait name).
- `'shapeKinds'` stays as `'shape'` (matches the trait name).
- Group both under a synthetic parent category `'traits'` in the
  tree, so adding `'label'`, `'icon'`, etc. as future traits has an
  obvious home.
- Detail pane carries a `trait` field (`'shape'` or `'routing'`).

`apps/draw/src/dev/registryData.ts`:

- `collectShapeKinds()` → `collectShapeTrait()`; entries tagged
  `trait: 'shape'`.
- `collectNodeKinds()` → `collectRoutingTrait()`; entries tagged
  `trait: 'routing'`.

### JSDoc reframe

Every renamed type carries a JSDoc paragraph framing it as a trait
and pointing at this spec. Example:

```ts
/**
 * NodeRouting — the **routing trait's** registry. Each trait of a
 * node (shape, routing, label, icon, affordances, …) is its own
 * registry; this one answers "what routing-kind string does this
 * node's data map to?"
 *
 * See `docs/superpowers/specs/2026-05-24-node-traits-reframe-design.md`
 * for the trait taxonomy.
 */
```

### Convergence policy for future traits

Each future trait spec must declare:

1. **Trait name** (`shape`, `routing`, `label`, `icon`,
   `affordances`, ...).
2. **Registry name** (`Node<TraitName>`, suffix-light unless
   collision).
3. **Registry shape** — what value type the trait stores per kind
   name.
4. **Consumer** — which kit subsystem reads the registry.
5. **Wiring** — how the registry is populated (consumer prop on
   `<SceneCanvas>`, plugin, module-level, etc.).
6. **Inspector surface** — how the inspector exposes the trait.

Speculative traits with no near-term consumer don't ship.

## Migration

### Spec-level

1. Append a supersession note to the May-22 facets spec pointing
   here.
2. Append a supersession note to the May-21 node-kind-registry spec
   for the rename (its other contents stay accurate).
3. Update `docs/TODO.md`:
   - The "Convergence-target facets" P3 entry → reference this spec
     and switch vocabulary to "traits."
   - Any other facet references in TODO.md → trait.

### Code-level

Phase 1 — routing trait rename:

1. Rename `NodeKindRegistry` type → `NodeRouting`. Rename `NodeKind`
   entry type → `NodeRoutingEntry`. Rename `defaultNodeKinds` →
   `defaultNodeRouting`. Rename `inferredNodeKinds` re-export →
   `inferredNodeRouting`.
2. Update barrel exports in `src/index.ts`.
3. Rename `kinds` prop on `<SceneCanvas>` → `routing`. Update prop
   types, internal threading, and all in-tree consumers
   (demos/apps/tests).
4. JSDoc reframe on `NodeRouting` and surrounding types.

Phase 2 — shape trait rename:

5. Rename `shapePainters` → `NodeShape`. Rename `ShapePainter` entry
   type → `NodeShapeEntry`. Update all imports across kit, demos,
   apps, tests. JSDoc reframe.

Phase 3 — inspector:

6. Rename inspector tree categories: `'nodeKinds'` → `'routing'`,
   `'shapeKinds'` → `'shape'`. Add parent category `'traits'`.
7. Rename `collectNodeKinds` → `collectRoutingTrait`,
   `collectShapeKinds` → `collectShapeTrait`. Tag entries with
   `trait: 'shape' | 'routing'`.
8. Detail-pane: surface the `trait` field; keep existing `source`
   semantics on routing entries.

### Test-level

- Existing `defaultNodeRouting` / `KIT_SHAPE_KINDS` parity test stays
  (renamed accordingly).
- Inspector test: assert `'traits'` parent contains both `'shape'`
  and `'routing'` children, detail-pane carries `trait` field.
- Demos/apps still compile and behave identically after the `kinds`
  → `routing` rename.

### Verification

`tsc --noEmit && vitest run && tsup build` per the repo's
prepublish-style gate. The rename is mechanical; failures should be
import paths, not logic.

## Open questions resolved

1. **Trait vs facet vs aspect.** Trait — recognizable from
   Rust/Scala/Swift, matches the typeclass-impl mental model.
2. **Suffix on type names?** Drop it where unambiguous; keep on
   genuine collisions.
3. **Rename `NodeKindRegistry` now or defer?** Now. The next consumer
   (`NodeAffordances` for chrome-caps) makes the asymmetry painful.
4. **Rename `shapePainters`?** Yes — to `NodeShape`. The old name
   predates the convention and understates the entry contents (it
   carries silhouette today and will carry more). Worth the import
   churn to keep the trait taxonomy consistent.
5. **Mega-registry?** No (carried from May-22).
6. **Per-node trait values?** No (carried from May-22).

## Future work

Each May-21 convergence-policy trait gets its own spec when a
consumer wants it. Likely first to land:

- **`NodeAffordances`** — list of affordances per kind. Consumer:
  chrome-caps (the declarative overlay-chrome visibility system).
  Replaces today's globally-added `cornerResize` + `rotationHandle`
  affordances with per-kind contributions, so `line` contributes
  endpoint handles instead of corners, `text` contributes no rotation
  handle, etc.
- **`NodeLabel` / `NodeIcon`** — layer panel and command palette
  display.
- **`NodePropertyRows`** — `<PropertiesPanel>` contributions per
  kind. *Landed as `NodeProperties` (schema-valued, not row
  contributors): see
  `2026-07-20-selection-panel-design.md`.*

Each justifies its consumer; speculatively-declared traits don't
ship.
