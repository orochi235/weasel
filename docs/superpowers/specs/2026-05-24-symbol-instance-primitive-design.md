# Symbol / Instance Primitive

**Status: DEFERRED — on the shelf.**

This document captures a brainstorm from 2026-05-24. It is **not** an active plan and should not be lifted directly into implementation without reassessment. When the time comes to pick this up:

- Re-read the current state of the modality design (`2026-05-24-modality-design.md`). The `symbol-edit` mode here assumes a particular shape for the mode preset; if modality has shipped and the preset has evolved, reconcile.
- Re-read the deferred masks design (`2026-05-24-mask-primitive-design.md`). If masks have come off the shelf and shipped, the mask-instance composition story (mask reuse via symbols) needs to be verified end-to-end, not just assumed.
- Check whether the Canvas/SceneCanvas seam refactor has landed (`2026-05-24-canvas-scenecanvas-seam` (plan, deleted at merge)). The hit-testing notes below assume `Hit.kind` from `getNodeAtPoint` as the kind transport.
- The "Reassessment checklist" at the bottom of this doc is for v2 (heavyweight) reassessment specifically; the bullets above are for v1 reassessment when picking the lightweight primitive up off the shelf.

Design for a lightweight symbol/instance primitive in weasel, with extension hooks for a future heavyweight (Figma-style components) mode without reshaping the data model. Brainstormed 2026-05-24.

## Motivation

A general 2D scene-graph kit benefits from a way to define a subtree once and place it many times (icons, repeated decorations, library elements, reusable masked groups). The lightweight model — instances carry only a pose, edits to the definition propagate live, divergences require explicit detach — is enough to unlock those workflows and is strictly contained by any future heavyweight component model. Starting lightweight avoids painting weasel into Figma's specific UX choices while keeping forward compatibility.

## Scope

In scope:

- A `SymbolDefinition` container node kind and an `Instance` leaf node kind.
- A `symbolsRoot` subtree on `Scene` alongside the rendered `root`.
- Cycle prevention.
- Hit-testing that returns the `Instance` as a whole (not its descendants) outside symbol-edit mode.
- A new `symbol-edit` mode in the modality preset.
- Ops: create from selection, insert instance, detach, delete symbol.
- Forward-compatible extension hooks (`propertyDefs`, `propertyValues`, `overrides`) defined in the type but inert at v1.

Out of scope:

- Heavyweight component features: typed property surfaces, per-descendant overrides, variants. Reserved for v2; the v1 data shape leaves room for them.
- Cross-document symbol libraries.
- Symbol versioning / publishing.
- Property-value editing tools and UI.

## Architecture

### Scene shape

```
Scene<TData, TLayer, TPose>
├── root         (existing — the rendered tree)
└── symbolsRoot  (new — library; not rendered as part of main, serializes normally)
```

Each child of `symbolsRoot` is a `SymbolDefinition` container whose subtree is the symbol's contents. Definitions live in the same `state.nodes` map as everything else, so they inherit existing op/undo/serialize/hit-test/render machinery. They are walked from `symbolsRoot` for serialization but skipped by the main render walk.

The rationale against alternatives:

- **Parallel registry (`scene.symbols: Map<SymbolId, Subtree>`)**: duplicates serialize/op/undo plumbing, introduces a parallel scene concept.
- **A named layer**: user-visible as a regular layer, footgun if accidentally rendered or transformed.

### Node types

```ts
interface SymbolDefinition<TData, TLayer, TPose> {
  kind: 'symbol-definition'
  id: SymbolId
  name: string
  root: NodeId               // the subtree rendered for each instance

  // Extension hook — v1 ignores; v2 (heavyweight) populates:
  propertyDefs?: PropertyDef[]
}

interface Instance<TPose> {
  kind: 'instance'
  symbolId: SymbolId
  pose: TPose

  // Extension hooks — v1 ignores; v2 (heavyweight) populates:
  propertyValues?: Record<string, unknown>
  overrides?: Record<NodeId, unknown>
}
```

### Why bake in the extension hooks now

Defining `propertyDefs`, `propertyValues`, and `overrides` in the v1 type — even though no v1 code reads or writes them — locks in a forward-compatible serialization shape. v1 documents persist with empty extension fields; when v2 lands, those documents load cleanly and the fields start being populated. Without the hooks, adding them later would require either a serialization migration or a parallel type, and any third-party tooling that serialized scenes would silently strip the fields.

This is the kind of trade-off the brainstorm flagged as the deciding factor for "lightweight with extension shape baked in" over "lightweight, design v2 when needed."

### Pose

Instances use the existing `TPose` type. An Instance is a leaf node carrying a pose like any other.

### Render

Single shared render walk. When the renderer encounters an `Instance`, it pushes the instance's pose onto the transform stack and walks the referenced symbol's `root` subtree, then pops. No shadow tree per instance; same nodes participate in many renders.

