- `DragDropCapability.pickUp` is declared but never called (A+B): question. Should it be wired or removed? Nothing in labkit produces its `HitResult` argument, because the trial's canvas dispatcher has no hit-test (`affordanceAt`/`classifyTarget`). Wiring it means changing the signature to take a world point, claiming the press so it outranks pan (their registration order isn't stable), carrying the item with ghost and feedback, and making the pick-up plus drop one undo step. That's a feature arc, and removing it is a breaking change. Filed as a P2 TODO entry in 335912fe14, closing when a declared `pickUp` starts a drag or the option and `HitResult` are gone.
- A palette item drops into another trial's canvas (A+B): fixed d47a4433af
- A drop lands where `onDragOver` answered `ok: false` (B): fixed 76c7d492c0
- Right- or middle-button palette press drops an item (B): fixed 436274c6ef
- Drag from lightbox content released on the margin closes it (A): fixed fdfa79c71d
- Escape closes the outer of two nested lightboxes (A+B): fixed 0fd182e779
- Controlled lightbox mounted `disabled` + `expanded` never tells its owner, then reopens when enabled (B): fixed e45e68306c
- Job's `run` gets the state from before `begin` (A): fixed 74192b333e

Extra:
- `check:numeric` failed at the frozen tree on `apps/draw/src/dev/audits/Treemap.module.css` (sweep): fixed 68f359681f
- labkit's `lint` (design-token check) failed at the frozen tree on `packages/ui/src/components/SpanStrip/SpanStrip.module.css` (sweep): fixed 4b43e0ed75

Checks:
- `npx vitest run --maxWorkers=1 packages/labkit/src/job/useJob.test.tsx`: pass (11 tests)
- `npx vitest run --maxWorkers=1 packages/labkit/src/job/useJob.pbt.test.tsx`: pass
- `npx vitest run --maxWorkers=1 packages/labkit/src/dragdrop/dragDrop.test.tsx`: pass (13 tests)
- `npx vitest run --maxWorkers=1 packages/labkit/src/lightbox/Lightbox.test.tsx`: pass (16 tests)
- Unrun (browser): `packages/labkit/src/lightbox/Lightbox.browser.test.tsx`, `packages/labkit/src/dragdrop/dragDrop.browser.test.tsx` (not edited, but they cover code I changed)
- `npm run checks:gate`: `checks:gate: all 32 passed`
- `npm run lint -w @weasel-js/labkit`: pass (exit 0)
- `npm run check:changesets`: `[changesets] OK — 2403 changeset(s).`
- `@weasel-js/ui` has no `lint` script; its CSS change passed the gate.
- Tree clean.

tally: 6 of 11 fixed, 2 extra fixed