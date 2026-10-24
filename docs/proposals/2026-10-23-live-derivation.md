# Live derivation: data overrides and published previews

Proposal (2026-10-23), for whoever builds or reviews `feat/live-derivation`. It answers why a node
deriving from another stops following it during an anchor drag or an in-place text edit, and what
fixes both. Delete it once the branch merges; the durable half goes to `docs/concepts.md` ("Pose
override").

## The cause

Derivation already reads a source's override `pose` *and* `path` (`SceneDep` in
`core/scene/effectivePose.ts`), so the hypothesis that it reads only the pose is wrong. Two other
things are missing:

- An anchor edit (and every action answering `previewPose` / `previewData` on its handle) never
  reaches the scene. Only the ghost layer reads the handle; move, resize and rotate are the only
  actions that publish to `scene.overrides`.
- Nothing can override a node's **data**. A text-along effect reads its text source's `data`, so
  the only way to show it a draft was to write the draft into the document.

## What is overridable, and who reads it

`PoseOverride` gains `data?(stored: TData): TData`: the data the node is shown with, worked out
from the data it stores, so a recorded write made meanwhile shows through. A writer changes what it
answers by replacing the function; the shown data is memoized on the stored data and the function.

`nodeAsShown(overrides, node)` is the one read: the node with its shown data, identical to `node`
when nothing overrides it, and the same object while neither input changes. These read through it:

| Reader | How |
| --- | --- |
| Derivation, effective reading | `SceneDep`, the canvas's `SlotDep`, the pick source's dependency lookup |
| Painting | both scene walks wrap `drawOne` (`wireSceneSlotToScene`, `buildSceneViewCommands`), so a live frame exported through `buildSceneViewCommands` shows it |
| Picking | `scenePickSource` hands the walk shown nodes; the pick index already keys on the override generation |
| Drawn bounds | `drawnBoundsScene` |

Excluded on purpose: the document reading (`documentDepOf`, edit passes), `scene.get`, history,
`toJSON` and file export, which describe the document.

## Public surface

- `PoseOverride.data`, and `PoseOverride` / `PoseOverrides` take `TData` (default `unknown`).
- `PoseHold.show(frame)`: publish pose and data per id; it never displaces another writer's entry.
- `nodeAsShown(overrides, node)`.
- `publishPreviews(scene, dispatcher)`: on each dispatcher notify, publishes every in-flight
  handle's `previewPose` / `previewData` through one hold, skipping `previewHidesSource: false`
  handles; releases when the handles end, after their commit has landed. `<SceneCanvas>` calls it.
- Text drafts become a `data` override; `sceneTextDrafts` writes nothing to the document until the
  commit.

## kernel3d

Nothing here assumes a 2D pose: the data override is pose-agnostic, the hold treats poses as opaque,
and `publishPreviews` takes core's dispatcher, which kernel3d drives. A 3D host that renders nodes
itself reads them through `nodeAsShown`; its pick index already invalidates on the override
generation.

## Rejected

- Publishing the anchor preview as the override's `path`: it needs a frame conversion per storage
  kind and drops extension data (spiro, corners) that shapes the outline from `data`.
- A text-specific override field: a whole-data override covers text and every other data edit.
- A `data` value rather than a function: a value hides a recorded write made during the edit,
  which is the very case the text TODO is about.
- Publishing from each action (`pathEditPreview`) rather than from the dispatcher: it leaves every
  other handle-preview action (girth, warp, paint scrub, waypoints) with stale dependents.
