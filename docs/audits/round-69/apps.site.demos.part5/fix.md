StreamingDemo fixed size (A+B): fixed 723e54c616. The demo now passes the canvas's measured size from `onResize` to `stream.update`, so an enlarged stage gets all its cells.

StreamingDemo abort listener and already-aborted signal (B): fixed a4ff3bce21. `load` returns `[]` at once on a signal that is already aborted, adds its listener with `{ once: true }`, and removes it when the cell arrives. `WORLD` is now exported so the test can call it.

StrokeWidthLab nib slider strips nibs (A): fixed 14191025c3. The nib angle and ratio sliders now change only nibs that strokes already have. Only the Nib checkbox adds or removes one, and a stroke with nothing to change is skipped.

No extra defects found. Nothing else in the area adds an abort listener or shares the nib-patch logic.

No changesets: these are site demos, not published packages, and the recent demo-fix commits in this directory (e.g. d08338fdb7) carry none either.

Checks:
- `npx vitest run --maxWorkers=1 apps/site/demos/__tests__/StreamingDemo.test.tsx`: pass (4 passed; the 3 new tests failed before their fixes)
- `npx vitest run --maxWorkers=1 apps/site/demos/__tests__/StrokeWidthLabDemo.test.tsx`: pass (5 passed; the new test failed before the fix)
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run lint -w <pkg>`: not run, because `apps/site` has no `package.json` of its own. The root `npm run lint` passed inside the gate, and eslint on the four changed files exited 0.
- Tree clean apart from `.skulkr/`

tally: 3 of 3 fixed, 0 extra fixed