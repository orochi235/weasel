A.md was empty, so all seven findings come from B. I list them below as B.

- Derive's reference check keeps the type group in `{color.brand-500}` and throws that it is not defined (B): fixed 688b202fb3
- A fractional `offset` creates `{ramp-undefined}`, then derive throws (B): fixed e1ad529f54. `atStep` now also refuses a step index that isn't a whole number.
- `{seeds.name}` in a semantic `value` rule throws, while components and pins resolve it (B): fixed cba1e56046
- A white, black, or gray anchor pulls its arbitrary hue across the blended steps (B): fixed 14fc4627cb
- Bake drops every token when an axis has no values (B): not a defect. `docs/unruled.md` already has the ruling "An axis with no values enumerates no selections, so it bakes nothing" (Ruled 2026-11-11).
- Categorical anchors' chroma, lightness, and hue are never range-checked (B): fixed 7a94c505d3. A negative chroma or a lightness outside 0 to 1 is reported, and hue now wraps around the circle inside `generate`. The fix exports `wrapDeg` from `@weasel-js/paint`, which is new public API with its own changeset.
- A lightness anchor on a step the ramp doesn't declare is silently ignored (B): fixed 781c5e2052

Extra: none. 9fb31d2117 only shortens four of my own changeset titles that went over the 140-character limit.

Checks:
- `npx vitest run --maxWorkers=1`, each file on its own:
  - `engine/derive.test.ts`: pass (50)
  - `engine/semantics.test.ts`: pass (31)
  - `engine/ramps.test.ts`: pass (13)
  - `derive.malformed.pbt`, `derive.pbt`, `ramps.pbt`, `bake.pbt`, `deps`, `semantics.shrunk`, `color/generate.pbt` and `color/generate.shrunk`: pass
- `npm run checks:gate`: pass, all 32
- `npm run check:changesets`: pass
- `npm run lint -w @weasel-js/theme` and `npm run lint -w @weasel-js/paint`: unrun, because neither package has a `lint` script. In their place, eslint on every changed `.ts` file: pass.
- The tree is clean, with everything committed.

tally: 6 of 7 fixed, 0 extra fixed