# Audit 29 — labs (reviewer A)

## The lab's camera and mark-store registries stack by design but warn of a clash every time they stack
- where: packages/labkit/src/canvas/cameraRegistry.ts:23 (createCameraRegistry), packages/labkit/src/annotations/labMarkStores.ts:22 (createLabMarkStores); warning in packages/registry/src/reflectable.ts:239 (push)
- scenario: both registries document "registrants for one key stack, newest live" (a trial with two cameras — `CameraInput`, `Orbit`, `useSceneCamera` each `usePublishCamera` under the trial id, and `usePublishCamera` re-publishes on becoming active — or a second mark store for one trial, the case 98cd2d2a1d was written for). Both are built with `createReflectable({ name })` and no `layered: true`, and pass no `source`, so the second push under a trial id goes through `clashes.warn` in development: "weasel cameras: an unnamed registrant registered "<trial id>" over an unnamed registrant, which is not an engine default…". `layered` (added in 73f549ec09 for exactly this) is used by no registry in the tree. Should be `layered: true` on both.
- evidence: read
- severity: low

## The lab's undo, redo and snapshot chords also match by physical key, so on QWERTZ Ctrl+Y undoes and on Dvorak Ctrl+F redoes
- where: packages/labkit/src/lab/labChords.ts:42 (keySpec)
- scenario: `keySpec` gives every chord `code: \`Key${KEY}\`` beside `key`, and gestures' `matchKeyOrCode` (packages/gestures/src/ui/match.ts:95) accepts either. German QWERTZ: Ctrl+Y is code `KeyZ`, so it matches `lab.undo` by code and `lab.redo`'s Mod+Y by key, at equal specificity — first-registered `lab.undo` wins, and the redo chord undoes; Ctrl+Z (code `KeyY`) likewise matches both. Dvorak: Ctrl+F (code `KeyY`) is taken as redo and Ctrl+O (code `KeyS`) saves a snapshot, preventDefaulting the browser's own. The document listeners these replaced (`historyKey`, packages/gestures/src/ui/historyKey.ts) matched by `key` through `matchKeyEvent`, which already reaches non-Latin layouts via `chordKey`; a Mod chord has no macOS Alt-character problem needing `code` (the reason the loupe and pathfinder leaders use it). Drop `code`.
- evidence: read
- severity: medium

## labkit README's scene-instrument example cannot run: `drawPreset` and `useMemo` are never imported, and its `pen` tool is offered by nothing
- where: packages/labkit/README.md:394-420 (the `TrialSceneCanvas` example)
- scenario: 964a242853 dropped `drawPreset` from this block's `@weasel-js/core` import and added `import { drawPreset } from '@weasel-js/editing'` to the unrelated surface block (README.md:669) instead. Copying the scene block as written fails to compile — `drawPreset` (now `@weasel-js/editing`, packages/editing/src/presets/composites.ts:20) and `useMemo` are used but not imported (and `NODES` is undefined). With those fixed, `defaultTools={['rect', 'pen']}` still mounts no pen: core's only built-in tool is `hand` (packages/core/src/canvas/SceneCanvas/builtinToolSets.ts:11), `drawPreset` offers rect/ellipse/line/polygon/star/select/lasso, and path-tools exposes the pen only through `usePenTool`/`usePathToolsTools`, never as an offered tool id. `resolveToolRegistry` drops an unoffered `defaultTools` id without a warning (packages/core/src/canvas/SceneCanvas/toolRegistry.ts:50-55), so the example silently has no pen.
- evidence: read
- severity: low

## "Copy settings as JSON" copies an endless number as `null`, drops a cleared one, and copies stale values for auto paths
- where: packages/labkit/src/chrome/trialActions.tsx:62-72 (trialActions, `copy-settings`)
- scenario: the button copies `JSON.stringify(settingsConfig(ctx))`, where `settingsConfig` is the trial's raw `record.config`. (1) A leaf at its `.endless()` stop holds `Infinity` (numberNode.ts:75), which `JSON.stringify` writes as `null` — the copied "current config" says null where the trial runs endless; `-Infinity` likewise. (2) A `.clearable()` number left unset is `undefined` and its key vanishes from the copy. (3) An unpinned (auto) path copies the stale pinned value still stored at it (`TrialChromeContext.config` "stays raw", chrome/types.ts:236), not the value the instrument reports and runs with, and nothing in the copy says the path is auto, so pasting it back through `setConfig` pins a value the trial never used. The changeset/README promise "copies the trial's current config".
- evidence: read
- severity: low

