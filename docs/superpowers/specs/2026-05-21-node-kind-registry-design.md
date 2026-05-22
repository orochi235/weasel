# Node-kind registry — design

Date: 2026-05-21
Status: design, awaiting plan.

## Goal

Replace the consumer-supplied `adapter.kindOf?(id) → string` hook with
a kit-owned **node-kind registry**: a small structure where consumers
register one `(data) → boolean` classifier per kind, and the kit
consults the registry whenever it needs to know what a node *is*.

The day-one job is narrow — centralize classification so every weasel
consumer stops hand-rolling "what counts as a rect." The design also
**reserves the namespace** as the convergence target for later
kind-keyed concerns (property rows, default labels/icons, op-log
serialization, kind-contributed routing fragments). Those facets land
later in their own specs; the registry shipped now is shaped to host
them without a breaking change.

## Motivation

### What we have today

The declarative tool routing spec
(`docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md`)
made target-kind strings load-bearing — tools write bindings like
`{ target: 'rect', actionId: 'move' }`, and the dispatcher matches the
node under the cursor against the binding's target kind.

That spec is explicit that the kit can't own a closed kind set:

> Closed-set target kinds. Consumers register their own; the kit
> routes by string key.
>
> The kit can't own a closed target-kind set (consumers register
> their own); route table keys stay `string`.

So Phase 1 of the routing migration punted: `adapter.kindOf?(id) →
string` is a consumer-supplied function the kit calls at two sites:

- `src/tools/dispatcher.ts:29` — affordance hit-result enrichment
  (`(adapter as { kindOf?: ... }).kindOf?.(targetId) ?? 'affordance:unknown'`).
- `src/canvas/Canvas.tsx:719` — synthesized `getNodeAtPoint` for the
  dispatcher (`a.kindOf?.(id) ?? 'unknown'`).

### The pain

The `kindOf` hook works but pushes the kind contract into consumer
space. Every weasel app — swillustrator, eric, force-graph demos, any
future consumer — writes the same shape of classifier:

```ts
function kindOf(id: NodeId): string {
  const node = adapter.getNode(id);
  if (node.type === 'rect') return 'rect';
  if (node.type === 'ellipse') return 'ellipse';
  if (node.type === 'text') return 'text';
  if (node.type === 'path') return 'path';
  return 'unknown';
}
```

This is boilerplate the kit could absorb. More importantly, the kit
can't reason about which kinds *exist* (no way to enumerate, no way
for kit-side subsystems like the bundle inspector or future debug
overlay to surface kind names), can't ship default classifiers for
built-in shapes (every app re-declares `'rect'`), and has no named
home for future cross-cutting per-kind data.

### Why now (and not later)

Two reasons:

1. The TODO marks this **P1** as a foundational genericity gap, and
   it's blocking the deprecation of the `kindOf` adapter hook (an
   explicitly temporary contract per the routing spec).
2. Several P2 items downstream depend on having a kind-keyed home:
   per-kind property rows, default action icons / labels,
   `useScene` op-log serialization. Each can launch its own spec
   once the registry exists.

## Non-goals

These keep the registry's identity sharp:

1. **No painter unification.** `shapePainters` stays separate. Paint
   identity ≠ interaction identity (theme/wireframe swaps, paintless
   kinds like `group`, paint-independent kinds like `'locked'` /
   `'guide'`, same-paint-different-route cases like sticky-note vs
   annotation). Consumers can co-register a painter and a kind for
   the same node; nothing forces it. If after 3+ examples
   co-registration is universal, revisit unification with real data.
   See "Future work" below.

2. **No affordance kinds in the registry.** Affordance strings
   (`'handle:bottom-right'`, `'anchor:first'`) come from the
   affordance pipeline. The registry only classifies node data.

3. **No automatic discovery.** No reading kinds from `useScene`
   layers, payload schemas, or shape-painter `matches` predicates.
   Consumers register explicitly.

4. **No conflict resolution beyond first-match.** If two registered
   kinds both claim a node, registration order wins. Defer
   multi-claim / overlapping-classifier semantics until a real case
   appears.

5. **No subkinds in v1.** State-aware kinds (`'rect:selected'`) are
   composed by the dispatcher from `${baseKind}:${state}`, where
   `state` comes from a separate selection/state probe. The registry
   produces base kind only.

## Proposal

### NodeKind entry

```ts
interface NodeKind {
  /** Unique kind name. Routing tables key on this string.
   *  Consumer-defined; the kit places no constraint beyond uniqueness
   *  within a registry instance. */
  name: string;

  /** Predicate over a node's data. First registered kind whose
   *  `matches` returns true claims the node. */
  matches: (data: unknown) => boolean;

  // No other facets in v1. Future facets (label, icon, propertyRows,
  // bindings, serialize) land here as optional fields in later specs.
}
```

