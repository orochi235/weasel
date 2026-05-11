# Scene Serialization (Snapshot + Restore)

**Status:** design approved 2026-05-11.

**Goal:** Add `scene.toJSON()` / `Scene.fromJSON()` for snapshot + restore round-trip of scene state. JSON format is the same shape as today's `useScene({ initial })` array (flat, parent-by-id). Function fields (`clipFromPose` now; others later) are externalized via a per-scene **registry** that maps string keys to live functions.

**Non-goals:**
- History serialization (undo/redo stacks). Out of scope — `toJSON()` captures the current state only; loaded scenes start with empty history. Pursuing that would multiply the surface area of every op type.
- Selection state. Selection lives in `useSelection`, not in Scene. The serializer is scoped to the Scene primitive.
- Validation of `TData` / `TPose` JSON-safety. Consumers are responsible for keeping their pose / data fields JSON-serializable.
- Migrations from `version: 1` to future versions. v1 is the only version supported; future versions will land as a separate concern.

## Motivation

Two concrete pressures:

1. **Demo source listings are growing into data dumps.** SceneDemo, LayoutDemo, NestedGroupsDemo, ClippingDemo each carry an `initial:` array that's mostly literal coordinates. Externalizing those to JSON cleans up the demo source and makes diffs more readable.
2. **The function-field-isn't-data hack added in Phase 2 nested clipping wants a proper home.** `ContainerNode.clipFromPose` is a function; `kit:add`'s op payload is plain data; the C3 fix wired a side-channel `pendingClipPatches` cache to preserve the function across undo/redo. A registry pattern is the principled solution and applies to any future function field too.

## Decisions locked in

- **Scope: snapshot + restore (option B).** `toJSON()` captures current state; `fromJSON()` reconstructs it. No history.
- **JSON shape: flat, parent-by-id.** Same as `useScene({ initial })` today. JSON ≡ `initial:` shape with function-field keys swapped in for the function references. This means the demo-data-loading case (option A from brainstorm) falls out for free — `Scene.fromJSON(json)` is essentially `useScene({ initial: json.nodes })`.
- **Function fields: keyed registry, per-scene.** Each function-field type (today only `clipFromPose`; more later) has its own string-keyed map. The registry is passed to `createScene({ registry: ... })` once per scene instance. Per-scene rather than global to avoid module-cache leaks across tests and to match weasel's existing per-instance configuration pattern.
- **Versioning: literal `version: 1`.** `fromJSON` throws on unknown versions. Future migrations attach to specific version pairs (`1 → 2`, etc.).
- **Layer visibility / locked state captured.** Optional fields on `systemLayers[i]`, omitted means defaults.
- **Node order preserves render order.** Specifically: layer-major DFS preorder, identical to today's `scene.renderOrder()`. Reload replays in this order, which guarantees parents are inserted before children.
- **No silent failures on load.** Unknown registry keys, version mismatches, cross-layer subtrees, and unknown layer ids all throw with explicit messages.

## Architecture

### Modified: `src/core/scene/types.ts`

New exported type for the JSON shape:

```ts
export interface SerializedScene<TData, TLayer extends string, TPose> {
  version: 1;
  systemLayers: SerializedLayer<TLayer>[];
  nodes: SerializedNode<TData, TLayer, TPose>[];
}

export interface SerializedLayer<TLayer extends string> {
  id: TLayer;
  /** Omitted means `true` (the default). */
  visible?: boolean;
  /** Omitted means `false` (the default). */
  locked?: boolean;
}

export interface SerializedNode<TData, TLayer extends string, TPose> {
  id: string;
  kind: 'leaf' | 'container';
  layer: TLayer;
  pose: TPose;
  data: TData;
  /** Parent id; omitted for roots. */
  parent?: string;
  /** Registry key for the container's clip path factory. Containers only. */
  clipFromPoseKey?: string;
  // Future function-field keys (drawOneKey, layoutStrategyKey, etc.) live here.
}
```

