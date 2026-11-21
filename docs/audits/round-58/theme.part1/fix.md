axisScheme recursion forever on a default missing from its values (A, B): fixed 018de11e06 (axisScheme stops recursing) + 5b96968cc5 (`defineTheme`/`fromDtcg` now refuse such a default, and a DTCG doc with no base and no `dark` mode defaults to its first mode; my call, recorded in `docs/unruled.md`)
B's matching finding: duplicate of A's, both fixed by the two commits above
fromDtcg accepts axes named `theme`/`variant` (A): fixed db1acaaf9e
B's matching finding (`theme`/`variant`/`__proto__`): duplicate of A's, fixed db1acaaf9e
blendTheme snaps between a bare `0` and px instead of mixing (A): fixed b75fd82260
B's matching `0` ↔ `4px` finding: duplicate of A's, fixed b75fd82260
generated color list cache grows without bound (A): fixed 7490aa21c6 (keeps the 16 most recent)
B's matching generatedColors cache finding: duplicate of A's, fixed 7490aa21c6
fromDtcg passes a non-string `$description` that emitCss throws on (A): fixed 156a575b55 (refused, naming the token)
DTCG alpha outside 0–1 becomes an invalid color-mix() (A): fixed 71ca58cb0f (refused in `fromDtcg` and `defineTheme`, reported by `derive`'s ref rule, held to 0–1 in withAlpha/mixAlpha/atAlpha; my call, recorded in `docs/unruled.md`)
B's matching withAlpha/mixAlpha disagreement: duplicate of A's, fixed 71ca58cb0f
fontStack writes a family with an apostrophe as broken CSS (A): fixed 7c9a9e7e85 (quoted and escaped, any non-identifier family quoted, and parseTokenValue reads it back)
B's matching fontStack finding, plus `3Dumb` left unquoted: duplicate of A's, fixed 7c9a9e7e85
axisScheme throws on an axis with no `values` (B): fixed 018de11e06
axis names never checked as attribute or CSS identifiers (B): fixed e38e5818e5 (letters, digits, `-` and `_` only; my call, recorded in `docs/unruled.md`)
colorCount reports the requested count, not the colors colorAt wraps over (B): fixed 92092c36cf
parseBoxShadow reads a calc() length as color, and `2PX` throws (B): fixed 1c0b4b3bba

Extra defects found while fixing: none. The alpha check in `derive`'s ref rule and the clamp in atAlpha were part of fixing the alpha finding everywhere it sat, not separate defects.

Note: in db1acaaf9e, the `fromDtcg` test for the name `my axis` passes only once e38e5818e5 is applied. The commits are meant to go in together.

Checks:
- `npx vitest run --maxWorkers=1` on each touched file: axes 11 passed, theme 11 passed, fromDtcg 10 passed, colorListItems 2 passed, blendTheme 9 passed, dtcg/flatten 13 passed, dtcg/color 9 passed, dtcg/value 10 passed, boxShadow 9 passed.
- Whole `weasel-ui` project over packages/theme: 78 files, 590 tests passed.
- `npm run checks:gate`: all 32 passed. The first run had 3 of 32 fail, from a type error in a test and changeset titles over 140 characters. Both were fixed and squashed into their commits before the passing rerun.
- `npm run lint -w @weasel-js/theme`: package has no lint script, so npm errored. Ran `npx eslint packages/theme/src` instead: pass, no output.
- Browser tests: none touched, none unrun.
- Tree clean.

tally: 17 of 17 fixed, 0 extra fixed