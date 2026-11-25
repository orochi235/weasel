Reticle goes stale when the lab body moves with no window event (A): fixed b105a39330. A ResizeObserver on the body now rerenders and remeasures the lenses. A body that moves without changing size (a panel above it grows while it keeps its size) still waits for the next render.

Live copy duplicates the trial's ids (A+B): fixed cf8f5cebce. The copy drops every `id`. That means `#id` styles don't apply inside the lens. This is a call nobody has ruled on, so I recorded it in `docs/unruled.md`.

stillCopy misses other live elements (A): fixed a2ebd7038a for `<object data>`, `<embed src>` and `<frame src>`. Question on custom elements: a cloned custom element is constructed and connected again, and its shadow root isn't copied. Stopping that means either swapping each one for a stand-in or cloning its shadow root by hand, and both change what the lens shows. Not fixed.

LabLoupe's compare-menu action is enabled but does nothing (A): fixed 9624a4e9ae. `LensActionApi.openCompareMenu` is now optional, `createLensApi` leaves it out when no `compare` ref is given, and `loupe.compare.menu` is then disabled as not applicable.

Wheel pass-through and root probe hit-test the global document (A): fixed 62dadac20c. They now use `ownerDocument`, and `CloneCell` builds its box in the slot's document.

Duplicate ids (B): duplicate of the A+B id finding above.

Pixel grid draws a stale capture against the new factor (B): not a defect. `LensCapture.at` is the reticle's offset in host px from the capture's first pixel, so `center − at·factor` and the `factor/dpr` step place the old capture correctly at any factor. Only how much of the lens it covers changes.

Compare menu enabled with no menu (B): duplicate of the compare-menu finding above.

Extra, found while fixing (folded into 62dadac20c): `useLensRemeasure` listened for scroll and resize on the module's `window` rather than the body's own window. It now uses `body.ownerDocument.defaultView`.

Checks:
- `npx vitest run --maxWorkers=1`, each file on its own: cloneSource.test.ts pass (19), useLensRemeasure.test.tsx pass (4), useWheelPassThrough.test.tsx pass (1), lensActionDefs.test.ts pass (18), lensApi.test.tsx pass (17). Each fix's new test failed against the original code first. The exception is the scroll-in-another-window test in useLensRemeasure.test.tsx: its run against the original code never finished, so I never saw it fail.
- `npm run check:changesets`: pass.
- `.skulkr/in/on-fleet typecheck 15 checks -- npm run checks:gate`: "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/labkit`: pass.
- Tree clean.

tally: 6 of 8 fixed, 1 extra fixed