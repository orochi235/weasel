Stored `mode` prop overwrote the user's choice (A): fixed 84ba6b6cd1

`labChrome` doc still claimed a first sidebar contribution remounts every trial (A): fixed ad8036f6e4

Lab chords read the global `document.activeElement` (A): not a defect (the lab's key dispatcher listens on the global `document`, because `attachInput` falls back to `document` when there is no canvas, so a key typed in another document never reaches the chords; for every key that does arrive, `document.activeElement` is the right element)

Incoming `origins` compared as raw strings while outgoing posts normalize them, `'*'` included (A): fixed e47f2bc474

`messages.origins: []` made every state post throw (B): fixed da01f89c07

`origins` used as given when posting but compared literally when receiving (B): duplicate of A's incoming-`origins` finding, fixed e47f2bc474

Fit warning lost its culprit once `.lk-shell-body` was scrolled (B): fixed b9eb1053aa (scrollLeft as well as scrollTop)

Extra: an `origins` entry with no origin (not `'*'`, `'/'`, or a URL with an origin) now throws a named labkit error, rather than a bare `postMessage` SyntaxError from inside an effect. This is part of e47f2bc474, not a separate defect. It adds no new behavior call, since `postMessage` already threw on such entries, so nothing was recorded in `docs/unruled.md`.

Checks:
- `npx vitest run --maxWorkers=1 packages/labkit/src/lab/Lab.persist.test.tsx`: pass (10 passed)
- `npx vitest run --maxWorkers=1 packages/labkit/src/lab/Lab.messages.test.tsx`: pass (22 passed)
- `npx vitest run --maxWorkers=1 packages/labkit/src/lab/fitCheck.test.ts`: pass (11 passed)
- `npx vitest run --maxWorkers=1 packages/labkit/src/lab/Lab.chrome.test.tsx`: pass (9 passed)
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run lint -w @weasel-js/labkit`: pass (biome reported no errors, only warnings already in the tree; "design tokens: clean")
- `npm run check:changesets`: pass ("OK — 3593 changeset(s).")
- No browser tests touched. The tree is clean.

tally: 6 of 7 fixed, 0 extra fixed