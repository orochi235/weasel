- Simplify slider: canceling a drag leaves Sand's tolerance at the canceled value (A): not a defect. On Escape the Slider sends the value the drag began from to `onInput` before it calls `onCancel` (`useThumbDrags.ts` `finish`; "Edit callbacks" in `docs/conventions.md`), so `onTolerance` puts the tolerance back. I checked with a throwaway test: drag with the pointer, press Escape, and the slider and Sand's saved tolerance are both back at their start values.
- Offset slider: canceling a drag leaves the slider at the canceled distance (A): not a defect, for the same reason. `setDistance` gets the start value back before `onCancel`, and the same throwaway test showed it.
- Picking a color drops an alpha the swatch holds in `opacity` (B): fixed 433b7b8474. The color context now reads alpha through `toolOptionPaint` and `paintAlpha`, and writes paints in `toolOptionPaint`'s spelling (six hex digits, alpha as `opacity`). The same fix covers `focusedAlpha` and `setFocusedAlpha`. `setFocusedColor` now returns the paint it set.
- A picked color gives the swatch and the selection two different alphas (B): fixed 2ac38161d1. `usePickColor` now sends `setFill` or `setStroke` the same `{ paint }` the context just set, as the swatch's own edit does.
- Live symmetry makes its first group while a redo is pending, which drops the redo (B): fixed 9efc82777e. With no group to draw into, it now waits out a pending redo whether or not it ever held a group. This was a behavior call, so it is recorded in `docs/unruled.md` under "Audit round thirty-five (2026-11-17): draw". The cost: after you turn Symmetry on with a redo pending, the shape that clears the redo is drawn unmirrored. The open P3 TODO about Symmetry being a pref or document state covers the same wait.

No extra defects found. None of the fixes has a changeset: they are all in `apps/draw`, which is not a published package.

Checks:
- `npx vitest run --maxWorkers=1 apps/draw/src/tools/colorContext/ColorContextProvider.test.tsx`: pass (8)
- `npx vitest run --maxWorkers=1 apps/draw/src/usePickColor.test.tsx` (new file): pass (1)
- `npx vitest run --maxWorkers=1 apps/draw/src/useSymmetry.test.tsx`: pass (10)
- The other tests in `apps/draw/src/tools/colorContext/` (`ColorContext`, `actions`, `contribution`) and `apps/draw/src/surfaces/loupeAsset.test.tsx`: pass
- `npm run typecheck:packages`: not run, because no package changed. Draw has no working standalone program, so I compiled `apps/draw/tsconfig.json` with TypeScript 7 and filtered for the changed files: no errors in them. The root `npm run typecheck` was not run.
- eslint on the six changed files: pass
- `npm run check:size`: pass
- `npm run check:changesets`: pass
- The working tree is clean, with three commits on top of 94b5e4bf6a.