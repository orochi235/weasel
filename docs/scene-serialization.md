# Scene Serialization

`scene.toJSON()` and `sceneFromJSON()` let you snapshot and restore a scene's
current state — nodes, hierarchy, layer visibility/locked state, and function
fields like `clipFromPose`. The snapshot is plain data that a structured clone (IndexedDB, `postMessage`) carries
as it is. A kit path keeps its commands and coords in typed arrays, which `JSON.stringify` writes as plain objects,
so text goes through `@weasel-js/editor`'s `serializeReplacer` and comes back through its `reviveTypedArrays`.
History (undo/redo stacks) is not captured; a restored scene starts with empty history.

## Quick example

```ts
import { createScene, sceneFromJSON } from '@weasel-js/core';
import { reviveTypedArrays, serializeReplacer } from '@weasel-js/editor';

// Build a scene however you like, then save it:
const scene = createScene({
  systemLayers: [{ id: 'default' }],
  initial: [/* ... */],
});

localStorage.setItem('mySaved', JSON.stringify(scene.toJSON(), serializeReplacer));

// Later, in a different session:
const loaded = sceneFromJSON(reviveTypedArrays(JSON.parse(localStorage.getItem('mySaved')!)), {});
```

## JSON shape

`scene.toJSON()` returns a `SerializedScene<TData, TLayer, TPose>`.

```ts
import type { SerializedScene, SerializedNode } from '@weasel-js/core';

// Example value for a scene with two layers and three nodes:
const example: SerializedScene<MyData, 'shapes' | 'annotations', RectPose> = {
  version: 3,

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
      kind: 'mark',
      layer: 'shapes',
      pose: { x: 10, y: 20, width: 100, height: 80 },
      data: { label: 'My box' },
      // parent: omitted → root node
    },
    {
      id: 'group-1',
      kind: 'group',
      layer: 'shapes',
      pose: { x: 0, y: 0, width: 200, height: 200 },
      data: { label: 'Group' },
      clip: 'outline',     // present only when the node declares a clip
    },
    {
      id: 'child-1',
      kind: 'mark',
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
| `version` | `3` | `toJSON` writes 3; `sceneFromJSON` and `loadState` also read 1 and 2 (see Versioning) and throw on any other value. |
| `systemLayers` | `SystemLayerSpec[]` | Layer ids and optional visibility/locked overrides. |
| `nodes` | `SerializedNode[]` | All nodes in tree preorder: parents before children, siblings in sibling order. A reader painting straight from `nodes` derives paint order from layers: paint each `systemLayers` entry in turn, taking that layer's nodes in the order they appear here. |
| `nodes[i].id` | `string` | Node id. Stable across save/load. |
| `nodes[i].kind` | `'mark' \| 'group'` | A mark draws itself; a group draws nothing of its own. Either may have children. |
| `nodes[i].layer` | `TLayer` | Layer id (must match a `systemLayers` entry). |
| `nodes[i].pose` | `TPose` | Local-coordinate pose, relative to parent (or world for roots). |
| `nodes[i].data` | `TData` | App-defined payload. Must be JSON-serializable. |
| `nodes[i].parent` | `string?` | Parent id. Omitted for root nodes. |
| `nodes[i].clip` | `'outline'?` | The node clips its children to its own outline. Omitted when it declares no clip; then its children are not clipped unless it has a `clipFromPoseKey`. |
| `nodes[i].clipFromPoseKey` | `string?` | Registry key for the node's `clipFromPose`, which wins over `clip`. Omitted when it has none. |
| `nodes[i].copiesFromPoseKey`, `derivePathKey`, `derivePoseKey`, `layoutKey` | `string?` | Registry keys for the node's other function fields. Omitted when absent. |
| `nodes[i].dependsOn` | `string[] \| 'children'?` | Ids the node's geometry derives from. |
| `nodes[i].pickable`, `hidden`, `locked`, `units` | | Present only when stated: `pickable: false`, `hidden: true`, `locked: true`, a unit scope. |
| `nodes[i].page` | `PageInfo?` | Makes the node a page: its `name` and `meta`. Present only on a page, a child of the page run. |
| `nodes[i].pageRun` | `PageRunInfo?` | Makes the root the page run: its layout (`direction`, `gap`, `align`) and `pasteboard`. Present only on the run. |
| `doc` | `Record<string, unknown>?` | The scene's document values (below). Omitted when it has none, so a snapshot written before they existed reads the same. |

## Document values

Document state that is not a node, such as a document's theme, lives in `scene.doc`, a set of named JSON values
beside the tree. Keys are namespaced by their owner: `diagram:theme`, `diagram:type`. A document's pages are nodes,
not a value (`nodes[i].page`, `pageRun`); a snapshot that kept them as the `core:pages` value converts on load
(`adoptLegacyPages`).

```ts
scene.doc.set('myapp:title', 'Floor plan');
scene.doc.get<string>('myapp:title');
scene.doc.set('myapp:title', undefined); // removes the key
```

A `set` is a scene edit like any other: it is undoable, joins an enclosing `scene.batch` as part of one entry, is
skipped when the new value is deep-equal to the current one, and notifies `subscribe`. Values are JSON and are not
to be mutated once set. `toJSON()` writes them under `doc`; `sceneFromJSON` and `loadState` read them back, and
`createScene` or `useScene` take `doc` for the values a scene starts with, outside history. An app that loads node
specs itself reads a snapshot's values with `docFromSnapshot` (`@weasel-js/editor`).

## Function fields and the registry

A node's `clipFromPose` is a function, which JSON cannot carry; so are `copiesFromPose`, `derivePath`,
`derivePose` and a `layout`.
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

// Add a group that clips to an ellipse:
scene.add({
  kind: 'group',
  layer: 'shapes',
  pose: { x: 0, y: 0, width: 200, height: 200 },
  data: { label: 'Clipped group' },
  clipFromPose: registry.clipFromPose!['ellipse'],
});

// Save: the JSON carries `clipFromPoseKey: 'ellipse'` on the group.
const json = scene.toJSON();

// Load: resolve the key back to the live factory.
const loaded = sceneFromJSON(json, { registry });
```

