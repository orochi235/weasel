# Scene Serialization

`scene.toJSON()` and `sceneFromJSON()` let you snapshot and restore a scene's
current state — nodes, hierarchy, layer visibility/locked state, and function
fields like `clipFromPose`. The snapshot is plain JSON, so it round-trips
through `JSON.stringify` / `JSON.parse`, `localStorage`, `fetch`, or a static
import. History (undo/redo stacks) is not captured; a restored scene starts
with empty history.

## Quick example

```ts
import { createScene, sceneFromJSON } from '@orochi235/weasel';

// Build a scene however you like, then save it:
const scene = createScene({
  systemLayers: [{ id: 'default' }],
  initial: [/* ... */],
});

const json = scene.toJSON();
localStorage.setItem('mySaved', JSON.stringify(json));

// Later, in a different session:
const loaded = sceneFromJSON(
  JSON.parse(localStorage.getItem('mySaved')!),
  {},
);
```

The `loaded` scene is fully live — you can call `add`, `remove`, `setPose`,
`undo`, `redo`, and wire it into `<SceneCanvas>` exactly like a freshly
constructed scene.

## JSON shape

`scene.toJSON()` returns a `SerializedScene<TData, TLayer, TPose>`. The
structure mirrors the `initial:` array you pass to `createScene`, so you can
also use a `*.scene.json` file as initial scene data (see
[Loading demo data from a JSON file](#loading-demo-data-from-a-json-file)).

```ts
import type { SerializedScene, SerializedNode } from '@orochi235/weasel';

// Example value for a scene with two layers and three nodes:
const example: SerializedScene<MyData, 'shapes' | 'annotations', RectPose> = {
  version: 1,

  // One entry per layer, in layer order. Fields that match the default
  // (visible: true, locked: false) are omitted.
  systemLayers: [
    { id: 'shapes' },                       // visible=true, locked=false (defaults)
    { id: 'annotations', visible: false },  // hidden layer
  ],

  // Nodes in layer-major DFS preorder (parents always appear before their
  // children). This is identical to the order scene.renderOrder() returns.
  nodes: [
    {
      id: 'box-1',
      kind: 'leaf',
      layer: 'shapes',
      pose: { x: 10, y: 20, width: 100, height: 80 },
      data: { label: 'My box' },
      // parent: omitted → root node
    },
    {
      id: 'group-1',
      kind: 'container',
      layer: 'shapes',
      pose: { x: 0, y: 0, width: 200, height: 200 },
      data: { label: 'Group' },
      // clipFromPoseKey: present only for containers that have a clip factory
    },
    {
      id: 'child-1',
      kind: 'leaf',
      layer: 'shapes',
      pose: { x: 5, y: 5, width: 50, height: 50 },
      data: { label: 'Child' },
      parent: 'group-1',   // parent id
    },
  ],
};
```

**Field reference:**

| Field | Type | Notes |
|---|---|---|
| `version` | `1` | Always `1` for now. `sceneFromJSON` throws on any other value. |
| `systemLayers` | `SystemLayerSpec[]` | Layer ids and optional visibility/locked overrides. |
| `nodes` | `SerializedNode[]` | All nodes in render order. |
| `nodes[i].id` | `string` | Node id. Stable across save/load. |
| `nodes[i].kind` | `'leaf' \| 'container'` | Leaf or container. |
| `nodes[i].layer` | `TLayer` | Layer id (must match a `systemLayers` entry). |
| `nodes[i].pose` | `TPose` | Local-coordinate pose, relative to parent (or world for roots). |
| `nodes[i].data` | `TData` | App-defined payload. Must be JSON-serializable. |
| `nodes[i].parent` | `string?` | Parent container id. Omitted for root nodes. |
| `nodes[i].clipFromPoseKey` | `string?` | Registry key for the clip-path factory. Containers only; omitted when no clip. |

## Function fields and the registry

`ContainerNode.clipFromPose` is a function — functions aren't JSON-serializable.
The registry bridges this gap: you give each factory a string key, and the JSON
stores the key. On load, `sceneFromJSON` looks the key up in the registry and
wires the live function back onto the node.

```ts
import { createScene, sceneFromJSON } from '@orochi235/weasel';
import type { SceneRegistry } from '@orochi235/weasel';
import { ellipsePath, rectPath } from './my-clip-factories';

// Define the registry once and share it between save and load:
const registry: SceneRegistry<MyPose> = {
  clipFromPose: {
    'ellipse': (pose) => ellipsePath(pose),
    'rect':    (pose) => rectPath(0, 0, pose.width, pose.height),
  },
};

// Pass it to createScene so toJSON can reverse-look up your functions:
const scene = createScene({
  systemLayers: [{ id: 'shapes' }],
  registry,
});

// Add a container that clips to an ellipse:
scene.add({
  kind: 'container',
  layer: 'shapes',
  pose: { x: 0, y: 0, width: 200, height: 200 },
  data: { label: 'Clipped group' },
  clipFromPose: registry.clipFromPose!['ellipse'],
});

// Save: the JSON carries `clipFromPoseKey: 'ellipse'` on the container.
const json = scene.toJSON();

// Load: resolve the key back to the live factory.
const loaded = sceneFromJSON(json, { registry });
```

If you don't use `clipFromPose` (or any other function field), you don't need
a registry. Just pass `{}` as the options to `sceneFromJSON` and omit `registry`
from `createScene`.

## What is NOT serialized

- **History.** The undo/redo stacks are not captured. A restored scene starts
  with empty history — the user cannot undo past the load point.
- **Selection.** Selection lives in `useSelection`, outside the `Scene`
  primitive. It is the caller's responsibility to restore selection state if
  needed.
- **Tool state.** The active tool, any in-flight gesture, and scratch state are
  not part of `Scene`.
- **View / viewport.** Camera position and zoom are not captured. Wire those
  separately if your app needs to restore the viewport.
- **`TData` / `TPose` JSON-safety.** The kit serializes whatever is in `data`
  and `pose` as-is. If those contain non-JSON-serializable values (functions,
  class instances, `undefined`), the `JSON.stringify` call will silently drop
  or corrupt them. Keep your data and pose types JSON-safe.

## Error cases

`sceneFromJSON` and `scene.toJSON()` throw on unrecoverable problems rather
than silently losing data.

| Condition | Thrown by | Message pattern |
|---|---|---|
| Unknown JSON version | `sceneFromJSON` | `sceneFromJSON: unsupported version <n>; only v1 supported` |
| Unknown `clipFromPoseKey` | `sceneFromJSON` | `sceneFromJSON: unknown clipFromPose key '<key>'. Register a function with this key in the registry option.` |
| Cross-layer subtree (parent and child on different layers) | `sceneFromJSON` (via `createScene`) | `Scene: cannot place node '<id>' on layer '<layer>' under parent '<pid>' on layer '<plyr>' — subtree layer must match parent` |
| Container with `clipFromPose` not registered in `toJSON`'s registry | `scene.toJSON()` | `Scene.toJSON: container '<id>' has clipFromPose but no matching registry key. The function must be registered via createScene's registry option to round-trip.` |

The cross-layer error is the same one `createScene` throws for invalid
`initial:` arrays. It fires when the JSON was manually edited or produced by
a different version of your app that didn't enforce layer discipline.

## Loading demo data from a JSON file

A common pattern is shipping initial scene data as a static `*.scene.json`
file instead of an inline `initial:` array. This keeps demo source readable
and makes the data diff-friendly.

```ts
// my-scene.scene.json is a SerializedScene<MyData, MyLayer, MyPose> object.
import sceneData from './my-scene.scene.json';
import { sceneFromJSON } from '@orochi235/weasel';

// No registry needed if the JSON has no clipFromPoseKey fields:
const scene = sceneFromJSON(sceneData, {});

// If the JSON does use clipFromPoseKey, pass the same registry you used when
// generating the file:
const scene = sceneFromJSON(sceneData, { registry });
```

Because `SerializedScene` is structurally the same as a `{ systemLayers, initial }`
config, loading from JSON is equivalent to `createScene({ systemLayers, initial })` —
the only difference is that `sceneFromJSON` validates the version field and resolves
registry keys before delegating to `createScene`.

For TypeScript: if your bundler supports `resolveJsonModule` (Vite and tsc both do
with `"resolveJsonModule": true` in `tsconfig.json`), you can assert the imported
JSON to the right type:

```ts
import raw from './my-scene.scene.json';
import type { SerializedScene } from '@orochi235/weasel';

const sceneData = raw as SerializedScene<MyData, MyLayer, MyPose>;
const scene = sceneFromJSON(sceneData, {});
```

## Versioning

The JSON format is currently `version: 1`. `sceneFromJSON` throws immediately
on any other version value. Future format changes will increment the version
number and include a migration step inside `sceneFromJSON` — consumers don't
need to write migration code themselves. When a migration ships, the release
notes will document the version bump and any breaking changes to field shapes.

For now, `version: 1` is the only value you'll encounter.
