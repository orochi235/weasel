Dropped weasel payload lands at the paste offset, not the drop point (A+B): fixed 9be19173ef

Kit `booleansAdapter` never supplies `getStrokeFrame` (A+B): fixed 558d7e36a5

kitSweep no longer reaches the presets (A+B): fixed 88bf4052bb. The sweep now also reads the `presets` entries of core, editing, path-tools and text-tools. A new test checks that every preset on `@weasel-js/editing/presets` is reached; before the fix, `view`, `move`, `resize` and `rotate` were missed. This only changes tests, so it has no changeset.

Repeated Cmd+V stacks every paste on one spot (A): fixed ec5add690a, plus 0f9f1654b5, which allowlists the new last-paste map in `check:part-caches`. This was already listed as Open in `docs/unruled.md`, so I made the call and rewrote that entry. Cmd+V now steps on from that canvas's last paste of the same payload, remembered per paste adapter. Still open there: Cmd+V lands at the adapter's offset, while the Paste button lands at the pointer by default. A also noted that the OS path always labels the history entry "Paste" and ignores `pasteLabel`. Not a defect: the handler cannot see the hook's options. I left it unchanged.

SVG and raster files dropped together stack on one spot (A): fixed 4025ad745a. Each file now cascades by its place among all the files the arrival carried, and `ghostBounds` numbers files the same way. A file nobody can claim still holds its place, so it leaves a gap in the cascade.

A payload containing `</metadata>` cannot be pasted back from the SVG flavor (A): fixed 8fe2a5014f. The extractor now reads whole CDATA sections before it looks for the closing tag.

kit:svg makes two nodes from an SVG file plus its text/plain markup (B): fixed a4fdbd74b8

`writeOsClipboard` leaves a rejecting promised flavor unhandled when there is no clipboard API (B): fixed 9e5df4e10a

`useSelection` seeds `initial` only into the first `scene` store it is given (B): fixed db3a91c383

Extra defects found while fixing: none.

Checks:
- Every touched test file, each run alone with `--maxWorkers=1`: pass
  - `osClipboard.test.ts` 1/1
  - `wireFormat.test.ts` 16/16
  - `deps/booleans.test.tsx` 4/4
  - `ghost.test.ts` 9/9
  - `svgHandler.test.ts` 18/18
  - `weaselJsonHandler.test.ts` 24/24
  - `kitBindingIds.test.tsx` 4/4
  - `useSelection.test.ts` 38/38
- Also run alone and passing: `kitBindingCollisions` 4/4, `kitBindingPhases` 1/1, `kitActionParams` 3/3, `weaselJsonHandler.pbt.test.ts` 8/8, `imageHandler.test.ts` 8/8
- `npm run check:changesets`: pass ("OK — 2238 changeset(s).")
- `npm run checks:gate`: first run failed (`check:part-caches`, 1 of 32); after the allowlist fix, "checks:gate: all 32 passed"
- `npm run typecheck:packages -- editing`: pass ("1/1 editing ok")
- `npm run lint -w @weasel-js/editing`: not run, because `@weasel-js/editing` has no `lint` script. Instead I ran `npx eslint` on every changed `.ts`/`.tsx`/`.mjs` file: pass, no output. The gate's root `npm run lint` also passed.
- Browser tests (`*.browser.test.*`): none touched.
- Tree: clean apart from `.skulk/`.