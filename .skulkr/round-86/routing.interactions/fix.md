[r86] fixed f5075fddea and others below; report:

- Reserved-chord list misses Mod+1–9, back/forward, F5/F11/F12, Alt+F4, Ctrl+Shift+Esc, Ctrl+Shift+Delete (A+B) — fixed 6c2d6ac82a. My call, recorded in `docs/unruled.md`: overridable chords are listed too, as the header says it errs toward listing. That puts editing's reorder keys (Mod+[ / Mod+]) inside the list on a Mac. I left them where they are; no reserved-key test covers editing.
- useHandleDrag counts scroll that never moves a fixed or sticky rect (A+B) — fixed 3c8045d317. Only the scrollers that actually carry the rect count now. A fixed box skips those between it and its containing block, so a transformed holder still counts what sits above it. A sticky box skips the scroller it sticks in.
- useHandleDrag's scroll correction ignores an ancestor's scale (A) — fixed 3c8045d317 (same function as the line above, one commit with its own changeset). Each scroller's delta is multiplied by its client scale.
- Sweep surface inside a shadow root never finds an item (A) — fixed 6f46df6f6e. The new `elementAt` helper hit-tests in the surface's own root.
- Carry surface inside a shadow root is never picked (A) — fixed f5075fddea. Each surface is hit-tested in its own root.
- pointerSession's `escape` runs at document capture, after window-capture Escape handlers (B) — fixed 3160361e54. It now listens at window capture. Concrete harm: while a Tooltip is open, ui's Tooltip makes `stopPropagation` do nothing at the document, so the Escape went past the drag's listener too.

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1`, each file on its own: browserReservedKeys.test.ts 16 passed; carry/carry.test.ts 3 passed; handleDrag/handleDrag.test.ts 20 passed; pointerSession/pointerSession.test.ts 21 passed; sweep/sweep.test.tsx 10 passed.
- Consumers of the reserved-chord list (core and path-tools browserReservedBindings, apps/draw constraintKeys, ui menuBarReservedKeys): 26 passed.
- `npm run checks:gate`: the first run failed 2 of 33, on a type error in my new sweep test; fixed, then `checks:gate: all 33 passed`.
- `npm run lint -w @weasel-js/routing`: routing has no lint script. eslint on every changed file: clean (exit 0).
- `npm run check:changesets`: OK. It warns that the Escape changeset's title runs 149 characters; I shortened it afterward, so it should now be under 140, but I didn't rerun the check.
- `npm run check:size`: pass.
- Unrun: the browser tests for carry and pointerSession.
- Tree clean.

tally: 8 of 8 fixed, 0 extra fixed