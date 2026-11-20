The grouped-path join (A+B) reads the other path the wrong way: `commitJoin` takes it from the raw scene node, so the joined anchors land in the group's local frame. Fixed a2c0600456: it now reads `editAnchors.getEditablePath`, the same path the press was aimed at. That also covers form-backed nodes, since anchors are now numbered from the same edit path.

The double click on another path's end (A+B) joins, then leaves a stray one-anchor path. Fixed 6689fe1c7e: a join now sets `justClosed` the way a close does, so the double click takes the second anchor back.

A drag from the first anchor (A+B) adds an anchor on top of it instead of closing. Fixed d5ab72de6d: the drag now closes the path and pulls the first anchor's handles, mirrored. Canceling puts the handles back, and the close and click paths now share one `closeCurrent` helper.

A continued path stores a lone one-anchor subpath (B): a single click after a close, then Enter, lands in the node. Fixed 87dd961c82: `commitPen` drops it, as the new-path branch already did.

No extra defects found.

Checks:
- Every pen test file, one at a time with `--maxWorkers=1`: pass (penPreviewLayer 9; abandonedRender 1; continue 12; declaration 4; finish 22; insertDep 2; join 15; kitSettings 3; origin 3; placement 16; preview.canvas 3; rubberBand 3; snapOff.canvas: pass; snapping 12). The pen has no `*.browser.test.*` files, so none went unrun.
- `npm run checks:gate`: failed once, because the titles of two of my changesets ran past 140 characters. I shortened them and folded that into their own commits. Rerun: "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/path-tools`: fail. The package has no `lint` script ("Missing script"), so I ran `npx eslint` on the changed files instead: pass (exit 0).
- `npm run typecheck:packages -- path-tools`: "1/1 path-tools ok".
- `npm run check:changesets`: "OK — 2541 changeset(s)".
- The tree is clean apart from `.skulk/`.

tally: 7 of 7 fixed, 0 extra fixed