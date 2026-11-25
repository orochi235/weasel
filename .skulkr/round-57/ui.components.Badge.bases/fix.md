octant-bspline badge dents at its cardinal and diagonal points (A): fixed 7eb8cde9d9. The old expected end values in `octantSplines.test.ts` were wrong and are replaced. `fittedOutline.test.ts`'s "pads further where it crosses one onto the content" depended on that dent, so it now uses a quatrefoil with `valleyR: 10`: 4af5a4ee70.

powerline's side-edge segments get the bottom normal, and every edge point gets a sideways one whatever its slope (A): fixed e9577844ab. Normals now come from `polygonSampler`, built from each edge's own direction.

rounded-rect at `erosion: 0, pinch: 1` returns a zero normal along its collapsed ends (A): fixed 3559209ffa. The outline's own normal is used where the pinched tangent vanishes.

ribbon with both ends tapered crosses itself on a narrow badge (A): fixed c319742030. The taper is held to `boxW / 2`, like the chamfered-rect's chamfer.

quatrefoil's smoothMax lifts its tips past `spikeR` and `lobeR` (A): fixed 1b16770872. It is now a polynomial smooth max, exact outside a band narrow enough to leave both tips alone; the valley lift at the defaults is still 1.5.

`resolveEdge` resolves prototype names like `'toString'` to Object.prototype functions (A): fixed 9b2141a507.

`PerimeterPoint`'s normal is documented in viewBox units but returned in CSS px (A): fixed e453dba817 (doc only, no changeset because the type isn't exported).

puzzle `tabSize` is documented as 0..50 but clamped to 2..40 (A): fixed a1c3366040.

B.md was empty, so there were no B findings.

Extra (sweep, outside this area, not fixed): `Badge.tsx:155` (`SHAPES[shape] ?? SHAPES.pill`) and `composeSpec.ts:26` (`BASES[key]`) do the same prototype-name lookup. I left them for the areas that own them.

Housekeeping: 0e5c8d3 shortens two changeset titles that were over 140 characters (powerline, quatrefoil).

Checks:
- vitest, one file at a time with `--maxWorkers=1`: `Powerline.test.ts` 18 passed, `Quatrefoil.test.ts` 6 passed, `Ribbon.test.ts` 2 passed, `edgeProfiles.test.ts` 20 passed, `inscribedRect.test.ts` 17 passed, `octantSplines.test.ts` 7 passed, `rectBases.test.ts` 4 passed, `fittedOutline.test.ts` 30 passed, `Badge.test.tsx` 40 passed, `catalog.test.ts` 4 passed, `apps/ui-lab/src/App.test.tsx` 4 passed.
- Unrun: `Badge.browser.test.tsx` (browser test, mentions quatrefoil).
- `npm run checks:gate`: all 32 passed. The first run failed on `check:changesets` (two titles over 140 characters), which I fixed before rerunning.
- `npm run lint -w @weasel-js/ui`: @weasel-js/ui has no lint script. `npx eslint` on the changed files passed.
- The tree is clean.

tally: 8 of 8 fixed, 0 extra fixed