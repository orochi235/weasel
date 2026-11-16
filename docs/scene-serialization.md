# Scene Serialization

`scene.toJSON()` and `sceneFromJSON()` let you snapshot and restore a scene's
current state — nodes, hierarchy, layer visibility/locked state, and function
fields like `clipFromPose`. The snapshot is in-memory data that a structured clone (IndexedDB, `postMessage`)
carries as it is. As JSON it goes through core's snapshot codec: a kit path keeps its commands and coords in
typed arrays, which plain `JSON.stringify` writes as objects of numbered keys. History (undo/redo stacks) is not in
the snapshot; the document envelope below carries it beside one.

## Quick example

```ts
import { createScene, parseSnapshot, sceneFromJSON, stringifySnapshot } from '@weasel-js/core';
import type { SavedScene, SnapshotText } from '@weasel-js/core';

// Build a scene however you like, then save it:
const scene = createScene({
  systemLayers: [{ id: 'default' }],
  initial: [/* ... */],
});

localStorage.setItem('mySaved', stringifySnapshot(scene.toJSON()));

// Later, in a different session. Storage hands back a plain string, so say what it encodes:
const text = localStorage.getItem('mySaved')! as SnapshotText<SavedScene<MyData, 'default', MyPose>>;
const loaded = sceneFromJSON(parseSnapshot(text), {});
```

## Encoding: snapshots and their JSON

A snapshot and its encoded form are different types. `Encoded<T>` is `T` as plain JSON, and `SnapshotText<T>` is
that JSON as text; neither can be handed to a loader by mistake, nor a snapshot stored as JSON.

| Call | Takes | Gives |
|---|---|---|
| `encodeSnapshot(value)` | a snapshot | `Encoded<T>`: JSON any storage adapter keeps exactly |
| `decodeSnapshot(encoded)` | an encoded value, as stored | a copy of the snapshot; the stored value is left as it is |
| `stringifySnapshot(value)` / `parseSnapshot(text)` | the same, through text | |
| `snapshotReplacer` | | the `JSON.stringify` replacer, for a larger payload holding snapshots (a clipboard's) |

Encoding tags each typed array (`{ "__ta": "f32", "data": [...] }`), writes each number JSON cannot (`NaN`,
`Infinity`, `-Infinity` and `-0`, which plain `JSON.stringify` writes as `null` and `0`) by name, as
`{ "__num": "Infinity" }` and, inside a typed array's `data`, as the bare name, and writes any value of yours that
decoding would read as something else inside a `{ "__raw": … }` wrapper. So any JSON-safe data, and every number,
round-trips. Decoding also reads a path's `commands` and `coords` as saves from before tagging wrote them, as plain
arrays of numbers. A `null` a save from before numbers were named wrote for one reads as `null`: what that save
lost stays lost. The codec
is also published as `@weasel-js/core/json`, which loads without React, for a Node process; the document envelope
below is in the main entry only, since it is typed against the scene.

The codec lives in core, not a package of its own: it is written against core's snapshot and history types, and
code that needs core and is not a functional area of its own stays there (decided 2026-11-14). The typed-array
tagging under it is `@weasel-js/geom`'s, which needs nothing else.

## The document envelope: a scene and its history

An undo history is recorded against one tree, and replayed over any other it writes the wrong content. The envelope
carries both, the history paired with a fingerprint of the scene it was saved beside:

```ts
import {
  decodeSceneDocument, defaultCommitAdapter, encodeSceneDocument, restorePairedHistory, sceneFromJSON,
} from '@weasel-js/core';

const file = JSON.stringify(encodeSceneDocument(scene));
// { "format": "weasel/scene-document", "version": 1, "scene": { …encoded… }, "history": { "scene": "<fingerprint>", "history": { … } } }

const doc = decodeSceneDocument(JSON.parse(file));   // throws SnapshotShapeError on anything else
const loaded = sceneFromJSON(doc.scene, { registry });
loaded.setHistoryAdapter(() => defaultCommitAdapter(loaded));
restorePairedHistory(loaded, doc.history);           // { status: 'restored', report } | { status: 'unpaired' | 'mismatched' | 'stale' }
```

`restorePairedHistory` compares the fingerprint against the scene it restores onto, so it refuses a history saved
beside other content (`'mismatched'`), whether that is another document, a tree the load rebuilt (pages adopted
from a `core:pages` value), or content an application migration rewrote. Call it after any migration of the loaded
data. Its third argument is `restoreHistory`'s options, so it is strict the same way (see "Restoring history"
below) and its report comes back under `report`. A history kept apart from its scene, as `useSessionPersistence` (`@weasel-js/editor`) keeps them under two
keys, is paired the same way with `pairHistory(scene)`. `encodeSceneDocument(scene, { history: false })` leaves the
history out.

### Versions, and whose migration is whose

| Version | Of | Migrated by |
|---|---|---|
| envelope `version` (1) | the envelope's own shape | `decodeSceneDocument`, which reads version 1 only |
| scene `version` (1, 2, 3) | the scene's tree and poses | `sceneFromJSON`, `loadState` (below) |
| history `form` (`SCENE_HISTORY_FORM`) | how undo entries are recorded | nothing: a history in another form is `'stale'` and not restored |
| your data's schema | `data`, `pose`, document values | the application, after decoding and before restoring history |

The engine migrates its own formats and never reads into `data`. An application keeps its schema version as a
document value and migrates its data once the snapshot is decoded (see "Your own data's versions").

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
| `systemLayers` | `SerializedLayer[]` | Every layer, system and user, in order: its id, and only what differs from the defaults (`visible: false`, `locked: true`, `parallax`, `annotation: true`). A user layer adds `kind: 'user'` and its `name`. |
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
| `nodes[i].pickable`, `hidden`, `locked`, `units`, `consumesChildren` | | Present only when stated: `pickable: false`, `hidden: true`, `locked: true`, a unit scope, `consumesChildren: true` (its children are operands drawn only through it, as in a boolean group). |
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
specs itself reads a decoded snapshot's values with `docFromSnapshot` (`@weasel-js/editor`).

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

