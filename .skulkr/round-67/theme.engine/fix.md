- A child entry loses to the parent's same-named entry in another layer (A): fixed 98a3f7f77e
- An element stamping only `data-wzl-theme` inherits the outer theme's axis-varying tokens (A): fixed 4eb4ad435e
- `bake` lists ramps that `derive` drops as unsafe (A): fixed e117eef7da
- Duplicate categorical anchor names are claimed in palette order, not definition order (B): fixed 1feb5ddc56. The part saying the renamed duplicate fills a step literally named `brand-2` is not a defect: no anchor names that step, so the 2026-11-21 ruling ("fills a step no anchor names") allows it.
- A pin over a semantic that failed at this selection is never reported untyped (B): not a defect. The test "does not report an untyped pin over a semantic whose rule failed" (`derive.test.ts:203`) pins this behavior on purpose. The rule's failure is already reported, and the pin takes the rule's type once the rule is fixed.
- `axisDependencies` ignores a component that `derive` uses where a same-named by-axis semantic has no value (B): fixed cf1fd39fb3
- `fillFromParent` fills only the top-level axis a child pin leaves out (B): fixed c950743a7f
- [r56-2] A child's by-axis pin brings back the parent's pin on a step the child generates (carried): not a defect (no longer applies). `parentPin` returns nothing for a name the child produces itself.
- [r56-5] `feasible` describes the palette before equalization (carried): not a defect (no longer applies). `generate` checks the gates again on the equalized hexes.
- [r56-6] `order: 'hue'` sorts anchors by raw hue (carried): not a defect (no longer applies). Anchors are passed through `wrapDeg` before sorting.
- [r56-7] A two-axis token is declared only in blocks naming both axes (carried): not a defect (no longer applies). `blocks` now declares such a token in every subset, per the 2026-11-21 ruling.
- [r56-8] A token only a non-default theme declares is never reset (carried): not a defect (no longer applies). `defaultLacks` and `lacks` write `initial` for it.
- [r56-11] `derive` reads a dotted reference whole (carried): not a defect (no longer applies). `refName` now goes through `refTarget`, which strips the group.

Extra defects, found while fixing:
- An element stamping only a theme also kept the outer element's `color-scheme` (sweep): fixed in 4eb4ad435e, the same `:where([data-wzl-theme])` block now writes the default axis value's scheme.
- A child scale beat a parent ramp step of the same name, or was reported as a duplicate of it (sweep): fixed in 98a3f7f77e, by the same per-layer rule.

Checks:
- Test files run one at a time with `--maxWorkers=1`, all pass: bake, merge, merge.pbt, merge.shrunk, deps, deps.shrunk, derive, derive.pbt, derive.shrunk, derive.malformed.pbt, bake.pbt, bake.shrunk, semantics, ramps, color/generate, color/generate.pbt, color/generate.shrunk, emit/emit, emit/css.pbt, emit/tokens, generated/generated, generated/tokens.generated.
- `npm run checks:gate`: pass ("all 32 passed"). The first run failed typecheck on a test literal; that is fixed and the rerun passed.
- `npm run lint -w @weasel-js/theme`: fail, because the package has no `lint` script. In its place, eslint on every changed `.ts` file: pass (exit 0).
- `npm run check:changesets`: pass.
- The tree is clean.

tally: 6 of 13 fixed, 2 extra fixed