# Audit round 33, area `apps.chart.src.pipeline` (blind reviewer)

Note: the brief names frozen commit d4226fab0e3e2669740411edb2a1d35dadeb46b1, which does not exist in this
clone (`git cat-file` reports a bad object). The tree read is HEAD 4c701b3803; `git status` shows no
changes under `apps/chart`.

## ParamPanel records a slider's live `onInput` values as undo steps, so one drag can become several steps and a canceled drag leaves a no-op step
- where: apps/chart/src/pipeline/ParamPanel.tsx:28-29 (ParamField, `number` case) with ParamPanel.tsx:74-75 (`set` → `change(..., coalesceKey)`)
- scenario: both `onInput` and `onChange` call `set`, which calls `pipeline.change` and so `history.apply` every time. The edit protocol (docs/conventions.md, "Edit callbacks") says `onInput` is "never an undo step" and one drag commits once. Merging rests only on the history's 500 ms coalesce window, measured from the previous apply (packages/history/src/history.ts:161-162, 190). (a) A user drags a slider, holds it still for over half a second, then drags on: the drag lands as two or more "Set <label>" undo steps instead of one. (b) A user presses Escape mid-drag: the control sends the starting value to `onInput` and then calls `onCancel`, which isn't passed. The doc ends where it began, but the undo stack keeps a "Set <label>" entry whose before and after are equal, so the next Undo seems to do nothing. (c) Two separate drags of one slider within 500 ms merge into one step. Expected: preview `onInput` outside history (or in a held draft), commit once from `onChange`, and handle `onCancel`.
- evidence: read
- severity: medium

## Adding a stage from the palette leaves the previously picked group armed for Ungroup
- where: apps/chart/src/pipeline/PipelineWorkspace.tsx:53-56 (`add`), with pipelineGroups.ts:34-38 (Ungroup)
- scenario: a user picks group G, then activates a row in the Stages palette. `add` calls `pick(id, [id])`, which sets `picked` and `many` but not `pickedGroup`. `EffectEditor.addStage` only reports the change; it doesn't route through `useEditorPicks.pick`, so `onSelectGroup(null)` never fires. `group` stays G, and the editor and ParamPanel show the new stage as the pick (stage wins). Cmd+Shift+G (or Arrange › Ungroup, still enabled) then dissolves G, which the user can no longer see as picked. Expected: `add` clears `pickedGroup`, the same way an editor click does (useEditorPicks calls both `onSelect` and `onSelectGroup`).
- evidence: read
- severity: medium

## Chosen source images are never closed: each replacement, and the one held at unmount, leaks an ImageBitmap
- where: apps/chart/src/pipeline/pipelineRun.ts:80-83 (Choose Source Image… command), pipelineRun.ts:49 (`sources` state), pipelineRun.ts:99-107 (`chooseImage`)
- scenario: every Choose Source Image… pick replaces `sources` with a new `ImageBitmap` and drops the old one without calling `close()`. Nothing in `packages/diagram/src/effect` closes source bitmaps either (no `.close()` call there). Leaving pipeline mode doesn't close the current one, and a pick whose decode finishes after unmount is passed to `setSources` on a gone component and never closed. `chooseImage` closes only a pick a later pick has overtaken. Repeated picks of large photos keep decoded bitmap memory (GPU-backed in Chromium) until GC, which doesn't track bitmap size. Expected: close the previous bitmap on replace and on unmount (the test card is replaced the same way).
- evidence: read
- severity: low

## Leaving pipeline mode while an audio file decodes shows a spurious "Could not read the audio" toast
- where: apps/chart/src/pipeline/pipelineAudio.ts:81-90 (`chooseSource`), with the unmount cleanup at pipelineAudio.ts:69-72
- scenario: a user picks a long audio file, then switches to chart mode before `file.arrayBuffer()` or `decodeAudioData` settles. The cleanup disposes the engine, and so its context. `chooseSource` checks `mounted` only before `awake()`. After `arrayBuffer` resolves it calls `engine.context.decodeAudioData` on the disposed engine's context, or the decode in flight is cut off. It rejects, and pipelineRun.ts:85 reports it through `reportFailure('Could not read the audio')` in a mode that's already gone. The guard at line 55 shows the late-pick case was intended to be silent. Expected: check `mounted.current` (or tie the pick's `current()` to unmount) after each await, and swallow the rejection once unmounted.
- evidence: read
- severity: low

## Files read
apps/chart/src/pipeline/ParamPanel.tsx
apps/chart/src/pipeline/PipelineWorkspace.tsx
apps/chart/src/pipeline/StagePalette.tsx
apps/chart/src/pipeline/pipelineAudio.ts
apps/chart/src/pipeline/pipelineCommands.ts
apps/chart/src/pipeline/pipelineGroups.ts
apps/chart/src/pipeline/pipelineLook.ts
apps/chart/src/pipeline/pipelinePages.ts
apps/chart/src/pipeline/pipelineRun.ts
apps/chart/src/pipeline/usePipelineDoc.ts

<!-- done: 4 findings, files read: 10 -->