### NodeKindRegistry API

```ts
interface NodeKindRegistry {
  /** Register a kind. Order matters: first-match wins during
   *  classify. Registering a kind with a name already present
   *  throws — explicit error beats silent shadowing. */
  register(kind: NodeKind): void;

  /** Walk registered kinds in registration order. Return the first
   *  kind whose `matches(data)` returns true. Returns `'unknown'`
   *  when no kind claims the node. */
  classify(data: unknown): string;

  /** Lookup a kind entry by name. Returns `undefined` if not
   *  registered. Used by reflective surfaces (debug overlay, bundle
   *  inspector) and by future facet consumers. */
  get(name: string): NodeKind | undefined;

  /** Enumerate registered kinds in registration order. */
  list(): readonly NodeKind[];
}

/** Factory. Each call returns a fresh registry instance. */
function createNodeKindRegistry(): NodeKindRegistry;
```

### Lifetime / scope

**Per-`<SceneCanvas>` instance, not module-singleton.**

Rationale: matches the kit's existing convention that each
`<SceneCanvas>` owns its world (its own scene, its own tools, its own
dispatcher). Two unrelated canvases on the same page can register
different kind sets without collision. Consumers who want a single
app-wide registry can construct one and pass the same reference to
each canvas — easy. The reverse (force per-instance from a singleton)
is awkward.

