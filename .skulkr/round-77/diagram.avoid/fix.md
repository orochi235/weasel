Commit-time nudge re-spreads a clean connector without its channel mates, so it can land on one of them (A): fixed 2715f938b2

Drag-frame search limit leaves out the `2 * margin` room the commit limit keeps (A+B): fixed fccbc230d3

`SpatialHash.remove` leaves empty cell lists behind, which wide queries then walk (A): fixed 4e6526665c

`createSpecRouter` routes an edge with more than two `dependsOn`, which `avoidSceneInput` skips (A): fixed a16df972fe

Box equality and the facing-port filter are each defined twice (A): fixed a0f44d2aed. This also folds the diagram package's other two copies, in `regionSync.ts` and `bodyRelayout.ts`, into a new `rectsEqual` export in geom.

Extra, not fixed: the same four-field rect equality is hand-written in about 15 more places across core, editor, guides, hud, labkit, renderer, and geom. Those files are outside this area and may be in other fixers' areas this round, so I left them alone to avoid conflicts. Each can now call `rectsEqual`.

Checks:
- Every `packages/diagram/src/avoid/*.test.ts` file, one at a time with `--maxWorkers=1`: all pass.
- `packages/geom/src/box.test.ts`, `bodyRelayout.divider.test.ts`, `regionSync.pbt.test.ts`: pass.
- `npm run typecheck:packages -- diagram geom`: pass.
- `npm run checks:gate`: pass ("checks:gate: all 33 passed").
- `npm run lint -w @weasel-js/diagram` and `-w @weasel-js/geom`: not run, because neither package has a `lint` script. `npx eslint` on every changed `.ts` file: pass. The root `npm run lint` inside the gate also passed.
- `npm run check:changesets`: pass ("OK"). Its one title-length warning is on `text-edit-keeps-focus-offscreen.md`, which isn't one of mine.
- Tree clean apart from `.skulkr/`.

tally: 5 of 5 fixed, 0 extra fixed