Bounds and hit regions derive from the symbol's subtree bounds transformed by the instance's pose. Cached per (symbolId, pose-key) when worth it; details are a renderer concern.

### Hit-testing

An `Instance` hit-tests as a whole: a click anywhere inside its rendered bounds returns the `Instance` node, not the descendant inside the symbol's subtree. Matches the user's intent ("I want to move this stamp"). To drill into a symbol, enter `symbol-edit` mode.

Inside `symbol-edit` mode, hit-testing returns descendants of the symbol's `root` subtree, because the user is editing the definition.

### Cycle prevention

Mandatory. On `insertInstance`, `setSymbolRoot`, or any op that could change the symbol-reference graph, the op validator walks the prospective definition chain and rejects if the chain reaches back to the enclosing symbol. Self-reference is banned; mutual cycles are banned.

The check is O(depth × branching) but cycles in practice are shallow; not a perf concern.

### Nested instances

Allowed. An "icon button" symbol can contain an instance of an "icon" symbol. The cycle check handles the only problematic case (self-reference, direct or transitive).

## Ops (v1)

- **`createSymbolFromSelectionOp`** — moves the current selection into a new `SymbolDefinition` under `symbolsRoot`, replaces the selection in the main tree with an `Instance` of the new symbol. Pose carries the selection's previous position.
- **`insertInstanceOp({ symbolId, pose })`** — places an existing symbol as an instance.
- **`detachInstanceOp({ instanceId })`** — replaces an instance with a deep clone of its symbol's `root` subtree, composing the instance's pose into the clone's root pose. Drops the symbolId reference. Inverse re-creates the instance from the clone (op inverse machinery already supports this kind of pair).
- **`deleteSymbolOp({ symbolId, force })`** — removes a symbol definition. With `force: false` (default), rejects if any instances exist. With `force: true`, calls `detachInstanceOp` on every instance first.

`setInstancePoseOp` is the generic pose op; no new op needed.

All ops are subject to the existing coalescing and journal-routing rules — instance pose changes coalesce naturally; create-from-selection is a single bigger entry.

## Modality coupling: the `symbol-edit` mode

A new mode joins the stock preset (see `2026-05-24-modality-design.md`):

- **Kind:** soft.
- **Allows:** same capabilities as `normal`. The mode's job is scoping, not tool restriction.
- **Scoping:** yes — only the symbol's subtree is selectable and undimmed. The main `root` tree dims to 30%, including the instance that triggered entry.
- **Tint:** indigo or magenta. Pick at implementation time; should differentiate from `path-edit` (blue) and `isolation` (violet).
- **Entry:** double-click an instance; or `E` with an instance selected; or `Symbols Panel > Edit Symbol`.
- **Exit:** `⎋` suspend (journal cached by symbolId) / `⌘⎋` discard.
- **Journal target:** the symbol's id. Re-entering the same symbol resumes the journal (subject to the standard staleness check — if other ops touched the symbol's subtree in the interim, the cached journal is dropped).
- **Ghost previews (optional v1 feature):** render dimmed previews of every instance in their main-tree positions while the user edits the definition. Lets the user see propagation in context without leaving the mode. Worth shipping if cheap; not blocking.

No new capability tag needed — the eligible tool set is `normal`'s. Scoping (writes target the symbol's subtree) is enforced by the mode's selection/insert routing, not by tag filtering.

**Cross-doc obligation:** when this design ships, update `2026-05-24-modality-design.md`'s stock preset table to add `symbol-edit`.

## Layer-list presentation

Two sections at the top level of the layer list:

- **Symbols** — collapsible, shows each `SymbolDefinition` with its name. Expanding reveals the symbol's subtree. Entering `symbol-edit` is reachable from the row's context menu and from double-clicking the row.
- **Layers** — the existing main-tree layer list, unchanged.

Instances in the main tree show with a small badge or italic name indicating they're instances; their entry is non-expandable (their subtree lives in the symbol, not in the main tree). Right-click → Edit Symbol / Detach.

## Interaction with the deferred mask primitive

Once this primitive lands, **mask reuse via instances** is the natural answer to the "same mask in multiple places" need raised in `2026-05-24-mask-primitive-design.md`. Make the `MaskedGroup` a symbol; place instances. This is why the masks doc could safely reject option C (referenced nodes / non-tree edges) in favor of option D (typed-slot container) — symbol/instance is the reuse primitive.

**Cross-doc obligation (when masks come off the shelf):** verify that mask-instance composition works as expected — specifically, that putting a `MaskedGroup` in a `SymbolDefinition` and instancing it produces the correct render result, given that masks involve offscreen rendering and instances involve pose composition.

## File plan