The existing `AddNodeSpec` already has the right shape for `initial:`; `SerializedNode` is a parallel type for JSON (it uses `clipFromPoseKey` string instead of `clipFromPose` function).

### Modified: `src/core/scene/scene.ts`

**New option on `createScene`:**

```ts
interface CreateSceneOptions<TData, TLayer extends string, TPose> {
  systemLayers: SerializedLayer<TLayer>[];
  initial?: AddNodeSpec<TData, TLayer, TPose>[];
  registry?: SceneRegistry<TPose>;   // NEW
  historyLimit?: number;
}

interface SceneRegistry<TPose> {
  clipFromPose?: Record<string, (pose: TPose) => Path | null>;
  // Reserved for future function fields.
}
```

The registry is stored on the Scene closure. A **reverse registry** (`Map<Function, string>` per field) is built at construction time to support `toJSON`'s function → key lookup.

**New `toJSON` method on Scene:**

```ts
toJSON(): SerializedScene<TData, TLayer, TPose>;
```

Walks `scene.renderOrder()`, projects each node into `SerializedNode`. For containers with `clipFromPose`, looks up the function in the reverse registry; if found, attaches `clipFromPoseKey`; if absent, throws — silent loss would be worse than failing loudly. Layer state (visible/locked) is captured per `scene.layers` entry, with defaults omitted.

**New `Scene.fromJSON` static factory:**

```ts
Scene.fromJSON<TData, TLayer extends string, TPose>(
  json: SerializedScene<TData, TLayer, TPose>,
  options: { registry?: SceneRegistry<TPose>; historyLimit?: number },
): Scene<TData, TLayer, TPose>;
```

Validates `json.version === 1`. Walks `json.nodes`, resolving `clipFromPoseKey` via `options.registry.clipFromPose`; throws on unknown key. Builds an `AddNodeSpec[]` and calls `createScene({ systemLayers: json.systemLayers, initial: builtSpecs, registry: options.registry })`. The existing `options.initial` loader runs the cross-layer-subtree validation and calls `patchClipFromPose` to populate the `pendingClipPatches` cache for undo/redo correctness.

Layer visibility/locked state from `json.systemLayers[i].visible` / `.locked` is applied during construction via the existing `setLayerVisible` / `setLayerLocked` paths (with default values when fields are omitted).

### No changes to renderer, hit-test, or tools

Serialization is purely a Scene-primitive concern. The renderer, `buildSceneTree`, hit-test pipeline, and tools see no API changes — they continue to work with the live Scene exactly as before.

## Data flow

**Save:**
```
Scene live state
    │
    ▼
scene.toJSON()
    │
    ├─ walk scene.renderOrder() → SerializedNode[]
    ├─ reverse-registry lookup per function field
    └─ snapshot systemLayers visible/locked state
    │
    ▼
SerializedScene → JSON.stringify → string
```

**Load:**
```
string → JSON.parse → SerializedScene
    │
    ▼
Scene.fromJSON(json, { registry })
    │
    ├─ validate version
    ├─ resolve every clipFromPoseKey via registry → throw on missing
    └─ build AddNodeSpec[] from json.nodes
    │
    ▼
createScene({ systemLayers, initial: specs, registry })
    │
    ├─ runs through options.initial loader
    ├─ assertSubtreeLayer per node (cross-layer rejection)
    ├─ patchClipFromPose populates pendingClipPatches cache
    └─ setLayerVisible / setLayerLocked per layer config
    │
    ▼
live Scene<TData, TLayer, TPose>
```

## Error handling

All errors are explicit `Error` throws with named offenders. No silent fallbacks, no warnings-and-permit.

