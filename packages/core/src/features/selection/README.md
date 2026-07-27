# selection

Two unrelated things that both concern selection: the **overlay render layers**
and an **ambient context** for publishing selection to non-canvas UI.

## `overlay.ts` — drawing the selection

Three pieces, composed by `createSelectionOverlayLayer` (outline pass, then
handles pass, in one `RenderLayer`):

- **`composeSelectionPose`** — resolves the *live* pose for a selected id.
  Precedence: the move overlay first, then the resize overlay, then the stored
  pose. This is why the outline tracks a drag in real time instead of snapping
  at commit — the stored pose hasn't changed yet mid-gesture.
  When `getChildren` / `isContainer` are supplied and the id is a container,
  the result is the union AABB of all transitive leaf poses, with the same
  precedence applied per leaf.
- **`createSelectionOutlineLayer`** — the outline rect per selected id.
- **`createSelectionHandlesLayer`** — resize-handle rects (4 corners by
  default).

**Visibility is not decided here.** All three ask
[`../chrome-caps`](../chrome-caps/README.md) via `isVisible('selection.outline')`,
`isVisible('selection.resize-handles')`, `isVisible('selection.rotation-handle')`.
The matching hit-test in `canvas/affordanceAt.ts` asks the *same* ids, which is
what keeps visible-and-hittable in sync. If you add a new piece of selection
chrome, give it a chrome id and gate both paths on it — don't add a local
boolean.

## `SelectionContext.tsx` — publishing selection

`@experimental`

A tiny ambient context so non-canvas UI (command palette, status bar,
breadcrumbs, undo-label generation) can read "what's selected" without
threading a prop through the tree.

**Single-slot, last-writer-wins.** The context holds one selection array;
whichever publisher called `publishSelection` most recently owns the slot. For
single-canvas pages — the typical case — this is invisible. Multi-canvas pages
get approximately "most recently rendered," which is a real limitation, not a
bug to be surprised by. A focus-aware v2 (claim on focus, release on blur) is
deferred until a genuine multi-canvas use case exists.

`<SceneCanvas>` publishes automatically when wrapped in a `<SelectionContext>`.
Bare-`<Canvas>` consumers opt in by calling
`useSelectionContext().publishSelection(ids)` themselves.
