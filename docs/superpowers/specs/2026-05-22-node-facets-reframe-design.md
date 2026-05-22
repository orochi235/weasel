# Node-facets reframe — design

Date: 2026-05-22
Status: design, awaiting plan.

## Goal

Reframe the kit's kind-keyed registries (shape painters + the recently
shipped `NodeKindRegistry`) as **node facets**: independent axes of
information about a node, each with its own per-axis registry. "Shape"
becomes one facet whose values are the 9 shape kinds. "Routing kind"
(today's `NodeKindRegistry`) is another. Future cross-cutting concerns
(`label`, `icon`, `propertyRows`, `bindings`, `serialize`) land as
additional facets, not as optional fields on `NodeKind`.

The reframe is primarily conceptual + nomenclature. The runtime
machinery (registries, dispatcher reads, painter lookups) stays
intact. The change makes the architecture honest about what's actually
there: multiple per-axis tables, not "one kind-table that grows extra
fields."

## Motivation

### What the May-21 design captured

`docs/superpowers/specs/2026-05-21-node-kind-registry-design.md` shipped
a kit-owned `NodeKindRegistry` that classifies a node's `data` into a
routing string for the dispatcher. Its convergence policy reserved
optional fields on `NodeKind` for future facets:

| Future facet | Read by |
|---|---|
| `label` / `pluralLabel` / `icon` | layer panel, command palette, debug overlay |
| `propertyRows` | `<PropertiesPanel>` |
| `bindings` | `useSelectTool` |
| `subkinds` | dispatcher |
| `serialize` / `deserialize` | `useScene` op log |

That policy works, but it overloads "kind" to mean five different
things. A reader of `NodeKind { name, matches, label?, icon?,
propertyRows?, bindings?, serialize? }` cannot tell whether "kind"
means classification, presentation, or behavior — it means all of
them. Each future facet would awkwardly tag a `name: 'rect'` onto an
entry that's no longer classifying, just attaching a kind-keyed
property.

### What the inspector exposed

The 2026-05-22 Bundle Inspector landing added a "Node kinds" tree
category alongside the existing "Shape kinds" category. They list
identical names by default (`defaultNodeKinds` mirrors
`KIT_SHAPE_KINDS`). A user looking at the inspector cannot tell from
the tree which axis they're browsing — the detail pane carries the
distinction. The two categories aren't sibling kinds; they're
**different facets of the same kind name**.

The honest taxonomy is hierarchical:

```
Facets/
  ├─ Shape          (rect, ellipse, polygon, …)      paint + silhouette
  ├─ Routing        (rect, ellipse, group, sticky)   dispatcher target.kind
  ├─ Label          (display strings per kind)        layer panel
  ├─ Icon           (icons per kind)                  layer panel, palette
  ├─ PropertyRows   (per-kind property contributors)  <PropertiesPanel>
  └─ …
```

Each facet has its own registry. A node may carry values in some
facets and not others (a `group` node has a routing facet but no
shape facet; a `'rect'`-painted node has both).

### Why now

1. **The 2026-05-21 registry hasn't been consumed by any external
   app.** Renaming or reshaping it is cheap; consumer-pressure isn't a
   factor.
2. **The convergence-policy decision is fresh.** Choosing facets-as-
   first-class-registries instead of optional-fields-on-NodeKind
   redirects the next 5 follow-up specs (label/icon, propertyRows,
   bindings, subkinds, serialize) cleanly. Each becomes "add a new
   facet registry," not "add a field to NodeKind."
3. **The inspector UI just shipped a category-level taxonomy** that
   begs for a parent grouping. Adding a "Facets" parent in the tree
   is a small follow-up; doing it before adding label/icon facets
   avoids two layout migrations.

## Non-goals

1. **No runtime semantics change.** The painter registry still
   dispatches by `matches(node)`. The routing registry still
   classifies `data → string` for the dispatcher. The dispatcher
   still reads `adapter.kindOf` (until that's removed in the
   already-filed P3 follow-up).
2. **No painter-routing unification.** The 2026-05-21 spec's
   non-goal #1 stands: shape facet and routing facet are independent
   registries; consumers may but need not co-register. The reframe
   names the relationship without merging it.
3. **No build-time codegen.** Facet definitions live in plain TS
   modules; consumers attach values per-facet at boot.
4. **No new facets shipped in this spec.** The 5 future facets in
   the May-21 convergence table each get their own spec (or stay
   deferred). This spec only reshapes the existing two (shape +
   routing) under the facets framing.

## Proposal

### Conceptual model

A node has *facets*. A facet is an axis of information keyed by
node-kind name. Each facet owns its own registry — a `Map<kindName,
FacetValue>` plus a lookup API.

The two facets that exist today:

- **Shape facet.** Value type: `{ paint, silhouette, ... }` (the
  current `ShapePainter` shape, after the 2026-05-14 silhouette spec
  promotes it from "painter" to "shape-kind extension point").
  Backed by `shapePainters` today; the spec doesn't rename the
  registry — just frames it as "the shape facet's registry."
- **Routing facet.** Value type: `{ matches: (data) => boolean }`.
  Backed by `NodeKindRegistry` today; the spec doesn't rename it
  either — just frames it as "the routing facet's classifier
  registry."

The framing doesn't introduce a new runtime abstraction. There's no
`FacetRegistryOfRegistries` mega-registry. Facets are a vocabulary
for talking about per-axis tables; each table is what it already is.

### Inspector UI

`apps/swillustrator/src/dev/RegistryInspector.tsx` currently has
`'shapeKinds'` and `'nodeKinds'` as top-level tree categories. Reframe:

- Rename `'nodeKinds'` to `'routingKinds'` for honesty (it's the
  routing facet, not the only kind taxonomy).
- Group `'shapeKinds'` and `'routingKinds'` under a synthetic parent
  category `'facets'`. Concretely: the tree node list grows a
  hierarchical category, or — simpler — two top-level categories with
  a shared "Facet:" label prefix in the tree.
- Detail pane for either kind type now carries a `facet` field
  (`'shape'` or `'routing'`) and the existing `source` semantics
  (default/consumer/override) on routing entries.

`apps/swillustrator/src/dev/registryData.ts` collectors:

- `collectShapeKinds()` → unchanged behavior; returned entries
  carry an additional `facet: 'shape'` tag.
- `collectNodeKinds()` → renamed to `collectRoutingKinds()`; entries
  carry `facet: 'routing'` and the existing `source` classification.

### Type-level naming

Decision: **keep `NodeKindRegistry` as the runtime name** (back-compat;
it's just landed and shipped). Add doc-level reframe in its JSDoc:

```ts
/**
 * NodeKindRegistry — the **routing facet's** classifier registry. Each
 * facet of a node (shape, routing, label, icon, …) is its own
 * registry; this one answers "what routing-kind string does this
 * node's data map to?" See the facets-reframe spec for the full
 * taxonomy:
 * `docs/superpowers/specs/2026-05-22-node-facets-reframe-design.md`.
 */
```

Future facet registries (label, icon, propertyRows, etc.) are
named per facet: `NodeLabelRegistry`, `NodeIconRegistry`, etc. Not
`NodeKindRegistry.label`.

If we ever consolidate the registry-of-registries (unlikely without a
real motivating consumer), it lands as a separate spec.

### Convergence-policy update

The 2026-05-21 spec's convergence policy table (which listed facets
as optional fields on `NodeKind`) is superseded by this spec. Each
future facet spec must declare:

1. **Facet name** (`shape`, `routing`, `label`, `icon`, …).
2. **Registry shape** — what value type the facet stores per kind
   name.
3. **Consumer** — which kit subsystem reads the registry.
4. **Wiring** — how the facet's registry is populated (consumer prop
   on `<SceneCanvas>`, plugin, module-level, etc.).
