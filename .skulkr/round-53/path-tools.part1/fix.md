The four findings that held up are fixed, one commit each with its own changeset. Three findings aren't defects, and one I only partly fixed: it needs a change in core that I left as a question.

- addExtremeAnchors enabled by an 'xy' check whatever axis its params name (A+B): fixed 50222de858
- linkAnchor loses the drag when the link ops come back empty (A): fixed 7646edad5f
- fillet drag and `setFillets` clamp each corner against its neighbors' old cuts, not their new ones (A): fixed 6d12acfc9a (both paths now go through a new shared helper, `fillet/cornerRadii.ts`)
- girth replay reads the zoom in view now, not the one at the press (A): fixed 99c21928f3
- path-edit host with a mode `target` never tells subscribers when the open path moves to another node (B): fixed 1d1422a94a
- fillet widget always draws a sharp corner as round, whatever shape the `editFillet` params give it (B): question (the widget can't see action params: `PathEditMarksCtx` doesn't carry them, and wiring the canvas registry's `paramsOf` into the path-edit overlay, and repainting it when a tuning changes, is a change to core outside this area. What I did, 0d9e632b12: the widget now reads `DEFAULT_FILLET_SHAPE` instead of a copied `'round'` literal. A tuned shape still doesn't reach the glyph.)
- `constrainAnchors` and `unconstrainAnchors` carry the `path-drag` tag though they are immediate commands (B): not a defect (`docs/path-operations.md` lists them under `path-drag` on purpose, as relations kept during anchor drags, like the handle-lock toggles, and `pathOperationTags.test.ts` enforces that listing)
- `constrainAnchors` stores any `length`, even negative, zero, or NaN, as a constraint that can never hold (B): fixed 272826b9fe (a negative or non-finite length now falls back to the measured one. Zero stays, since two anchors at the same point satisfy it. Falling back silently matches how the area's other numeric params are handled, so I made no `docs/unruled.md` entry.)

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1` on each touched file: `addExtremes.test.ts` pass (4/4), `anchorConstraints.test.ts` pass (5/5), `createPathEditHost.test.ts` pass (6/6), `filletWidgets.test.ts` pass (6/6), `filletActions.test.ts` pass (16/16), `useGirthTool.test.tsx` pass (20/20), `constraintLinks.test.tsx` pass (12/12). Each new test failed before its fix.
- `npm run checks:gate`: 31 of 32 pass, `check:changesets` failed (four titles over 140 characters). I shortened the four titles and folded each into its own fix commit. `npm run check:changesets` then passed: "OK — 2543 changeset(s)". I did not rerun the whole gate after that; only changeset files changed.
- `npm run lint -w @weasel-js/path-tools`: the package has no `lint` script. `npx eslint` on the changed directories: pass, no output.
- The tree is clean.

tally: 5 of 9 fixed, 0 extra fixed