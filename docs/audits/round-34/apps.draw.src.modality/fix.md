- Breadcrumb's mode-target label goes stale after a rename or while text is typed (A+B): fixed 8419cbf038
- `enterModeOn` does nothing when a different soft mode is asked for on the same target, which also leaves path-edit open after a text edit on that node (A+B): fixed 7e62bc0068

No extra defects found. Neither fix has a changeset: `apps/draw` has no package manifest and isn't published, so no consumer sees either change.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `apps/draw/src/modality/enterModeOn.test.ts`: pass (5 tests; the new one failed before the fix)
  - `apps/draw/src/modality/useModeTargetLabel.test.tsx` (new file): pass (2 tests; the scene-change one failed before the fix)
  - `apps/draw/src/modality/pathEditHost.test.tsx`: pass
  - `apps/draw/src/modality/canvasModes.doubleClick.test.tsx`: pass
  - `apps/draw/src/useTextEditSession.test.tsx`: pass
  - `apps/draw/src/modality/enteredGroup.test.tsx`: pass
  - `apps/draw/src/modality/integration.endToEnd.test.tsx`: pass
  - `apps/draw/src/modality/pathToEdit.test.ts`: pass
- `npm run typecheck:packages`: not applicable, since it only covers `packages/*` and I changed no package. Instead I ran TypeScript 7's `tsc --noEmit -p apps/draw --rootDir .`: 0 errors in the files I changed. The program reports 19 errors in files I didn't touch, none under `apps/draw/src/modality`. I didn't check whether they predate this work.
- eslint on the 4 changed files: pass
- `npm run check:size`: pass ("no file or function grew past its cap")
- `npm run check:changesets`: pass ("OK — 1354 changeset(s)")
- Tree is clean; `.skulk/` is untouched.