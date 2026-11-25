- fit warning blames a box clipped inside an inner scroller (A): fixed d47af29897
- fit warning names `.lk-shell-body` itself when it has a classic scrollbar or a border (A): fixed d64c24492d
- `Workspace` drops falsy children before matching `ids` to them (A): fixed 3bc9075704
- presented lab with `messages.origins` still posts its state to `'*'` (A): fixed 53fe9d78d4. State now goes only to the listed origins; the `origins` doc, the `messages` prop doc, and the README say so.
- chord owner and framed check read the global `document`/`window` (A): fixed 99e4e1d713, framed half only. `isFramed` now reads the lab's own window. The chord half is not a defect: `ownerNow` reads the global `document`, and that is the document `LabKeys`' dispatcher listens on (`canvasRef: NO_ELEMENT`, so `attachInput` falls back to the global `document`). Focus and key events therefore come from the same place. In a popped-out window the lab's keys are not heard at all. That is a separate, larger gap: `LabKeys` mounts above `labBody`.
- `labkit:play` does not restart an ended run on a clock that can't seek (B): fixed 4d7c5df27c
- dark-mode starfield shows through a presented lab and lands in dark posters (B): fixed bfd04a76ba. Its test is in `presentation.browser.test.tsx`, which can't run here and is unrun.
- fit warning measures the global `document` (B): fixed cca7ece7b7

No extra defects fixed.

Checks:
- `npx vitest run --maxWorkers=1` on each touched file, on the final tip: `Lab.messages.test.tsx` 18 passed (18); `fitCheck.test.ts` 10 passed (10); `Lab.presentation.test.tsx` 14 passed (14); `Workspace.reorder.test.tsx` 4 passed (4). Each new test was seen failing before its fix. `presentation.browser.test.tsx` is unrun (browser).
- `npm run check:changesets`: OK — 3217 changeset(s). Four titles first ran over 140 characters; they were shortened and folded into their commits.
- `npm run checks:gate`: all 32 passed. The first run failed typecheck and typecheck:packages on a test-helper type in `fitCheck.test.ts`; that was fixed and folded into its commit.
- `npm run lint -w @weasel-js/labkit`: exit 0. The first run failed on biome formatting in three test files; they were formatted and folded into their commits.

tally: 8 of 8 fixed, 0 extra fixed