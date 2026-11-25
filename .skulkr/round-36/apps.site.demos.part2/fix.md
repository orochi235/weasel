Geom dots drawn at their creation spot instead of their pose (A+B): fixed 492eee6d41

InsertDemo's rect tool inserts nothing because no features are on (A): fixed 63fe80d15b

ImageDemo's image tool inserts nothing because `insertPreset` is missing (A): fixed 63fe80d15b, in the same commit as InsertDemo (same mistake). I scanned every demo that uses an inserting tool, and all the others reach `insertPreset` through `editPreset`, `shapeToolsOfferedPreset` or `drawPreset`.

FontFallbackDemo ignores `registerCanvasFont`'s release and calls `unregisterCanvasFont` (A+B): fixed cdb00ba6db

LayeredCurveDemo's partition hit band covers the whole seam height and swallows both seam anchors (B): fixed 788668a01d. The hit test now covers only the drawn handle plus 4 px.

EffectChartPreviewDemo never closes the preview bitmaps it makes each frame (A): fixed 0879b3f25f

DrapeLabDemo writes a wheel-scrubbed radius outside the slider's 10–600 range (A): fixed 53dddd97ed

GeomDemo shows `NaN%` for the split share when the curve has zero length (B): fixed c43cbf5f4f

HistoryDemo uses `s.stack`, a class its stylesheet doesn't define (B): fixed 06e913278d. I dropped the class rather than inventing a style for it. The same commit adds `__tests__/cssModuleClasses.test.ts`, which checks that every demo's CSS module defines each class the demo reads; HistoryDemo was the only one that failed it.

Extra defects found while fixing:
- In EffectChartDemo, React StrictMode runs effects twice on mount in development, so the first frame's preview bitmaps are closed while still on screen. The next frame replaces them, so it is a one-frame blank in dev only. I left it. The kit's `useEffectRunner` dispose has the same mount behavior.
- No changesets were written. `apps/site` is not a published package, and earlier demo-fix commits carry none either.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: pass for each of
  - `DrapeLabDemo.test.tsx` (2)
  - `EffectChartDemo.previews.test.ts` (1)
  - `EffectChartDemo.test.ts` (2)
  - `FontFallbackDemo.test.tsx` (1)
  - `GeomDemo.test.ts` (2)
  - `HistoryDemo.test.tsx` (3)
  - `LayeredCurveDemo.test.tsx` (4)
  - `cssModuleClasses.test.ts` (1)
  - `insertDemos.test.tsx` (2)
- The new insert-demo and FontFallback tests, and the CSS-class check, were run before their fixes and failed. The tests for the other fixes call helpers the fixes export, so they could not run before the fix; I did not see them fail.
- `npm run typecheck`: pass (exit 0). I ran the root typecheck instead of `typecheck:packages` because no package changed and `apps/site` has no package tsconfig.
- eslint on the changed files: pass
- `npm run check:size`: pass
- `npm run check:changesets`: pass
- `npm run check:test-projects`: pass
- No browser tests were touched. The tree is clean, and `.skulk/` is in no commit.