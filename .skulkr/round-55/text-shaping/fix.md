Canonical angle brackets pair (A+B) — fixed 09c1003d76 (moved `canonicalBracket` from bidi's `implicit.ts` into its tables and exported it, so bidi and `scriptPieces` pair brackets by one definition; the bidi export has a `minor` changeset)
`glyphD` throws RangeError on a non-finite offset (A+B) — fixed a366275f0f (strict call: it now throws its own `RangeError` naming the offset, and `NaN` is refused too; recorded in `docs/unruled.md`)
Parsed-feature cache has no bound (A) — fixed c7cd7b1b0d (capped at 256 and cleared when full, as the shape cache is)
Non-ASCII feature setting throws "Expected ASCII text" and leaks HarfBuzz memory (B) — fixed d8848f283f
Non-ASCII `lang` throws mid-layout and leaks heap (B) — fixed f2b7a4c887 (strict call: refused with an error naming the tag before the cache read, no override; recorded in `docs/unruled.md`)
Canonical angle brackets (B) — duplicate of the A+B bracket finding above
`glyphD` infinite offset (B) — duplicate of the A+B `glyphD` finding above
Parsed-feature cache bound (B) — duplicate of the A+B cache finding above (fixed c7cd7b1b0d)
Node detection disagrees with harfbuzzjs's loader in an Electron renderer (B) — fixed 4384d97f16 (`isNodeRuntime` now runs the vendored loader's own test, `process.type !== 'renderer'`; the test covers the check alone, since no Electron renderer can run here)

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1` on `packages/text-shaping/src/scripts.test.ts`: pass (12)
- `packages/text-shaping/src/shaper.test.ts`: pass (15)
- `packages/text-shaping/src/loadShaper.runtime.test.ts`: pass (1)
- `packages/text-shaping/src/scripts.pbt.test.ts`: pass (3)
- `packages/text-shaping/src/shaper.pbt.test.ts`: pass (6)
- `packages/bidi` (all files): pass (133)
- text's `shapingWarning.test.ts` and `layoutEntries.shaped.test.ts` (weasel-ui): pass (2 and 11)
- Before their fixes, the bracket, `glyphD`, feature-setting, language, and cache tests each failed.
- `npm run checks:gate`: pass, "checks:gate: all 32 passed"
- `npm run check:changesets`: pass, "OK — 2596 changeset(s)"
- `npm run lint -w @weasel-js/text-shaping` and `-w @weasel-js/bidi`: unrun, because neither package has a `lint` script. eslint on every changed `.ts` file: pass.
- The tree is clean.

tally: 9 of 9 fixed, 0 extra fixed