Curved-row text copies in a popout or iframe use the main window's stylesheet and font set (A+B): fixed 0110bc0357. The copies and their stylesheet are now built in the row's own document, with one sheet per document, and they redraw when a font loads in that document.

A drag that starts mid-glide jumps the run to the glide's target (B): fixed a63aaa58c0. A press now stops the glide where it is drawn.

A removed text node leaves `data-run-text-hides` on the parent that stays (A): fixed 7d11136685. Each copy now records its parent when it is made.

A slot host's `thickness` goes stale when slots change only in height (A): fixed 04a8076c11. A ResizeObserver on the slots re-reads it; the watch logic is shared with `useItemLengths` through a new `rewatch` helper.

`useRunGap` misses a `column-gap` change that does not resize the root (A): fixed ccdc87267a. The gap is now read again on every commit, on resize, and when an attribute changes on the root or any ancestor. A theme swapped by replacing a stylesheet with no attribute change is still not caught.

Extra (sweep), `useItemLengths` skips every item of a run in another document, because it checks `instanceof HTMLElement` against the main window, so they all read as length 0: fixed af966a40f9.

Checks:
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Along/useRunScroll.test.tsx`: pass (17)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Along/runText.test.ts`: pass (3)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Along/useItemLengths.test.tsx`: pass (5)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Along/runSlots.test.tsx`: pass (8)
- `npm run checks:gate`: "checks:gate: all 33 passed"
- `npm run lint -w @weasel-js/ui`: not run, because `@weasel-js/ui` has no `lint` script ("Missing script: \"lint\""). `npx eslint packages/ui/src/components/Along` printed no problems, and the gate's root `npm run lint` passed.

tally: 5 of 6 fixed, 1 extra fixed