5. **Inspector surface** — how the inspector exposes the facet.

The May-21 spec gets a one-paragraph "**Superseded:** future facets
land as independent registries, not fields on `NodeKind`. See
`2026-05-22-node-facets-reframe-design.md`" note. Its other
contents (the registry's classifier API, the `kinds` prop, the
deprecation path) remain accurate.

## Migration

### Spec-level

1. Append the supersession note to the May-21 spec.
2. Update the TODO entry at `docs/TODO.md:85` (the P3
   "Convergence-target facets") to reference this spec.

### Code-level (small)

1. Add the doc-level reframe JSDoc on `NodeKindRegistry` and
   `defaultNodeKinds`.
2. Rename `'nodeKinds'` → `'routingKinds'` in the inspector tree
   category id and label. Add `facet: 'routing' | 'shape'` to the
   relevant `TreeEntry` types. Group both under a shared parent in
   the tree.
3. No kit-runtime changes.

### Test-level

- Existing `defaultNodeKinds` / `KIT_SHAPE_KINDS` parity test stays.
- Add a small inspector test asserting the two facet categories
  appear under the parent and the detail pane carries the `facet`
  field.

## Open questions resolved

1. **Should we unify registries?** No (non-goal #2 stands).
2. **Should `NodeKindRegistry` be renamed?** No, defer; reframe at
   the JSDoc level only.
3. **Should the inspector use a hierarchical tree with a "Facets"
   parent, or flat categories with a label prefix?** Hierarchical —
   it scales as more facets land (label/icon/propertyRows). Flat
   would degrade into a sea of `Facet: foo` entries.
4. **Should facets carry node-instance values (paint+routing+label
   per node) or stay per-kind tables?** Stay per-kind. The kit
   doesn't store facets *on* nodes; it stores them *by kind name* in
   per-facet registries. Per-node facets are a different design
   (closer to ECS) and out of scope.

## Future work

Each of the May-21 convergence-policy facets becomes its own spec
referencing this one. Order is opportunistic — whichever subsystem
demands the facet first writes its spec.

- `label` / `pluralLabel` / `icon` facet — drives layer panel,
  command palette, action labels.
- `propertyRows` facet — drives `<PropertiesPanel>` per-kind
  contributions.
- `bindings` facet — drives per-kind routing-table fragments (e.g.
  text → enterTextEdit binding).
- `subkinds` facet — drives state-aware routing (`'rect:selected'`)
  through a per-kind subkind producer.
- `serialize` / `deserialize` facet — drives `useScene` op-log
  serialization per kind.

Each spec must justify the consumer (which kit subsystem will read
the facet); speculatively-declared facets with no consumer are
overhead.
