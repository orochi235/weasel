[A] generated `themes.ts` fails to compile when a selection lacks a token another has: fixed f7428c779d (strict call: `generateTokens` refuses such a set and names each gap; recorded in `docs/unruled.md`)
[A] a pin over a component drops the component's `scope`: fixed e0cb3eefae
[A] a repeated step name is accepted and the ramp collides with itself: fixed aa95de67f9
[A] a `ref` semantic reads its pinned target's rule for its type, so a cycle the pin breaks still throws: fixed 7b11fa941b
[A] `axisDependencies` lists step tokens that `derive` rejects: fixed aa95de67f9
[A] a categorical anchor's required `name` has no effect on which step it fills: fixed e3bdafce82 (strict call: the anchor fills the step its name names; a name that is no step, or a step an earlier anchor already fills, is reported `invalid` and the ramp still derives, because the theme editor names anchors by hue; recorded in `docs/unruled.md`)
[B] a `{seeds.name}` step is settled by derive but read raw by deps, merge, and bake: fixed aa95de67f9 (one step reader shared with derive; `declaredSteps` takes an optional definition, and the theme editor's callers now pass it)
[B] semantic rules measure a malformed pin or component that derive then rejects: fixed 3f4a0bed8f
[B] an `away` offset rule gets no dependency on the step it lands on: fixed 37f4ba48eb (an existing test had asserted the wrong answer, and I corrected it)
[B] a semantic's ramp position doesn't follow a component's reference: fixed bacacf9364
[r56-2] (carried) a child's by-axis pin brings back the parent's pin on a step the child generates: not a defect (no longer applies; aa35a8f1b4 fixed it, and the steps-varying-by-axis variant is pinned by the existing test "shadows only the pins on steps every branch declares")
[r56-5] (carried) `feasible` describes the palette before equalization: not a defect (no longer applies; `generate` runs `meetsGates` again on the equalized colors)
[r56-6] (carried) `order: 'hue'` sorts anchors by raw hue: not a defect (no longer applies; anchors are wrapped with `wrapDeg` first, and I ran hues -30, 330, and 400 and they sort as 330 and 40)
[r56-7] (carried) a token depending on two axes stays at `:root`'s value when only one axis attribute is set: fixed 5c2440e6a4 (real case: `apps/site/colorMode.ts` sets only `data-wzl-mode`; such a token is now also declared in each single-axis block, at the other axes' defaults; attributes split across nested elements still don't combine; recorded in `docs/unruled.md`)
[r56-8] (carried) a token only a non-default theme declares is never reset inside a nested theme: fixed 6f9145fc01 (the theme lacking it declares it `initial`)
[r56-11] (carried) `derive` reads a dotted reference whole: not a defect (no longer applies; every reader goes through `refTarget`, and I ran `derive` with a pin of `{color.accent}` and it gave no issue)

Extra defects: none.

Checks:
- each touched test file, run alone with `--maxWorkers=1`: bake 14 passed, deps 22 passed, derive 58 passed, emit 24 passed, tokens 6 passed, merge 10 passed, ramps 14 passed, semantics 33 passed. No browser test files were touched.
- `vitest run packages/theme apps/theme-editor`: 880 passed, 1 skipped.
- `npm run checks:gate`: all 32 passed. The first run failed on a test type, seven changeset titles over 140 characters, and one `check:proto-index` site; each fix was folded into its own commit.
- `npm run lint -w`: neither `@weasel-js/theme` nor theme-editor has a `lint` script, so it can't run per package. The root `npm run lint` passed inside the gate.
- Tree clean; 10 commits on 00475f5ac5, with 9 changesets.

tally: 12 of 16 fixed, 0 extra fixed