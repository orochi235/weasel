Merging the image and audio runs dropped the image run's `at`, so Step never outlined its stage in a pipeline with audio stages (A): fixed 4fbacb945c

A slider's live preview values were recorded as undo steps, so a paused drag split into several steps and a canceled drag left a step that changed nothing (A+B): fixed 9326bbe359. Previews now go through a new `PipelineDoc.preview`, which records no undo step. `change` records one step from the doc as it was before the drag, and `cancel` puts the preview back. The 500 ms coalesce window is gone, so two quick drags are no longer merged either (B's case c). 8c319d93df adds the new `preview` and `cancel` to a test stub that typecheck flagged.

Replaced source images and the last one on unmount were never closed, leaking their ImageBitmaps (A+B): fixed 88e348af84. Closing one straight away could break a run still reading it. I added `EffectRunner.idle()` to `@weasel-js/diagram`, which settles once every run and step already asked for has finished. A replaced bitmap is closed after that, and the last one on unmount. Changeset `effect-runner-idle.md` (minor, `api`). The case B raised of a pick that finishes after unmount already worked: `chooseImage` closes a pick another pick has overtaken, and unmounting counts as one.

Adding a stage from the palette left the previously picked group armed for Ungroup (B): fixed cb126d2483

Leaving pipeline mode during an audio decode showed a "Could not read the audio" toast it shouldn't have (B): fixed cdd90079bf. A decode that fails for an unreadable file is still reported.

None of the chart fixes has a changeset: `apps/chart` has no package manifest, so it isn't published, and earlier chart fixes carry none.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time, all pass:
  - `ParamPanel.test.tsx` (6)
  - `pipelineAudio.test.ts` (7)
  - `pipelineRun.test.ts` (3)
  - `replacePicks.test.tsx` (2)
  - `usePipelineDoc.test.tsx` (13)
  - `pipelineCommands.test.tsx` (1)
  - `packages/diagram/src/effect/runner/runner.test.ts` (12)
- Not run, because no browser here: the `*.browser.test.tsx` files in `apps/chart/src/pipeline`. None of them exercises slider undo.
- `npm run typecheck:packages -- diagram`: pass ("1/1 diagram ok")
- `npm run typecheck` (chart isn't a package, so the root program covers it): pass, exit 0
- eslint on every changed file: pass
- `npm run check:size`: pass ("no file or function grew past its cap")
- `npm run check:changesets`: pass ("OK — 1332 changeset(s)")
- The tree is clean apart from `.skulk/`.