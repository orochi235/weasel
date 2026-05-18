# Swillustrator v0 — deferred work

The post-purge rebuild (chore/swill-rebuild) shipped a minimum-viable editor.
Subsystems intentionally deferred:

## Deferred from the pre-purge App.tsx

- **Recording / Replay.** ActionBar still shows the record/play buttons, but
  the handlers in App.tsx are no-ops. `recorder.ts`, `recordingIO.ts`, and
  `replay.ts` survive in src/ ready to be wired back in — the rebuild needs
  to thread a `Recorder` instance through the canvas's pointer/keyboard
  surface (probably via a tools wrapper or a top-level event-capture handler).

- **Disclaimer modal.** No first-run modal; consider re-adding once we have
  a sensible "this is alpha" copy.

- **Toasts.** `Toasts.tsx` exists; not mounted. Wire a toast host if we
  start surfacing errors (save failures, SVG parse errors).

- **Command palette.** No `Cmd-K` palette. The Actions Registry now exposes
  every action with stable ids, so a palette can iterate `registry.list()`
  and trigger by id — straightforward port.

- **Preferences modal.** `PreferencesModal.tsx` and `prefs.ts` still exist
  but no UI mounts them. The ActionBar gear button calls a stub.

- **In-place text editing overlay.** Text-tool creates a leaf with default
  text; no double-click-to-edit affordance yet. Kit has
  `enterTextEditAction` registered — wire its dep source to surface the
  edit UI.

- **Groups.** SceneCanvas's standard actions register `group` / `ungroup`,
  but Swillustrator's `groupMembership.ts` helpers aren't connected; we
  rely on whatever the kit's default group action does.

- **Custom HUD / grid layers.** Grid toggle in the ActionBar exists but
  the SceneCanvas grid slot isn't actually wired to it — the toggle only
  flips a useState. To honor it, pass `layers={{ grid: gridVisible ? { ... } : null }}`.

- **Snap-to-grid.** Toggle present, not wired. Pass
  `selectTool.snap = gridSnapStrategy(...)` conditionally.

- **SVG round-trip.** Open / Save buttons are no-ops. `svgInterop.ts`
  survives in src/ — needs adaptation to our `SwillData` shape (currently
  expects the legacy `Obj`).

- **Compound-path release.** Button present and disabled; wire to
  `splitSubpaths` once the selection model surfaces a compound-path leaf.

- **Paper-size background.** `paperSize` controls canvas width/height,
  but there's no paper-shaped background node or printable bleed area.

- **Persistent history.** `historyPersistence.ts` round-trips
  `SerializedHistory` through IndexedDB; the v0 rebuild persists only
  `scene.toJSON()` to localStorage (no undo stack across reloads).

## Kit gaps surfaced during the rebuild

None — the surviving pieces of the kit covered the v0 needs with minor
shape adaptations. ColorContext's `updateSelected` expects the legacy
`Obj` shape; App.tsx adapts via `buildUpdateSelected` (fakes a stub Obj
so only fill/stroke/strokeWidth round-trip). Worth revisiting if
ColorContext ever moves into the kit proper.
