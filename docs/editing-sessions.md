# Documents and editing sessions

Who owns what over one scene: the document every editor of it shares, and the editing sessions that each
select, preview and scroll on their own. For anyone wiring two canvases, a canvas and a 3D host, or a panel
and a main view over one scene, and for anyone changing selection, previews, scrolling or history in core.
Designed and built 2026-11-14 (`packages/core/src/core/scene/editingSession.ts`, `sessionHost.ts`).

## What each owns

| Owner | Holds | Shared by |
|---|---|---|
| **Document** (the `Scene`) | nodes, layers, document values, ops, edit passes, the one history and its journals | every session over it |
| **Editing session** | the selection, pose previews (`overrides`), scroll offsets (`scroll`), and so the context actions run in | every canvas and view handed that session |

A `Scene` is its document *and* its default session: `scene.getSelection()`, `scene.overrides` and
`scene.scroll` are the default session's. That is the convenient default, and one canvas over one scene
needs nothing else.

`createEditingSession(scene)` (or `useEditingSession(scene)` in a component) opens another. A session is a
`Scene` in every respect, so anything that takes a scene takes one: `<SceneCanvas scene={session}>`, a
kernel3d world, an action's `scene` dep. Its document members read through to the scene; its session
members are its own, and `session.document` is the scene. Given a session, `createEditingSession` opens
another over the same document. A session is held weakly: drop every reference and it is gone, with nothing
to close. A `documentOf` reading holds no session state, so a session cannot be opened over one.

## Canvases and views

The canvas is the unit that holds a session: everything a `<SceneCanvas>` paints, picks and dispatches reads
the scene or session it was handed as `scene`. Two canvases handed one session share its selection, previews
and scroll; handed different ones, they keep each apart.

A `<CanvasView>` on a canvas acts on that canvas's session (ruled 2026-11-14). It had `selection` and
`selectionOptions` props for a selection of its own, but it painted the canvas's previews and scroll, and the
canvas's marquee and lasso deps wrote the canvas's selection, so what it owned was a fraction of a session. A
view that must select or preview apart is a canvas of its own over its own session.

## History: one per document

Sessions never create history. Every session's edits go on the document's one stack, and any session can
undo any entry. What each entry restores is a selection, and which session it restores into is the rule
(ruled 2026-11-14):

- **An edit records the selection of the session it was made through**: a call on a session — `setPose`,
  `batch`, `applyBatch`, `history.apply` — runs with that session acting, and a call on the scene with the
  default session acting.
- **An undo or redo restores into the session that steps history**, whichever session made the entry. The
  stepping session's selection as it stepped is what the entry restores next time it moves the other way, so
  a redo after another session's undo restores what that session held.
- **A refused edit puts back the acting session's selection.**
- **A removed, hidden or locked node leaves every session's selection**, and `loadState` clears every
  session's previews and scroll and keeps each selection to the ids the snapshot holds.

The rule follows where the user is looking: an undo selects what it changed in the canvas it was pressed in.
A consumer building a second `History` over the scene (a mode machine) passes
`sceneHistorySelection(session)` to restore into a session the same way.

## Changes and subscriptions

A session's `subscribe` hears every document change and its own selection; its `getVersion` moves with
either, and its `getContentVersion` is the scene's. The scene's subscribers do not hear another session's
selection. Previews and scroll notify through their own `subscribe`, as on the scene.

## Two dimensions, one document

kernel3d puts a `Pose3` scene in core's `Scene`, so a 2D canvas and a 3D host share a document by being handed
the scene or sessions over it. Each reads previews and scroll from what it was handed: a 3D view dragging
through its own session previews only there, and its committed edit reaches every session.

## Not covered

- Session state is never serialized. A reloaded history's ops replay through the adapter
  `setHistoryAdapter` was given, so a recorded selection op writes whichever session that adapter writes.
- Shown-state memos (`nodeMemo`, derived poses) are kept per node, keyed on the pose and data references
  they read and rechecked by value, so two sessions previewing one node read their own answers, at the
  cost of recomputing as they alternate.

## Migrating from 1.x

```tsx
// before: a panel view with a selection of its own
<SceneCanvas scene={scene}>
  <CanvasView id="panel" bounds={PANEL} selectionOptions={{ mode: 'multiple' }} />
</SceneCanvas>

// after: a canvas of its own over a session of its own
const session = useEditingSession(scene);
<SceneCanvas scene={scene} />
<SceneCanvas scene={session} selectionOptions={{ mode: 'multiple' }} />
```

`CanvasView`'s `deps` no longer takes a `selection` either.
