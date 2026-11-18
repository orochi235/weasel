- D3SortableDemo's "index" order sorted ids as strings, so bar-10 and bar-11 stood third and fourth (A): fixed d512414c66
- DiagramLayoutDemo dropped the routes a layout run reports (A+B): fixed decc8edc36
- DiagramDropDemo let a note be dragged into the row although a palette drop refuses it (A): fixed d74d1bf7fd
- ClipDemo's load check used a binder that accepts every event name, so the clip then threw inside the effect (A): fixed a49e494a5d
- CompoundPathsDemo's honk button didn't follow the goose during a drag (A+B): fixed 23a291afe1
- AudioDemo kept a stolen looping source voice as "playing" (A+B): fixed a21ef052f6. Its test is in `AudioDemo.browser.test.tsx` and has not been run.
- AnimationDemo's momentum bounds allowed for a 60-px card while its cards are 80 px wide (A): fixed 88faf7a0f7
- CustomShaderDemo registered the mark texture once for every mount that started before the image loaded (B): fixed dee59093c6
- BidiDemo threw on long input by spreading every code point into one call (B): fixed 3dfe426c3d

No extra defects found. I checked the other diagram demos for the dropped-routes mistake: DiagramClustersDemo and DiagramElkDemo already keep routes. DiagramLiveDemo's `onMove` also ignores `routes`, but it runs only force layout on default-router edges, so I left it alone.

None of these got a changeset. `apps/site` is not a published package, so no consumer sees them. This matches recent demo commits such as 52e547d488.

Checks:
- Every test file except the browser one failed on the pre-fix code and passed after. I put the old code back temporarily for each run; for AnimationDemo and BidiDemo I swapped the old expression into the new helper instead.
- `npx vitest run --maxWorkers=1`, one file at a time: pass
  - D3SortableDemo.test.ts: 1 passed
  - DiagramLayoutDemo.test.tsx: 1 passed
  - DiagramDropDemo.test.tsx: 1 passed
  - ClipDemo.test.tsx: 1 passed
  - compoundPathsDemo.render.test.tsx: 3 passed
  - AnimationDemo.bounds.test.ts: 1 passed
  - animationDemo.integration.test.tsx: 5 passed
  - CustomShaderDemo.texture.test.tsx: 1 passed
  - CustomShaderDemo.test.tsx: 5 passed
  - BidiDemo.test.ts: 1 passed
- AudioDemo.browser.test.tsx: unrun (browser test).
- Typecheck: I ran `npm run typecheck` (root plus browser-test programs), pass (exit 0). `apps/site` is not a package, so `typecheck:packages` doesn't cover it, and no package changed.
- eslint on each of the 18 changed files: pass (exit 0 for every one).
- `npm run check:size`: pass ("sizes: no file or function grew past its cap.")
- `npm run check:changesets`: pass ("[changesets] OK — 1676 changeset(s).")
- The tree is clean apart from `.skulk/`.