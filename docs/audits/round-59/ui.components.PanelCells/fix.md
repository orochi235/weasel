- Aliased object leaf: its fields are marked under the alias's key, but drawn under the target's path (A+B: A's 1st finding, B's 4th) — fixed 58bab1f101
- `panelSource` keeps one leaf per path, so `stateAt` and the reset gate answer for the wrong leaf (A+B: A's 2nd, B's 2nd) — fixed 79a4f64507
- `sharedRows` pairs an object's fields across sections and inside bars, where `ObjectLeaf` draws them apart (A+B: A's 3rd, B's 3rd) — fixed 6708f56d06
- Top-level leaves pair across the sections between them; nested ones don't (A) — not a defect. `flatten` deliberately draws every top-level leaf together in the leading untitled section. So a and b are neighbors as drawn, and the pair and its marks match what is on screen.
- An object leaf's action field never draws pressed in a selection panel, because `leafContext` hands no `activeAt` (B) — fixed e040d35249. This also adds `activeAt` to `PrefAliasTargets` in prefs (a minor changeset), so an alias into an `over` schema answers too.
- Across several kinds, every node is read, clamped, and reset under the first kind's leaf (B) — fixed f32101a612. This needed a behavior call nobody had made, so I made the strict one: a leaf is shared across kinds only where every kind's leaf differs at most in how it is drawn. It is recorded in `docs/unruled.md` under "Audit round fifty-nine". None of core's built-in kinds differ this way, so a mixed selection of them keeps every leaf it had.
- A glyph-named flag toggle in a paired object row takes an even share of the row (B) — fixed 19058437a4 (CSS only). It has no test, because only a browser layout test could catch it and none can run here.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `packages/ui/src/components/PanelCells/selection.test.ts`: pass (5)
  - `packages/ui/src/components/PanelCells/model.test.ts`: pass (2)
  - `packages/ui-canvas/.../SelectionPanel.fieldActive.test.tsx`: pass (3)
  - `packages/ui-canvas/.../SelectionPanel.reset.test.tsx`: pass (2)
  - `packages/prefs/src/aliasTargets.test.ts`: pass (6)
- All of `packages/ui-canvas/.../SelectionPanel/` and `PanelCells` under weasel-ui: pass (52 files, 354 tests)
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed on a type error in my new test; I fixed it into its commit.
- `npm run lint -w` for ui, prefs, and ui-canvas: none of these packages has a `lint` script ("Missing script: lint"). Instead, eslint on every changed file passes, and `check:size` reports "no file or function grew past its cap".
- `npm run check:changesets`: OK

The tree is clean.

tally: 9 of 10 fixed, 0 extra fixed