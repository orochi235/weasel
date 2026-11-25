# Audit round 55 — text-shaping (blind reviewer)

## scriptPieces does not pair canonically equivalent angle brackets, which bidi's own bracket pairing does
- where: packages/text-shaping/src/scripts.ts:100-111 (scriptPieces)
- scenario: `abc 〈שלום〉 def` (U+2329 opens, U+3009 closes; U+2329/U+232A are canonically equivalent to U+3008/U+3009). The open records `close: 0x232A` from `pairedBracket`, the `〉` is compared with `!== cp` and never matches, so the closing bracket stays in the Hebrew piece. It gets shaped right to left and mirrored, while the Latin text resumes after it. `@weasel-js/bidi` (`implicit.ts` `canonicalBracket`, BD16) does pair these two, so bidi and the script cutter disagree on the same pair. It should go with the Latin piece, the way `abc (שלום) def` does. The property-test fixture (`pbt.fixture.ts` OTHER) generates both `〈` and `〉` but has no assertion that pairs them.
- evidence: read (scripts.ts compares raw `bracket.pair` with `cp`; bidi/src/implicit.ts:19-26 canonicalizes both sides)
- severity: low

## glyphD throws a RangeError for a non-finite offset instead of returning path data
- where: packages/text-shaping/src/shaper.ts:82-87 (fmt), called from glyphD :202
- scenario: `glyphD(face, gid, NaN)` (or `Infinity`, e.g. a pen position from a layout with a NaN or infinite letter spacing or size). `scaled` is not finite, so `r = v` (NaN or Infinity), `Math.abs(r) < 1e21` is false, and `BigInt(NaN)` / `BigInt(Infinity)` throws `RangeError: ... cannot be converted to a BigInt`. The `Number.isFinite(scaled) ? … : v` branch exists to let such values through, but the `BigInt` branch then turns them into a throw out of a drawing call. It should return the value unchanged (or refuse with a documented error), not crash on a branch meant only for huge integers.
- evidence: read (traced fmt by hand; not run)
- severity: low

## The parsed-feature cache in HarfBuzzShaper has no bound
- where: packages/text-shaping/src/shaper.ts:92, 114-123 (#feature)
- scenario: `#features` is a `Map` keyed by every distinct feature-setting string ever passed to `shape`, and it lives as long as the process-wide shaper (`loadShaper` answers one instance per process). Range settings make the key space open-ended: a caller turning a feature on for a selection (`kern[3:5]`, `smcp[120:131]`, …) adds one entry per distinct range, forever. Each per-face shape cache is capped at `SHAPE_CACHE_LIMIT`, but this one is not. It should be capped (or cleared) the same way.
- evidence: read
- severity: low

## Files read
packages/text-shaping/src/__fixtures__/fonts.ts
packages/text-shaping/src/index.ts
packages/text-shaping/src/pbt.fixture.ts
packages/text-shaping/src/scripts.ts
packages/text-shaping/src/shaper.ts

<!-- done: 3 findings, files read: 5 -->
