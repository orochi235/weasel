Notched corner arcs overran the badge at eccentricity ≠ 1 (A): fixed d54ff6fc6f
Perforated hung at `holePitch` 0 and minted unbounded holes for a tiny pitch (A): fixed 17499bcbbb (pitch floored at 1px; recorded in `docs/unruled.md`)
Shield top-corner arcs reached below the shoulder or past half the width (A): fixed 1ed842b0a1
Coffin read `shoulderHalfHeight` as an increment over the head's (A): fixed 048046af77. It is now an absolute half-height with a default of 50, which draws the same coffin as before, and ui-lab's slider now spans 2..50. Recorded in `docs/unruled.md` as a behavior call nobody has ruled on.
Sparkler and Starburst did not validate `points` (0, fractional, Infinity) (A): fixed d86a66b431. A shared `repeatCount` floors the count and holds it to 3..256. Receipt's `teeth` gets the same 256 cap; the cap is recorded in `docs/unruled.md`.
A `shapeParams` key set to undefined overrode the default and gave NaN geometry (A): fixed f8e5d1b876. A shared `withDefaults` now does the merge in every shape and in `Badge.tsx`'s merge.
Reviewer B's report was empty.

Extra: Perforated imported `useEffect` without using it and kept a `void useEffect` line to hide that: fixed 4f883fc232
Extra, not fixed: `bases/*` (RoundedRect, Puzzle, OctantBSpline, Quatrefoil, Ribbon, Powerline, OctantSpline) merge `baseParams` with the same `{ ...DEFAULTS, ...params }` spread, so they have the same undefined-key bug. Those files belong to the bases area, outside this one, so I left them alone to avoid conflicting with that area's fixer. This is not filed anywhere yet.

Checks:
- `shapes/params.test.tsx`: pass (26)
- `shapes/Notched.test.tsx`: pass (5)
- `shapes/Shield.test.tsx`: pass (2)
- `shapes/Perforated.test.tsx`: pass (2)
- `shapes/Coffin.test.ts`: pass (2)
- `shapes/index.test.tsx`: pass (10)
- `Badge.test.tsx`: pass (40)
- `catalog.test.ts`: pass (4)
- `apps/ui-lab/src/badge/paramParity.test.ts`: pass (47)
- Each new test failed before its fix, run against the code with the fix reverted.
- `npm run checks:gate`: "checks:gate: all 32 passed"
- `npm run lint -w @weasel-js/ui`: unrun, because `@weasel-js/ui` has no lint script and ui-lab is not a workspace. Instead `npx eslint` on every changed .ts and .tsx file: pass (exit 0).
- Tree clean.

tally: 6 of 6 fixed, 1 extra fixed