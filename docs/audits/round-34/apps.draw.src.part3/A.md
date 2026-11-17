# Audit round 34 — apps.draw.src.part3

## Canceling a Simplify or Offset slider drag reverts the geometry but leaves the slider (and Sand's tolerance pref) at the dragged value
- where: apps/draw/src/ui/PathCommands/PathCommands.tsx:52 (SimplifySlider), :75 (OffsetSlider)
- scenario: drag the Simplify slider from 1.0 to 8.0, then press Escape (or the pointer session is canceled). `onInput` already called `onTolerance(8)` (writing Sand's persisted `tolerance` option) and `useActionEdit`'s draft falls back on cancel to its `value`, which is now 8, so `simplify.onCancel` → `edit.cancel()` restores the path while the slider shows 8 and the Sand brush's tolerance stays 8 for good. The same for OffsetSlider: `setDistance(next)` runs on every input, so after a cancel the slider shows the dragged distance though no offset was applied, and the next drag starts from it. Should be: a cancel puts the slider (and the pref) back where the drag began.
- evidence: read (useActionEdit.ts / useEditDraft: `shown` is `value` once no edit is running; nothing in onCancel restores `tolerance`/`distance`)
- severity: medium

## An empty sticky note is deleted when its edit ends, though its paper paints
- where: apps/draw/src/useTextEditSession.ts:14 (discardIfEmpty), called from onEnd at :53
- scenario: place a sticky (the sticky tool inserts a note with `text: ''` and opens it for typing, `stickyData` in text-tools), then click away or press Escape without typing; or clear all the text of an existing note. `discardIfEmpty` checks only `text`/`runs`, so the note — which has a `background` and draws a visible paper, edge and shadow — is removed. The function's own rationale ("a node that paints nothing and still picks") holds for a bare text box, not a note. Should be: a node with a `background` is kept.
- evidence: read (scenario inferred from stickyNode.ts:62–80 and this hook)
- severity: medium

## Release Compound's enabled state is computed at render from the scene, and goes stale on scene edits that don't re-render Workspace
- where: apps/draw/src/useEditorAmbient.ts:52 (useEditorAmbient, `canReleaseCompound`)
- scenario: `hasCompoundPath(scene, selection.current)` reads the scene during render, and `commandsChanged` only emits when `shown` changes after a render; neither Workspace nor Editor subscribes to the scene. An edit that changes the selected path's subpath count without changing the selection or anything else Workspace renders from (e.g. undo/redo of a path edit on the selected node, a path-edit command that adds or removes a subpath in place) leaves the "Release compound path" command enabled/disabled as it was until some unrelated re-render. Should be: derived from a scene subscription, as `run` in useSymmetry is.
- evidence: read (no scene subscription in Editor.tsx/Workspace.tsx; concrete triggering command inferred)
- severity: low

## Live symmetry stays "on" but stops mirroring once its group is deleted or undone away
- where: apps/draw/src/useSymmetry.ts:49 (useSymmetry layout effect)
- scenario: with Symmetry on, select all and delete (the group goes with it), or undo past the group's creation (`ctrl.create` is its own undo step). The effect re-runs only on `on`/`spec`/center/`onPage`/`run`; none changes, so no new group is made. `ctrl.active()` now returns null (controller.ts:99), so new shapes are drawn unmirrored while the toolbar shows Symmetry checked, until the user toggles it or changes the axis. Should be: the effect also reruns when the active group vanishes (subscribe to `ctrl`/scene), making a fresh one as it does after New/Open.
- evidence: read
- severity: low

## `colorKeepingAlpha` stores any 9-character string verbatim, skipping the normalization its doc and `mergeAlphaFromPrev` promise
- where: apps/draw/src/tools/colorContext/ColorContextProvider.tsx:71 (colorKeepingAlpha)
- scenario: a pick or typed value like `#FF8800CC` (or any 9-char non-hex string) returns as-is, while `mergeAlphaFromPrev` — which the same function calls for every other length — already runs a 9-char `#` value through `tryNormalizeHex`. So the swatch holds `#FF8800CC` while the same color arriving through the canvas `setFill` path is normalized, and an invalid 9-char string reaches the shared `fill` option unchecked. Should be: drop the shortcut and let `mergeAlphaFromPrev` decide.
- evidence: read (packages/paint/src/hexAlpha.ts:39)
- severity: low

## A saved page with `width="Infinity"` (or height) is read back as an infinite page
- where: apps/draw/src/svgPages.ts:25 (pagesOfParsed)
- scenario: `Number('Infinity') > 0` is true, so a file whose `wd:page` says `width="Infinity"` (hand-edited or written by another tool) passes the check and yields a page of infinite size, which the page run, the grid and fit-to-page then divide and lay out by. Should be: `Number.isFinite(width) && width > 0`, falling back to the one-page reading as for other malformed values.
- evidence: read
- severity: low

## The options strip's remembered height goes stale when it changes without `rows` changing, so a later row change pans by the sum
- where: apps/draw/src/useHoldContentUnderChrome.ts:16 (useHoldContentUnderChrome)
- scenario: the strip's height is sampled only when `rows` (Editor.tsx:116) changes. Narrow the window so the active tool's options bar wraps from one line to two (height 32 → 64, `rows` unchanged, nothing sampled), then switch to a tool whose bar is one line (64 → 32). `prev` is still 32 from the first sample, so `next === prev` and no pan happens though the strip just shrank by 32; or the reverse order pans by a delta that includes the earlier, uncompensated wrap. Content jumps by the wrapped amount. Should be: track the height with a ResizeObserver (or re-sample each layout), compensating only for changes this hook means to hold for.
- evidence: read (scenario inferred from the layout)
- severity: low

## Files read
apps/draw/src/svgNote.ts
apps/draw/src/svgObj.ts
apps/draw/src/svgPages.ts
apps/draw/src/testIcons.ts
apps/draw/src/testScenes.ts
apps/draw/src/theme.ts
apps/draw/src/toolOptions.ts
apps/draw/src/tools/colorContext/ColorContextProvider.tsx
apps/draw/src/tools/colorContext/actions.ts
apps/draw/src/tools/colorContext/contribution.ts
apps/draw/src/tools/colorContext/depSchemaAugmentation.ts
apps/draw/src/tools/colorContext/index.ts
apps/draw/src/ui/Fillet/Fillet.module.css
apps/draw/src/ui/Fillet/Fillet.tsx
apps/draw/src/ui/Fillet/index.ts
apps/draw/src/ui/LastOperation/LastOperation.module.css
apps/draw/src/ui/LastOperation/LastOperation.tsx
apps/draw/src/ui/LastOperation/index.ts
apps/draw/src/ui/PathCommands/PathCommands.module.css
apps/draw/src/ui/PathCommands/PathCommands.tsx
apps/draw/src/ui/PathCommands/index.ts
apps/draw/src/useDocumentState.ts
apps/draw/src/useEditorAmbient.ts
apps/draw/src/useGrid.ts
apps/draw/src/useHoldContentUnderChrome.ts
apps/draw/src/useLastTool.ts
apps/draw/src/useMachineFontOutlines.ts
apps/draw/src/usePathOverlays.ts
apps/draw/src/usePickColor.ts
apps/draw/src/useRightSidebarWidth.ts
apps/draw/src/useRulers.ts
apps/draw/src/useSessionPersistence.ts
apps/draw/src/useSpacingHints.ts
apps/draw/src/useSymmetry.ts
apps/draw/src/useTextEditSession.ts
apps/draw/src/useViewBounds.ts

<!-- done: 7 findings, files read: 36 -->
