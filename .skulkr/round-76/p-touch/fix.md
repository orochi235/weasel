That warning is on another changeset, not mine.

Line height ignored for one-line text boxes (A+B, counted as two findings): fixed c5ff67d542. A text box holding one line at a non-default line height is now rasterized unless it is centered vertically. Only the top and bottom positions shift, because in a centered box the half-leading cancels out. I added this case to the 2026-11-20 entry in `docs/unruled.md`.

Carried `lbxObjectsCommand` skips the along-tape bounds check under auto length (A): fixed eb495b8514. A carried object reaching past either end of an auto-length label is now skipped with a reason instead of written whole. This was a behavior call nobody had made (the 2026-11-20 `docs/unruled.md` entry called it "unasked"), so I made the strict call and rewrote that entry. At a fixed length, carried objects are still written as before.

Checks:
- `npx vitest run --maxWorkers=1` on each test file under `packages/p-touch/src/lbx/`: pass (sceneLbx 1, shapes 12, writeLbx.edges.pbt 4, writeLbx.pbt 7, writeLbx.shrunk 2, writeLbx 24).
- `npm run checks:gate`: pass ("all 33 passed").
- `npm run check:changesets`: pass (OK; its one title-length warning is on `small-caps-capitalize-bare-text.md`, which I didn't touch).
- `npm run lint -w @weasel-js/p-touch`: not run, because the package has no `lint` script. I ran eslint on the changed files instead: pass.
- Tree: clean apart from `.skulkr/`.

tally: 3 of 3 fixed, 0 extra fixed