| Condition | Where | Message shape |
|-----------|-------|---------------|
| Unknown JSON version | `Scene.fromJSON` | `Scene.fromJSON: unsupported version <n>; only v1 supported` |
| Unknown `clipFromPoseKey` | `Scene.fromJSON` (per-node) | `Scene.fromJSON: unknown clipFromPose key '<key>'. Register a function with this key in the registry option.` |
| Cross-layer parent in JSON | `assertSubtreeLayer` (via initial loader) | Existing message — `Scene: cannot place node '<id>' on layer '<layer>' under parent '<pid>' on layer '<plyr>' — subtree layer must match parent` |
| Unknown layer id in JSON | `requireLayerIndex` (via initial loader) | Existing message |
| `toJSON` finds a function not in registry | `scene.toJSON()` | `Scene.toJSON: container '<id>' has clipFromPose but no matching registry key. The function must be registered via createScene's registry option to round-trip.` |

## Impact on existing code

- **Existing demos**: opt-in. Demos can migrate from inline `initial:` arrays to JSON files at the consumer's pace. Both paths continue to work — `fromJSON` is one entry point; `createScene({ initial: [...] })` is another.
- **Existing consumers**: zero behavior change unless they call `toJSON` / `fromJSON`. The new `registry` option on `createScene` is optional.
- **Phase 2 nested clipping**: the `pendingClipPatches` cache continues to handle undo/redo. With serialization, the cache is populated by the `initial:` loader exactly as before; nothing new.
- **Plan-time impact**: ~one day of focused work. No renderer changes, no hit-test changes, no tool changes. All edits are in `src/core/scene/`.

## Components

| Component | Responsibility | Dependencies |
|-----------|---------------|--------------|
| `SerializedScene` / `SerializedNode` / `SerializedLayer` types | JSON shape definition | `Path` type |
| `SceneRegistry<TPose>` type | Per-scene registry shape | `Path` type |
| `createScene(options.registry)` | Build reverse-registry maps at construction | `SceneRegistry` |
| `scene.toJSON()` | Snapshot current state to JSON; reverse-lookup function fields | Scene state, reverse registries |
| `Scene.fromJSON(json, options)` | Validate JSON, resolve registry keys, replay via createScene | `createScene`, `SceneRegistry` |

Each unit is testable in isolation: `toJSON` is a pure read of state; `fromJSON` is `createScene` with pre-resolved keys; the type shapes are static.

## Testing

### `src/core/scene/scene.test.ts` additions

- `toJSON` snapshots flat scene → JSON with no parent fields.
- `toJSON` snapshots scene with container + children → JSON with `parent` references.
- `toJSON` captures layer visible=false and locked=true correctly; omits when defaults.
- `toJSON` preserves render order (layer-major DFS preorder) in the `nodes` array.
- `toJSON` writes `clipFromPoseKey` for containers whose function matches a registered factory.
- `toJSON` throws when a container's `clipFromPose` isn't in the registry.
- `Scene.fromJSON` round-trip: `toJSON → fromJSON` reconstructs an equivalent scene (same nodes, same parents, same layer state).
- `Scene.fromJSON` rejects unknown version.
- `Scene.fromJSON` rejects unknown `clipFromPoseKey` with the exact error message.
- `Scene.fromJSON` rejects cross-layer subtrees (via existing `assertSubtreeLayer`).
- `Scene.fromJSON`-loaded container's `clipFromPose` works (call it, get back a path) — proves registry resolution happens.
- `Scene.fromJSON`-loaded container's `clipFromPose` survives undo+redo (proves `pendingClipPatches` is populated by the initial loader).

### Not in scope

- Performance benchmarks on large scenes. The format is linear in node count; no surprises.
- A `ClippingDemo` migration to JSON. Optional follow-up after the primitive lands.

## Release notes

> Scene primitive gains `scene.toJSON()` and `Scene.fromJSON(json, options)` for snapshot + restore of current state. JSON format mirrors the existing `useScene({ initial })` array. Function fields like `ContainerNode.clipFromPose` are externalized via a per-scene `registry: { clipFromPose: { 'ellipse': fn, ... } }` option on `createScene`; the JSON references factories by string key. History (undo/redo stacks) is NOT serialized — loaded scenes start with empty history. Consumers without function fields don't need to set `registry`.
