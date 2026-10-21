# Scene Serialization

`scene.toJSON()` and `sceneFromJSON()` let you snapshot and restore a scene's
current state — nodes, hierarchy, layer visibility/locked state, and function
fields like `clipFromPose`. The snapshot is plain JSON, so it round-trips
through `JSON.stringify` / `JSON.parse`, `localStorage`, `fetch`, or a static
import. History (undo/redo stacks) is not captured; a restored scene starts
with empty history.

## Quick example

```ts
import { createScene, sceneFromJSON } from '@weasel-js/core';

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

## JSON shape

`scene.toJSON()` returns a `SerializedScene<TData, TLayer, TPose>`.

```ts
import type { SerializedScene, SerializedNode } from '@weasel-js/core';

// Example value for a scene with two layers and three nodes:
const example: SerializedScene<MyData, 'shapes' | 'annotations', RectPose> = {
  version: 1,

  // One entry per layer, in layer order. Fields that match the default
  // (visible: true, locked: false) are omitted.
  systemLayers: [
    { id: 'shapes' },                       // visible=true, locked=false (defaults)
    { id: 'annotations', visible: false },  // hidden layer
  ],

  // Nodes in tree preorder: a parent always appears before its children, and
  // siblings appear in sibling order. This is NOT paint order when siblings sit
  // on different layers; see the note on `nodes` below.
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
| `version` | `1` | `sceneFromJSON` throws on any other value. |
| `systemLayers` | `SystemLayerSpec[]` | Layer ids and optional visibility/locked overrides. |
| `nodes` | `SerializedNode[]` | All nodes in tree preorder: parents before children, siblings in sibling order. A reader painting straight from `nodes` derives paint order from layers: paint each `systemLayers` entry in turn, taking that layer's nodes in the order they appear here. |
| `nodes[i].id` | `string` | Node id. Stable across save/load. |
| `nodes[i].kind` | `'leaf' \| 'container'` | Leaf or container. |
| `nodes[i].layer` | `TLayer` | Layer id (must match a `systemLayers` entry). |
| `nodes[i].pose` | `TPose` | Local-coordinate pose, relative to parent (or world for roots). |
| `nodes[i].data` | `TData` | App-defined payload. Must be JSON-serializable. |
| `nodes[i].parent` | `string?` | Parent container id. Omitted for root nodes. |
| `nodes[i].clipFromPoseKey` | `string?` | Registry key for the clip-path factory. Containers only; omitted when no clip. |
| `doc` | `Record<string, unknown>?` | The scene's document values (below). Omitted when it has none, so a snapshot written before they existed reads the same. |

## Document values

Document state that is not a node, such as a document's pages or its theme, lives in `scene.doc`, a set of named
JSON values beside the tree. Keys are namespaced by their owner: `core:pages`, `diagram:theme`.

```ts
scene.doc.set('core:pages', { pages: [{ id: 'page-1', width: 816, height: 1056 }] });
scene.doc.get<PagesDoc>('core:pages');
scene.doc.set('core:pages', undefined); // removes the key
```

A `set` is a scene edit like any other: it is undoable, joins an enclosing `scene.batch` as part of one entry, is
skipped when the new value is deep-equal to the current one, and notifies `subscribe`. Values are JSON and are not
to be mutated once set. `toJSON()` writes them under `doc`; `sceneFromJSON` and `loadState` read them back, and
`createScene` or `useScene` take `doc` for the values a scene starts with, outside history. An app that loads node
specs itself reads a snapshot's values with `docFromSnapshot` (`apps/shared/editor`).

## Function fields and the registry

`ContainerNode.clipFromPose` is a function, which JSON cannot carry.
You give each factory a string key in a registry, and the JSON
stores the key. On load, `sceneFromJSON` looks the key up in the registry and
wires the live function back onto the node.

```ts
import { createScene, sceneFromJSON } from '@weasel-js/core';
import type { SceneRegistry } from '@weasel-js/core';
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

A scene with no function fields needs no registry: omit it from both calls.

## What is NOT serialized

- **History.** A restored scene starts with empty history — the user cannot
  undo past the load point.
- **Selection.** Selection lives in `useSelection`, outside the `Scene`
  primitive; restoring it is the caller's job.
- **Pose overrides** (`scene.overrides`) — ephemeral per-node pose/alpha for a
  frame loop. Like selection, never document content: absent from `toJSON()`,
  never restored by `loadState`, and never recorded in history. Bake with
  `setPose` first if a frame's positions should survive a save.
- **Tool state.** The active tool, any in-flight gesture, and scratch state are
  not part of `Scene`.
- **View / viewport.** Camera position and zoom are not captured.
- **`TData` / `TPose` JSON-safety.** The kit serializes whatever is in `data`
  and `pose` as-is. `JSON.stringify` silently drops or corrupts values JSON
  cannot carry (functions, class instances, `undefined`).

## Error cases

`sceneFromJSON` and `scene.toJSON()` throw on unrecoverable problems rather
than silently losing data.

| Condition | Thrown by | Message pattern |
|---|---|---|
| Unknown JSON version | `sceneFromJSON` | `Scene: unsupported version <n>; only v1 supported` |
| Unknown `clipFromPoseKey` | `sceneFromJSON` | `Scene: unknown clipFromPose key '<key>'. Register a function with this key in the registry option.` |
| Child on a layer below its parent's | `sceneFromJSON` | `Scene: cannot place node '<id>' on layer '<layer>' under parent '<pid>' on layer '<plyr>' — a child may not render below its parent's layer` |
| Node with `clipFromPose` not registered in the scene's registry | `scene.toJSON()` | `Scene.toJSON: node '<id>' has clipFromPose but no matching registry key. The function must be registered via createScene's registry option to round-trip.` |

## Loading demo data from a JSON file

Initial scene data can ship as a static `*.scene.json` file instead of an
inline `initial:` array.

```ts
// my-scene.scene.json is a SerializedScene<MyData, MyLayer, MyPose> object.
import sceneData from './my-scene.scene.json';
import { sceneFromJSON } from '@weasel-js/core';

// No registry needed if the JSON has no clipFromPoseKey fields:
const scene = sceneFromJSON(sceneData, {});

// If the JSON does use clipFromPoseKey, pass the same registry you used when
// generating the file:
const scene = sceneFromJSON(sceneData, { registry });
```

With `"resolveJsonModule": true` in `tsconfig.json`, assert the imported JSON
to the right type:

```ts
import raw from './my-scene.scene.json';
import type { SerializedScene } from '@weasel-js/core';

const sceneData = raw as SerializedScene<MyData, MyLayer, MyPose>;
const scene = sceneFromJSON(sceneData, {});
```

## Versioning

The JSON format is `version: 1`, and `sceneFromJSON` throws on any other
value. A format change will increment the number and migrate inside
`sceneFromJSON`, so consumers write no migration code.
