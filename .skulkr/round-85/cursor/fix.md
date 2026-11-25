Stroke width (A+B): fixed a02258d19c

Arc measured by its bounding square in `rotationFitsInBox` (A): fixed 5c5e097271

Arc radius too short for its chord (A): fixed 2706f6bcbd

`cursorFor` cache unbounded (A): fixed 4dd7a31c4b, now keeps the 512 most recently used entries

`resolveCursor` checks glyph and mark only on the CSS tier (A): fixed eef717c7a0

Sink leaves an override on the old element when `element()` changes (A): fixed 3b6c60e58b

`bakeCursor` writes attribute values unescaped (A): fixed 67308425a6

Empty fallback bakes an invalid declaration (A): fixed e0910de9c7, a blank fallback now bakes as `default`

Fit guards ignore a stroke's own width (B): duplicate of the A stroke-width finding

Clearing a base-less sink's override erases the cursor other code set (B): fixed fef41297f5. It puts back the value it replaced, unless other code has written over it since. The existing test that expected `''` was updated.

Sink element change (B): duplicate of the A sink finding

`brushRing(0, 'world')` bakes a 24 px ring (B): fixed e73f37e0f7. A zero world radius now gives the same one-pixel ring as `brushRing(0)`, and the 2026-11-10 entry in `docs/unruled.md` was extended to say so.

Hotspot can equal the image width (B): fixed 7fa430082e. It is now held to at most the width less one, and the property tests' model was updated to match.

Arc radius scale-up (B): duplicate of the A arc-radius finding

`walk` doesn't return to the subpath start on `Z` (B): fixed 29f28a28e5

Unescaped SVG attributes and fallback (B): the attribute half is fixed 67308425a6. The fallback half is fixed e0910de9c7 as a strict call: a fallback holding `;`, `{` or `}` throws a `RangeError`, recorded in `docs/unruled.md`.

`cursorFor` cache unbounded (B): duplicate of the A cache finding

Extra defects found while fixing:

- **Marked crosshair clipped** (sweep): fixed 8779ae901e. Under the corrected guard, every crosshair carrying a mark had its left and top arms' halo 0.5 units outside the box. The shift went from −3 to −2.5 in `scripts/glyphs/shapes.mjs` and `glyphs.ts` was regenerated. This is the clip carried finding r42-1 named.
- The guards now allow 1e-6 of slack. Without it, a half-circle's center comes out 1.7e-7 off, so `brush`'s ring, which touches the edge exactly, failed. That fix is part of a02258d19c. The polyline model in `mark.pbt.test.ts` allows the same slack.
- 56235bae42 shortens the titles of 10 changesets from this pass to under 140 characters. It is housekeeping, not a defect.

`carried.md` exists, but this brief did not say any findings were carried, so I did not count them. r42-1, r42-3 and r42-5 are covered by the fixes above anyway.

Checks:

- Each test file I touched, run on its own with `--maxWorkers=1`: `types.test.ts` 13 passed, `mark.pbt.test.ts` 5 passed, `bake.test.ts` 17 passed, `bake.pbt.test.ts` 7 passed, `registry.cache.test.ts` 1 passed, `resolve.test.ts` 13 passed, `brushRing.test.ts` 3 passed, `cursorSink.test.ts` 10 passed, `glyphs.test.ts` 58 passed.
- The core and routing tests that read `style.cursor` (3 files) ran in one call with `--maxWorkers=2` instead of one at a time: 15 passed.
- `npm run checks:gate`: "checks:gate: all 33 passed". It ran after the last code commit; the only commit after it changes changeset titles.
- `npm run check:changesets`: "OK — 1303 changeset(s)", with no warnings left on the cursor changesets.
- `npm run lint -w @weasel-js/cursor` doesn't run: the package has no lint script ("Missing script"). Running `npx eslint packages/cursor/src` reported nothing.
- No browser tests were touched. The tree is clean.

tally: 17 of 17 fixed, 1 extra fixed