## A key pressed in a trial's torn-out panel goes to whichever trial the lab last focused, not to the panel's own
- where: packages/labkit/src/lab/labChords.ts:50 (ownerNow); packages/labkit/src/clock/useTransportKeys.ts:110 (trialOf); packages/labkit/src/lab/useFocusPick.ts:16; panel frame packages/labkit/src/lab/Workspace.tsx:123 (PanelFrame)
- scenario: undock trial A's Settings section (as a tile or floating). Its body is portalled into `PanelFrame`'s `.lk-panel-tile__body`, a Workspace child with no `data-trial-id`. Click trial B, then drag a slider in A's undocked panel and press Mod+Z: `ownerNow` finds no `[data-trial-id]` ancestor of the focused slider and falls back to the lab's focused trial, B — and `useFocusPick` never moved focus to A, since its `closest('.lk-trial[data-trial-id]')` also finds nothing from the panel. B's last step is undone (Mod+S snapshots B; a keyed `TrialTransport`'s Space/arrows likewise act on B's). The panel's key is `panelKey(trialId, sectionId)`, so the frame knows its owner and could carry it.
- evidence: read
- severity: medium

## Mod+S in a text field no longer saves a snapshot: it now falls through to the browser's Save Page dialog
- where: packages/labkit/src/lab/labChords.ts:95-108 (`lab.snapshot`), filtered by packages/routing/src/interactions/dispatcher/channels/keyboard.ts:78 (`isEditableTarget`)
- scenario: focus a trial's Settings number or text field (or any input the instrument renders) and press Mod+S. Before fc010174f6 the trial's document listener matched `SNAPSHOT_SHORTCUT` with no editable check, preventDefaulted and saved a snapshot (only the undo chords skipped text fields, via `undoKeyStep`). Now the chord is a lab action on the keyboard channel, whose `onKeyDown` returns before dispatch for any editable target, so nothing preventDefaults: no snapshot is saved and the browser opens "Save page as…". The commit names only menus and modals as places the dispatcher's filters newly keep the key; Mod+S is not a text-editing chord a field owns.
- evidence: read
- severity: low

## forge's frame scroll table keeps an entry for every trial ever reported, closed ones included
- where: packages/forge/src/shell/loupe/frameScroll.ts:12 (`frames`), written by reportFrameScroll:20
- scenario: each isolated trial's frame reports its scroll under its trial id into a module-level `Map`; nothing deletes an entry when the trial closes or its link closes (`closeLink` in shell/frameLink.ts:53 does not touch it). A long workshop session opening and closing isolated trials grows the map without bound, and a stale position stays readable by `scrollOf` for any host that later carries that id. Small per entry, but a cache with no reaper.
- evidence: read
- severity: low

## A job without `auto` ignores its `key`: a key change neither aborts the run in flight nor re-runs it, contrary to its docs
- where: packages/labkit/src/job/useJob.ts:121-132 (key effect); docs at job/types.ts:19-21, instrument/types.ts:281-282, README.md:310
- scenario: an instrument declares `job: { key: (c) => [c.size], run, onItem }` without `auto`, and the user presses Start. Mid-run they change `size`. The key effect returns at `if (!auto)` (only an epoch change cancels), so the run keeps going and `onItem` folds items computed for the old `size` into state for the new one, and nothing re-runs. `JobCapability.key` says "Re-run whenever this value changes", `Instrument.job` says the runtime "aborts it on unmount and on a `key` change", and the README's capability table says the same; only `auto` jobs behave that way.
- evidence: read
- severity: medium

<!-- done: 8 findings, files read: 46 -->