A scene with no function fields needs no registry: omit it from both calls.

A key the registry lacks makes the load throw. `sceneFromJSON(json, { unknownKeys: 'skip' })`, and
`scene.loadState(json, { unknownKeys: 'skip' })`, load such a node without that function instead, for a save
that outlived the code that registered it; `onSkip` hears each key left out, as `{ id, field, key }`.

## What is NOT serialized

- **History.** A restored scene starts with empty history. To keep undo across a reload, save
  `scene.serializeHistory()` beside the snapshot and hand it to `scene.restoreHistory()` once the
  snapshot has loaded; `useSessionPersistence` (`@weasel-js/editor`) does both.
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
  cannot carry (functions, class instances, `undefined`), and writes a typed
  array as an object unless `serializeReplacer` tags it.

## Error cases

`sceneFromJSON` and `scene.toJSON()` throw on unrecoverable problems rather
than silently losing data.

| Condition | Thrown by | Message pattern |
|---|---|---|
| Unknown JSON version, or a snapshot missing a field every reader needs (`SnapshotShapeError`) | `sceneFromJSON`, `loadState` | `Scene: malformed snapshot: unsupported version <n>; versions 1, 2 and 3 are supported` |
| Unknown registry key, without `unknownKeys: 'skip'` (`SnapshotKeyError`) | `sceneFromJSON`, `loadState` | `Scene: unknown <field> key '<key>'. Register a function with this key in the registry option.` |
| Child on a layer below its parent's | `sceneFromJSON`, `loadState` | `Scene: cannot place node '<id>' on layer '<layer>' under parent '<pid>' on layer '<plyr>' — a child may not render below its parent's layer` |
| Node with a function field (`clipFromPose`, `layout`, …) not registered in the scene's registry | `scene.toJSON()` | `Scene.toJSON: node '<id>' has <field> but no matching registry key. The function must be registered via createScene's registry option to round-trip.` |

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

`toJSON()` writes version 3, which stores a child's pose in its container's frame. `sceneFromJSON` and `loadState`
read versions 1, 2 and 3, so consumers write no migration code for the scene's own format. Versions 1 and 2 stored
world poses, and a load makes them local through the scene's composition (the `composition` option; rigid by
default). Version 1 named the kinds `leaf` and `container`: a `leaf` loads as a mark, and a `container` as a
group, unless the `classifyV1` option returns `'mark'` for it, which is how a consumer keeps a container that drew
itself drawing. Version 1 clipped every container with no `clipFromPose` to its outline, so such a container that
loads as a group gets `clip: 'outline'`, and so does one whose clip key was skipped. One that `classifyV1` makes a
mark gets no clip: the loader cannot know which painter will claim it, so a consumer whose marks should clip sets
`clip` itself.

### Your own data's versions

The shape of `data` is the app's, and so is its version. Keep the version as a document value
(`scene.doc.set('myapp:schema', 2)`), and migrate older data as the nodes load: `nodeSpecsFromSnapshot`
(`@weasel-js/editor`) hands each node's data to the reviver it is given.

```ts
import { docFromSnapshot, nodeSpecsFromSnapshot, reviveTypedArrays } from '@weasel-js/editor';

const schema = Number(docFromSnapshot(json)?.['myapp:schema'] ?? 1);
const migrate = (data: MyData): MyData => (schema < 2 ? upgradeToV2(reviveTypedArrays(data)) : reviveTypedArrays(data));
const scene = useScene({ systemLayers, initial: nodeSpecsFromSnapshot(json, registry, migrate), doc: { ...docFromSnapshot(json), 'myapp:schema': 2 } });
```
