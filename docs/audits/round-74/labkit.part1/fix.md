The outer lightbox's surface scope is now fixed. `pickUp` is still a question for you: it can only be wired in or removed, and removing it breaks the public type. All checks pass.

Nested lightbox closing clears the outer lightbox's surface scope (B): fixed 44336bb210. A closing lightbox now gives the surface back the scope of the newest lightbox still open, and clears it only when none is.

`DragDropCapability.pickUp` declared but never called (A+B): question. Should it be wired into the canvas press path, or removed along with `HitResult`? Removing it is a breaking change. It was already filed as the P2 maintainer entry at `docs/TODO.md:278`. So it is no longer silent, I made the strict call in 2fe91473a7: a trial whose instrument declares `pickUp` warns once per instrument in development, and the doc comments no longer promise dragging items back out. I recorded that call in `docs/unruled.md` (round seventy-four) and added a line to the TODO entry, which stays open.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/labkit/src/lightbox/Lightbox.test.tsx`: pass (20 passed); the new test failed before the fix.
- `npx vitest run --maxWorkers=1 packages/labkit/src/trial/useTrialDragDrop.test.tsx`: pass (2 passed).
- `npm run checks:gate`: pass ("all 33 passed").
- `npm run lint -w @weasel-js/labkit`: pass.
- Browser tests: none touched, none unrun.

tally: 1 of 2 fixed, 0 extra fixed