- **History.** A restored scene starts with empty history. To keep undo across a reload, save the
  history paired with the scene (the document envelope above) and restore it with `restorePairedHistory`
  once the snapshot has loaded; `useSessionPersistence` (`@weasel-js/editor`) does both.
- **Selection.** Selection belongs to an editing session (the scene's default
  one, or one from `createEditingSession`), not the document, so `toJSON()`
  leaves it out and `sceneFromJSON` starts with none; restoring it is the caller's job
  ([editing-sessions.md](./editing-sessions.md)).
- **Pose overrides** (`scene.overrides`) — ephemeral per-node pose/alpha for a
  frame loop. Like selection, never document content: absent from `toJSON()`,
  never restored by `loadState`, and never recorded in history. Bake with
  `setPose` first if a frame's positions should survive a save.
- **Tool state.** The active tool, any in-flight gesture, and scratch state are
  not part of `Scene`.
- **View / viewport.** Camera position and zoom are not captured.
- **`TData` / `TPose` JSON-safety.** The kit serializes whatever is in `data`
  and `pose` as-is. The codec carries typed arrays and every number; JSON still drops or corrupts
  what it cannot carry (functions, class instances, `undefined`).

## Error cases

`sceneFromJSON` and `scene.toJSON()` throw on unrecoverable problems rather
than silently losing data.

| Condition | Thrown by | Message pattern |
|---|---|---|
| Unknown JSON version, or a snapshot missing a field every reader needs (`SnapshotShapeError`) | `sceneFromJSON`, `loadState` | `Scene: malformed snapshot: unsupported version <n>; versions 1, 2 and 3 are supported` |
| Unknown registry key, without `unknownKeys: 'skip'` (`SnapshotKeyError`) | `sceneFromJSON`, `loadState` | `Scene: unknown <field> key '<key>'. Register a function with this key in the registry option.` |
| Child on a layer below its parent's | `sceneFromJSON`, `loadState` | `Scene: cannot place node '<id>' on layer '<layer>' under parent '<pid>' on layer '<plyr>' — a child may not render below its parent's layer` |
| Node with a function field (`clipFromPose`, `layout`, …) not registered in the scene's registry | `scene.toJSON()` | `Scene.toJSON: node '<id>' has <field> but no matching registry key. The function must be registered via createScene's registry option to round-trip.` |

## Restoring history

`scene.restoreHistory(snapshot)` rebuilds each recorded op. A kind taught with `registerOp` rebuilds as
the scene's own op. Anything else was handed to `applyBatch` (a selection change, an app's own op) and
rebuilds through the scene's op registry (`createScene({ opRegistry })`, `defaultOpRegistry` when none is
given), applying against the adapter `scene.setHistoryAdapter` supplies, which must be set before the
restore.

The restore is strict unless told otherwise (2026-11-14):

| What goes wrong | Strict (default) | `{ recovery: 'best-effort' }` |
|---|---|---|
| No factory or registered kind has the op's name | Throws `HistoryRestoreError`; the history is left as it was | The op becomes a placeholder that changes nothing, so its entry keeps its place |
| An `applyBatch` op while no history adapter is set | Same | Same |
| A snapshot in another recorded form | Same | Dropped: the report says `restored: false` |
| A restored op's adapter was cleared before an undo or redo | Throws `RestoredOpError` (`reason: 'no-adapter'`) | The op is skipped |
| A restored op throws on undo or redo | Throws `RestoredOpError` (`reason: 'threw'`, the original as `cause`) | Same: a swallowed throw would hide a partial write |

Both modes return a report, `{ restored, unresolved }`, listing each op it could not rebuild with its
entry and reason; `HistoryRestoreError.report` carries the same. `onSkip` hears each op a best-effort undo
or redo steps past. None of this depends on the debug flag, so a production build can log it or show it.

When an undo or redo throws, its entry stays on the stack it was on and the scene's nodes are as they
were. The engine takes back the ops before the failing one; the scene reverts its own writes, the
failing op's included. An op writing outside the scene has to be atomic itself: its `apply` either
completes or throws having changed nothing (the rollback contract on `Op`, `@weasel-js/history`).

```ts
try {
  scene.restoreHistory(saved);
} catch (err) {
  if (!(err instanceof HistoryRestoreError)) throw err;
  // Keep what can be kept, and say what was lost.
  const { unresolved } = scene.restoreHistory(saved, { recovery: 'best-effort' });
  report(`Undo history kept ${unresolved.length} op(s) this version cannot replay as no-ops`);
}
```

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
(`@weasel-js/editor`) hands a copy of each node's data, already decoded, to the migration it is given.

```ts
import { parseSnapshot, type SavedScene, type SnapshotText } from '@weasel-js/core';
import { docFromSnapshot, nodeSpecsFromSnapshot } from '@weasel-js/editor';

const json = parseSnapshot(text as SnapshotText<SavedScene<MyData, MyLayer, MyPose>>); // the engine's decoding
const schema = Number(docFromSnapshot(json)?.['myapp:schema'] ?? 1);
const migrate = (data: MyData): MyData => (schema < 2 ? upgradeToV2(data) : data);
const scene = useScene({ systemLayers, initial: nodeSpecsFromSnapshot(json, registry, migrate), doc: { ...docFromSnapshot(json), 'myapp:schema': 2 } });
```

A history saved beside the old data does not restore over the migrated scene: its fingerprint no longer matches.
