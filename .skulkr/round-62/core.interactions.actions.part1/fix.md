- [r42-1] `commitOps` reads `deps.operands` with no `select` (carried, A+B): fixed 678da7c48b. It now reads `applyOps`, `scene` and `operands` only when the action declared them, with `in` checks. A dev deps proxy threw on `applyOps` before it ever reached `operands`.
- [r42-2] `moveEachOps` zero-delta entry doesn't claim its nodes (carried, A+B): fixed 5948cb1084.
- [r42-3] `enumerateAnchors` skips the implicit start of a subpath opened after `Z` (carried, A): fixed 9d4aded695. It now emits an `implicit: true` anchor, numbered as `pathToAnchors` numbers it. Its `coordIndex` is the closed subpath's opening `M`, or -1 when there is no coordinate.
- [r42-4] `translateAnchor` moves a one-segment quadratic loop's control twice (carried, A): fixed 70b4c2ed80.
- [r42-5] `swappable` lets a cross-parent swap land a node where `childVerdict` would refuse it (carried, B): fixed c3c198d47b. Under two parents, each parent must now take the other's node through `admitsChild`, which reads `canDropInto`. The `swap` action now declares `canDropInto`.
- [r42-6] `childVerdict` holds the follower page rule only for the page itself (carried, B): fixed 63fafc8bc8. It now uses `pageIdOf(parent)` for any container on a page.

Extras: no defects. There are two follow-up commits: 05ae76985f shortens four changeset titles to the 140-character limit, and 95e542c879 regenerates `core/import-shims/engine.ts`. The engine entry now exports `childVerdict` because `swappable` reaches it.

Checks:
- `npx vitest run --maxWorkers=1`:
  - `defaultCommitAdapter.test.ts`: pass (10)
  - `moveNodes.test.ts` (core): pass (1)
  - `edit-anchors/geometry.test.ts`: pass (16)
  - `admitsChild.test.ts`: pass (7)
  - `canSwap.test.ts`: pass (8)
  - related files run: editing align (29), distribute (33), swap `action` (5), `swapOps` (3), `move.swapOnDrop` (11), `move.swapOverLayout` (1), `singularFrames` (7), editing `moveNodes` integration (9); core `alignDistribute.pbt` (2), `affordances` (54), `anchorEdits` (43); path-tools `pathEdit/editAnchors` (54): all pass
- One background test loop was stopped at its time limit. Its file list was broken, so I ran each of its files separately; all pass and are counted above.
- `npm run check:changesets`: pass
- `npm run checks:gate`: pass (all 32 passed). The first run failed `check:engine-boundary` until 95e542c879.
- `npm run lint -w @weasel-js/core` and `-w @weasel-js/editing`: not run, because neither package has a `lint` script (npm error: missing script). I ran eslint on every changed file instead: pass.
- No browser tests were touched.
- The tree is clean.

tally: 6 of 6 fixed, 0 extra fixed