```
src/core/scene/types.ts            + SymbolDefinition, Instance, SymbolId
                                   + symbolsRoot field on Scene
src/core/scene/scene.ts            ~ initialize symbolsRoot; serialize includes it
src/core/scene/cycleCheck.ts       + new — cycle detection on symbol refs
src/core/ops/createSymbolFromSel.ts + new
src/core/ops/insertInstance.ts     + new
src/core/ops/detachInstance.ts     + new
src/core/ops/deleteSymbol.ts       + new
src/renderer/                      ~ Instance render path (pose push + symbol walk)
src/canvas/sceneAdapter.ts         ~ Instance hit-tests as a whole; symbol-edit drills in
packages/modes/             + symbol-edit mode in the default preset
apps/weaseldraw/                   + Symbols panel UI section
                                   + symbol-edit chrome (breadcrumb, tint var)
                                   + Make Symbol / Detach / Edit Symbol menu + keys
```

## Forward-compatibility — what v2 (heavyweight) would add

When/if this design's v2 escalation is taken up:

- `propertyDefs` populated — typed properties on the symbol (text, number, boolean, swatch, enum, instance-swap). New panel in the inspector for editing the property surface inside `symbol-edit`.
- `propertyValues` populated — values bound per-instance. New inspector section when an instance is selected.
- `overrides` populated — per-descendant overrides for non-property edits (fill of a specific descendant, visibility, text content). Override reconciliation when the symbol's structure mutates is the central edge-case territory.
- The `overrides` keying (`Record<NodeId, …>`) may need to migrate to a structural-path key for resilience to symbol structural edits. **Reassess at v2 time** — the v1 shape is the conservative starting point; widening to path keys is a serialization migration but not a structural rethink.
- Variants: a property-defined enum that swaps which definition is rendered. Implementable as multiple `SymbolDefinition`s grouped under a "variant set" container; the variant set is what instances reference. Defer details to v2.
- A new `binds-symbol-properties` capability tag for property-editing tools.

## Risks and open questions for v1

- **`overrides` key shape.** Calling out again: `NodeId` works for v1 only because v1 has no overrides. The first v2 task is to revisit this key. Documenting the assumption visibly so it doesn't surprise anyone.
- **Detach inverse.** Conceptually fine (re-create instance from the cloned subtree) but the inverse op needs to remember the symbolId. Op inverse machinery handles this, but worth writing a test that detach-then-undo restores the instance with the same symbolId.
- **Symbol deletion with `force: true`.** Deletes the definition and detaches every instance in one op. Coalescing should treat this as one undo entry. The op is large for documents with many instances; not a correctness concern, just worth confirming the journal handles it cleanly.
- **Ghost previews while in `symbol-edit`.** Performance question — N instances × per-frame transform during interactive edit. Cache aggressively, or ship without and add later. Not blocking.
- **Hit-testing precedence between `MaskedGroup` (when it lands) and `Instance`.** An instance of a masked group inside the main tree: a click hits the `Instance` (per "hit-tests as a whole"), and the mask's coverage gates that hit. The mask check uses the symbol's subtree mask, evaluated at the click point transformed by the instance's pose. Worth writing this down in the masks doc's reassessment checklist.

## Implementation order (sketch)

1. Add `SymbolDefinition`, `Instance`, `SymbolId` types and the `symbolsRoot` scene field. Round-trip serialize/deserialize tests. No new behavior yet.
2. Add cycle-check utility with unit tests.
3. Ops: `insertInstance`, `detachInstance` first (simplest pair); then `createSymbolFromSelection`; then `deleteSymbol`. Each with op + inverse + tests.
4. Renderer: instance render path (pose push + symbol walk). Bounds and hit-region derivation.
5. Hit-testing: instance-as-whole behavior; verify it composes with the existing kind-via-`Hit.kind` transport (post Canvas/SceneCanvas seam refactor).
6. `symbol-edit` mode in `weasel-modes`. Wire scoping (selection + insertion writes target the symbol subtree), tint, chrome.
7. WeaselDraw UI: Symbols panel section, context menu items, keybindings.
8. (Optional) Ghost previews in `symbol-edit`.

## Reassessment checklist (read when v2 heavyweight is picked up)

- [ ] Is the `overrides` keying (`Record<NodeId, …>`) still adequate, or does it need to become a structural-path key?
- [ ] What property type vocabulary should `propertyDefs` expose? (text, number, boolean, swatch, enum, instance-swap, …)
- [ ] What's the override-reconciliation behavior when a definition's structure mutates (descendant deleted, reordered, replaced)?
- [ ] Does the modality preset still look as it does today? Add the `binds-symbol-properties` tag if heavyweight ships, and verify `symbol-edit` is still the right mode home for property editing (vs. a separate sub-mode).
- [ ] Are instance-swap variants worth modeling as variant-sets (multiple `SymbolDefinition`s grouped), or as a flag on `SymbolDefinition` itself?
