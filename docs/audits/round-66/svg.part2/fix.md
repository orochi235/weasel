- Unreadable fill/stroke function paints black (A+B) — fixed d3b6fb4295
- Marker-carrying `stroke="none"` loses its markers on unpack (A) — fixed 6d0bfd2632
- Text run with a non-finite dash inherits the node's stroke, and text inheriting a group stroke keeps it (A) — fixed f55caa88ac
- `<use>` of a `display="none"` target dropped under `keepHidden` (A) — fixed 2245fa32e7
- `stroke-dasharray` in an unconverted unit drops the declaration (A) — fixed a98fc89aad
- Pattern `x`/`y` read with `parseFloat`, giving a unit as its bare number and a NaN origin (A+B) — fixed 044c3e070e
- Namespace prefix counted as a type selector in specificity (A) — fixed aab802cfdf
- `<title>`/`<desc>`/`<metadata>` in `<defs>` warn as unsupported (A) — fixed 328d152ff5
- `<image>` with no width/height imports at zero size with no warning (B) — fixed 19ec98a376
- [r63-1] Negative stroke-width/font-size kept (carried) — not a defect (no longer applies: both are dropped with a warning)
- [r63-2] tspan `font-style="normal"` fails to undo italic (carried) — not a defect (no longer applies: the run reads `italic: false`)
- [r63-3] viewBox rejects abutting numbers (carried) — not a defect (no longer applies: `parseViewBoxAttr` reads them)
- [r63-4] Unclosed style block loses its last character (carried) — not a defect (no longer applies)
- [r63-5] font-weight `lighter` not read (carried) — not a defect (no longer applies: it computes against the parent's weight)
- [r63-6] `dominant-baseline="text-top"` read as a baseline anchor (carried) — not a defect (no longer applies: it is a top anchor)
- [r63-7] Pattern export ignores `units` (carried) — not a defect (already ruled in `docs/unruled.md` round 63: it warns)
- [r63-8] Document `<marker>` ignored when its id matches a kit marker key (carried) — not a defect (no longer applies: the document's marker gets a renamed id)
- [r63-9] Image pattern's `patternTransform` warnings dropped (carried) — not a defect (no longer applies: the warning comes through)
- [r63-10] Conic gradient center ignores `userSpaceOnUse` (carried) — not a defect (no longer applies: it is read through `coord` with its units)
- [r63-11] tspan user-space stroke gradient not carried through the text's transform (carried) — not a defect (no longer applies: the gradient is transformed)
- [r63-12] Run fill/stroke takes the node's opacity on write (carried) — not a defect (no longer applies: `fill-opacity="1"` and `stroke-opacity="1"` are written)
- [r63-13] Nested `<tspan>` loses its styling silently (carried) — not a defect (no longer applies: it now warns)
- [r63-14] Same-local-name namespaced attributes overwrite each other (carried) — not a defect (no longer applies: each keeps its prefix)

Extra:
- A viewBox with a negative width or height was accepted and flipped percentages and markers (sweep) — fixed 6ffefafb4c

The changeset titles first ran over 140 characters, which failed `check:changesets`. One follow-up commit shortens them: "shorten the titles of this round's svg changesets".

Checks:
- Each touched test file run alone with `--maxWorkers=1`: cascade, dashes, gradients, lengths, patterns, roundtrip.image, unpack, use, viewBox — pass. The whole svg weasel-ui project (96 files, 1249 tests) also passed before the viewBox commit.
- `npm run checks:gate` — pass ("all 32 passed")
- `npm run lint -w @weasel-js/svg` — not run: the package has no lint script. I ran eslint on the changed svg files instead — pass.
- `npm run check:size` — pass
- `npm run check:changesets` — pass

tally: 9 of 23 fixed, 1 extra fixed