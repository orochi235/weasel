`DragDropCapability.pickUp` is never called (A+B; listed once in each report) — question: should labkit wire it up or remove it, along with `HitResult`? It is already filed as a `[maintainer]` P2 in `docs/TODO.md:278` (round 50). Wiring it needs a hit-test on the instrument's canvas, which doesn't exist yet. Removing it is breaking. Left as is.

`useJob.start` runs `begin` twice, and `run` gets a stale base (A) — fixed c229a8d056

A change to `<LightboxLayers>` while a lightbox is open moves focus out and records the wrong return target (A) — fixed 69b9cd355b

`liftStack` leaves earlier members lifted when a later `showPopover` throws, such as on a detached layer (A) — fixed 1b4c2bed26

Palette items can't be used from the keyboard (A) — fixed 430c12962a. Enter or Space places the item at the center of the canvas view. This was my own call, recorded in `docs/unruled.md`.

The `Instrument.undo` doc names the wrong default snapshot events (A, listed once in each report) — fixed 4db96e050c

The `instrument` barrel omits types the root exports (A) — fixed 07f25e5259. The barrel isn't a published subpath and nothing imports it, so I deleted it.

`DragFeedback.reason` is never shown (B) — fixed 83bdd1e5e6. The reason now shows under the drag ghost, and `DragGhost` takes a new `reason` prop.

Closing a nested lightbox unlifts the outer one's shared layers (B) — fixed 1b4c2bed26, the same commit as the `liftStack` fix, since both are in that one function. How shared `below` and `above` layers behave when nested was my own call, recorded in `docs/unruled.md`.

A drop computes `onDrop` from the last rendered state (B) — fixed 6e2f61dbac

Extra (sweep): closing a lightbox while something inside it had focus never returned focus. React's commit puts focus back on whatever had it before the commit, which undid the move made in the effect cleanup — fixed 69b9cd355b

Commit 70b0f33 records both of my own calls in `docs/unruled.md`.

Checks:
- `npx vitest run --maxWorkers=1`, each file on its own:
  - `dragdrop/dragDrop.test.tsx`: 16 passed
  - `job/useJob.test.tsx`: 12 passed
  - `lightbox/Lightbox.test.tsx`: 19 passed
  - `lightbox/modal.test.ts`: 3 passed
  - `dragdrop/feedbackLayer.test.ts`: 2 passed
  - `trial/Trial.job.test.tsx`: 3 passed
  - `trial/Trial.jobRestart.test.tsx`: 2 passed
  - `job/useJob.pbt.test.tsx`: 1 passed
- `npm run checks:gate`: "checks:gate: all 33 passed"
- `npm run lint -w @weasel-js/labkit`: pass (exit 0)
- `npm run check:changesets`: "OK — 666 changeset(s)"
- Unrun: no `*.browser.test.*` file was touched.

The tree is clean.

tally: 10 of 12 fixed, 1 extra fixed