`shapePainters` is module-singleton today; this design deliberately
diverges. The mismatch is acceptable because painters and kinds are
intentionally separate registries (non-goal #1).

### Wiring

Consumers register kinds via a `kinds` prop on `<SceneCanvas>`:

```tsx
<SceneCanvas
  scene={scene}
  kinds={[
    { name: 'rect',    matches: (d) => (d as RectData).kind === 'rect' },
    { name: 'ellipse', matches: (d) => (d as EllipseData).kind === 'ellipse' },
    { name: 'text',    matches: (d) => (d as TextData).kind === 'text' },
  ]}
  ...
/>
```

`<SceneCanvas>` constructs a fresh `NodeKindRegistry`, registers each
entry in order, and threads the registry into the dispatcher via the
existing dispatcher options. Tools never see the registry directly —
they consume `target.kind` strings the dispatcher already produces.

### Dispatcher integration

The two callsites flip from `adapter.kindOf?.(id) ?? 'unknown'` to
`registry.classify(data) ?? 'unknown'`:

- `src/tools/dispatcher.ts:29` — affordance hit enrichment now reads
  `adapter.getNode(targetId)` and calls `registry.classify(data)`.
- `src/canvas/Canvas.tsx:719` — synthesized `getNodeAtPoint` calls
  `registry.classify(data)` after `adapter.getNode(id)`.

Where `adapter.getNode` is unavailable (legacy adapter shapes), the
sites fall back to the existing `'unknown'` behavior — same
degradation as today.

### Kit-shipped default kinds

The kit ships a `defaultNodeKinds` export covering the kit's own
built-in shape tools (the same set as `KIT_SHAPE_KINDS`):

```ts
export const defaultNodeKinds: NodeKind[] = [
  { name: 'rect',     matches: (d) => isShapeData(d) && d.kind === 'rect' },
  { name: 'ellipse',  matches: (d) => isShapeData(d) && d.kind === 'ellipse' },
  { name: 'polygon',  matches: (d) => isShapeData(d) && d.kind === 'polygon' },
  { name: 'star',     matches: (d) => isShapeData(d) && d.kind === 'star' },
  { name: 'line',     matches: (d) => isShapeData(d) && d.kind === 'line' },
  { name: 'pen',      matches: (d) => isShapeData(d) && d.kind === 'pen' },
  { name: 'pencil',   matches: (d) => isShapeData(d) && d.kind === 'pencil' },
  { name: 'lasso',    matches: (d) => isShapeData(d) && d.kind === 'lasso' },
  { name: 'text',     matches: (d) => isShapeData(d) && d.kind === 'text' },
];
```

Where `isShapeData(d)` narrows to the kit's standard `{kind: string}`
data shape. Consumers using that shape spread `defaultNodeKinds`
into their `kinds` prop and add their own; consumers with a custom
data shape ignore the export and register their own classifiers.

A barrel-test mirrors `KIT_SHAPE_KINDS` to `defaultNodeKinds` (parity
check), the same way `src/index.barrel.test.ts` enforces parity
between `BuiltinShapeToolId` and `KIT_SHAPE_KINDS` today.

### Migration of `adapter.kindOf`

The existing hook becomes `@deprecated` for one minor:

- If a registry is present, the registry wins.
- If no registry is present and `adapter.kindOf` is set, the hook
  still works (back-compat).
- If neither is present, the fallback is `'unknown'` (current
  behavior).

After one minor, the hook comes out. The TODO entry for "Kit-owned
object-kind registry" gets a follow-up note tracking the deprecation
removal.

## Convergence policy

> **Superseded by `docs/superpowers/specs/2026-05-22-node-facets-reframe-design.md` (2026-05-22):** future facets (label / icon / propertyRows / bindings / serialize) land as independent per-facet registries rather than optional fields on `NodeKind`. The convergence-policy table below describes the original intent; the facets-reframe spec is the load-bearing successor. The classifier API in the "Proposal" section above is unchanged.

The registry is the named home for kind-keyed cross-cutting data.
When a new piece of behavior or presentation needs per-kind
variation, it lands as an optional facet on `NodeKind` rather than as
its own parallel structure.

Open TODOs that the policy commits in advance:

| Facet                       | Lands with                                              | Consumed by                                        |
|-----------------------------|---------------------------------------------------------|----------------------------------------------------|
| `label`, `pluralLabel`      | "Default action icons" P2 work                          | layer panel, action labels, command palette        |
| `icon`                      | "Default action icons" P2 work                          | layer panel, command palette, debug overlay        |
| `propertyRows`              | "Per-kind property-row registry for `<PropertiesPanel>`" P2 | `<PropertiesPanel>`                            |
| `bindings`                  | First time a binding is unambiguously kind-owned (e.g. text → `enterTextEdit`) | `useSelectTool`, future tools |
| `subkinds`                  | When state-aware routing centralization becomes painful  | dispatcher                                         |
| `serialize` / `deserialize` | "`useScene` op log serialization shape" P2              | `useScene`                                         |

Each facet ships in its own spec; the registry is the named target
so we don't reinvent a parallel kind-keyed map for each. Each spec
that adds a facet must justify the consumer (which kit subsystem
will read it) — speculatively-declared facets that nothing reads are
overhead.

## Open questions resolved

1. **Lifetime / scope.** Per-`<SceneCanvas>` instance. (See "Lifetime
   / scope" above.)

2. **How tools reach the registry.** Tools don't — they consume
   `target.kind` strings the dispatcher already produces. The
   registry flows from `<SceneCanvas>` into the dispatcher via its
   existing options. (Consumers writing custom tools never see the
   registry.)

3. **Subkind production.** Composed by the dispatcher
   (`${baseKind}:${state}`), not in the registry. Selection state is
   dispatcher-owned; data classification is registry-owned. Keeping
   them separate avoids forcing the registry to know about
   selection.

4. **Reflection surface.** `list()` and `get()` only. Add more
   reflection (kind counts, per-kind hit-tally) when a concrete
   consumer asks.

## Testing

- **Unit tests** (`src/scene/nodeKindRegistry.test.ts`): registration
  order, first-match-wins, duplicate-name throws, `classify`
  fallback to `'unknown'`, `get`/`list` reflection.
- **Dispatcher integration** (`src/tools/dispatcher.test.ts`):
  affordance hit-result `kind` populated from registry classification,
  `'unknown'` fallback when no registry and no `adapter.kindOf`,
  `adapter.kindOf` still honored when registry is absent (back-compat).
- **Canvas integration** (`src/canvas/Canvas.smoke.test.tsx` or
  similar): `getNodeAtPoint` produces nodes with `kind` from the
  registry, deprecation path still works when `adapter.kindOf` is set
  without a registry.
- **Barrel parity**
  (`src/index.barrel.test.ts`): `defaultNodeKinds` contains a `name`
  entry for every `KIT_SHAPE_KINDS` entry. Existing
  `BuiltinShapeToolId` parity gate stays in place; this is a parallel
  one.

## Future work

Listed for reference; out of scope for this spec.

- **Painter unification candidate** (non-goal #1). After 3+ consumer
  apps land where a painter and a kind are always co-registered for
  the same name, write a unification spec. The decision must be
  driven by real co-registration evidence, not speculative.
- **Facet additions** per the convergence-policy table. Each gets its
  own spec.
- **Conflict resolution beyond first-match** (non-goal #4). If a
  consumer registers two kinds that legitimately want to claim the
  same node, design a priority / tag system. No design until a real
  case appears.
- **Removal of `adapter.kindOf`.** After one minor of deprecation,
  delete the hook from the adapter type and the two callsites'
  fallback branches.
