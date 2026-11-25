CFF check skips a `CFF ` table whose version byte is not 1, and never checks a `CFF2` table (A): fixed 0bee73c665. A CFF2 header still passes unread, as the doc comment says. Any version other than 1 or 2 is now refused, which is the strict call, recorded in `docs/unruled.md`.

`enableLocalFontOutlines` overwrites outline faces the app registered itself (A): fixed d1c44bbfab. Such a face is now kept and counted in a new `kept` field on the result, and `replace: true` restores the old overwrite. This is the strict call, recorded in `docs/unruled.md`, and its changeset is `minor` because it adds API.

PostScript name read in two places that can disagree, and read past the end of the `name` table (A): fixed 7382937dce. Member picking, the variable-font check and the embedding now share one reader. It stays inside the `name` table and reads Windows records as UTF-16.

Empty PostScript name picks a collection's first member and reports a match (A): fixed dd18456430.

`FaceEmbedding.embeddable` doc contradicts the OS/2 version 0–2 rule (B): fixed 77f71492d5. Only the doc changed, so there is no failing test for it.

Unmatched collection member reported as a truncation error when the first member is damaged (B): fixed 94345a8281. `sfntFromCollection` no longer copies out a member on a miss and returns `bytes: null`.

`parseFontStyle` and `styleQualifierCount` use different word tests (B): fixed fbf536e6ba. The reviewer's example was wrong: "Condensed Demi Italic" scores 2, not 1, so it doesn't tie. The defect is real for pairs like "Demi Oblique" vs "Condensed DemiBold Italic" and "Ultra Thin" vs "Wide Thin", which the test uses.

DOM read started after the load settled keeps the font's bytes for the life of the registration (B): fixed 90ee1b7cf1.

Extra defects:

An installed face with an empty PostScript name got `local("")` as its DOM source (sweep): fixed c921c7ff16. DOM text now loads the face's own bytes.

116bce5065 only shortens my changeset titles to under 140 characters and sets the `kept` changeset to `minor`; it fixes nothing.

Checks:
- Each touched or related test file, one at a time with `--maxWorkers=1`: pass. That is cffCheck (5), dataFork (8), localFonts (18), opentypeCff (1), outlineRegistry.read (1), sfnt.pbt (6), sfnt (12), sfntNames (5), fontEmbedding (9) and outlineRegistry (29).
- Every new test was seen failing against the original source before its fix, apart from the doc-only change.
- `npm run checks:gate`: pass ("all 33 passed"), on the final commits.
- `npm run check:changesets`: pass (exit 0).
- `npm run lint -w @weasel-js/font`: unrun, because the package has no `lint` script. In its place, `npx eslint` on every changed `.ts` file: pass.
- No browser tests touched. The tree is clean.

tally: 8 of 8 fixed, 1 extra fixed