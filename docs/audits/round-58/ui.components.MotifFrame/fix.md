I fixed all 11 distinct findings, in 11 commits: 3 of the 14 were the same issue reported by both reviewers. Every check I ran here passed, but the new browser tests couldn't run on this node and still need the batch run. I made one behavior call nobody had ruled on (the `plaque` mix below) and recorded it in `docs/unruled.md`.

- Untitled frames draw an empty heading or bar in rule, divider, notch, tab, titlebar, stereo and plaque (A+B): fixed 843e4d4844
- An untitled notch frame is named by its legend's controls (A): fixed c5f0a14ac9. Its fieldset now gets `role="none"` when the frame has no title.
- `<DefaultMotif>` given a kind as `undefined` wipes out the outer default, and so does a `named` entry (A+B): fixed 45e6d3af37
- sheet and well drop `inline` when the frame has no title (A+B): fixed 6289b0094c
- titlebar clips the focus ring of an `inline` control (A): fixed d2b9da73be. Only the label clips and ellipsizes now; its test is a browser test.
- rule and divider treat `null`/`false` actions and leading as present, while sheet and well treat them as absent (A): fixed cd5821719d. One `drawn()` check now covers every part in every motif.
- rule draws its tint edge on the physical left (A): fixed 2be3f79660. It now uses `border-inline-start`.
- sheet always sets a backdrop-filter (A): fixed e21bf57e0b. It resolves to `none` when no blur is set.
- `well({ label })` styles the titles of wells nested inside it (B): fixed 4c55b2afc0. The selector now reaches only the well's own title.
- A stereo bar and its body inset part ways under RTL (B): fixed 980121861a. I kept `side` physical, since it names edges (left, right, top, bottom): under `dir="rtl"` a left bar now stays on the left, beside its inset.
- `plaque({ mix })` outside 0–100 breaks the fill and ink (B): fixed ae8196e11b. **My call:** a `mix` outside 0..100, or one that isn't a number, throws a `RangeError` rather than being clamped.
- Duplicates: B1 (DefaultMotif) is a duplicate of A3, B2 (untitled heading) of A1, and B3 (inline dropped) of A4.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/ui/src/components/MotifFrame/MotifFrame.parts.test.tsx`: pass, 42/42
- `npx vitest run --maxWorkers=1 packages/ui/src/components/MotifFrame/MotifFrame.test.tsx`: pass, 32/32
- `npx vitest run --maxWorkers=1 packages/ui/src/components/MotifFrame/MotifFrame.heading.test.tsx`: pass, 15/15
- Dependent suites (Properties, Prefs, PanelCells, labkit ControlPanel.motif, SelectionPanel.motif, theme-editor ConstraintsPanel): pass, 174 files and 1009 tests
- Not run, browser only: `packages/ui/src/components/MotifFrame/motifs/edges.browser.test.tsx` (new) and `packages/ui/src/components/MotifFrame/motifs/titlebar.browser.test.tsx` (one test added)
- `npm run checks:gate`: pass, "checks:gate: all 32 passed". The first run failed on a typecheck error in my DefaultMotif change; I fixed it and folded the fix into that commit.
- `npm run check:changesets`: pass
- `npx eslint packages/ui/src/components/MotifFrame`: pass
- `npm run lint -w @weasel-js/ui`: not available, since `@weasel-js/ui` has no `lint` script. The root `npm run lint` in the gate passed.

The tree is clean.

tally: 14 of 14 fixed, 0 extra fixed