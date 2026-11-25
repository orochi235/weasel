## gen-brand-colors overwrites legoColors.ts with an empty list when Brickset answers with an error or block page
- where: apps/theme-editor/scripts/gen-brand-colors.mjs:45 (lego)
- scenario: Brickset returns a 403/429/Cloudflare challenge page (likely for a scripted fetch with a spoofed UA). `fetch` doesn't reject on a non-2xx status and `r.ok` is never checked, so `html.split("<article class='set'>")` finds no blocks and `lego()` returns `[]`. The script then writes `LEGO_COLORS = []` over the committed file and prints `lego: 0 ...` with exit code 0, so the LEGO tab in SwatchPanel shows 0 swatches. It should fail on a non-OK response, or on zero rows, and leave the file alone. The same applies to copic() (line 64): an error body there makes `r.json()` throw, but a 200 with an unexpected shape can still write an empty COPIC_COLORS.
- evidence: read
- severity: medium

## Brickset color names are written without decoding HTML entities
- where: apps/theme-editor/scripts/gen-brand-colors.mjs:48 (lego)
- scenario: `name` is the raw contents of an HTML `title="..."` attribute. A name holding `&`, `'`, or a non-ASCII character that the page encodes as `&amp;`, `&#39;`, or `&eacute;` is emitted verbatim, e.g. `"Sand &amp; Blue"`, into LEGO_COLORS and shown that way in the swatch label. The dedupe on line 56 also compares encoded strings. No current entry is affected (grep of legoColors.ts finds no entities), so the problem is latent until upstream adds such a name.
- evidence: read
- severity: low

## Copic codes are sorted out of Copic's own order within the 0/00/000/0000 tiers
- where: apps/theme-editor/scripts/gen-brand-colors.mjs:68 (copic)
- scenario: `localeCompare(..., { numeric: true })` gives B00, B000, and B0000 the same numeric value, so the tie is broken arbitrarily. The generated file has `B00, B000, B0000, B01`, while Copic's range runs lightest first: B0000, B000, B00, B0, B01. SwatchPanel renders COPIC_COLORS in array order, so each family's palest markers appear reversed. The same applies to every family that has 000/0000 codes (BG, BV, E, R, RV, Y, YR, and others).
- evidence: read (generated apps/theme-editor/src/palette/copicColors.ts, lines with B00/B000/B0000)
- severity: low

## The generator writes cwd-relative paths, so running it from anywhere but the repo root fails or writes elsewhere
- where: apps/theme-editor/scripts/gen-brand-colors.mjs:74,98
- scenario: `writeFileSync('apps/theme-editor/src/palette/legoColors.ts', ...)` resolves against `process.cwd()`. Running `node scripts/gen-brand-colors.mjs` from `apps/theme-editor` throws ENOENT after both network fetches have succeeded. No npm script wraps it (none in the root package.json, and apps/theme-editor has no package.json), so cwd is whatever the caller has. The script should resolve its output paths from `import.meta.dirname`.
- evidence: read
- severity: low

## theme-editor's base path is `/weasel/theme-editor/`, but fleet-dev advertises its URL at `/`
- where: apps/theme-editor/vite.config.ts:23 (base), against scripts/fleet-dev.mjs:24
- scenario: `npm run dev:fleet -- theme-editor` prints `http://<node>:33454/` (fleet-dev.mjs:91 appends `APPS[n].path`). Vite serves the app under `base`, so that URL gets Vite's "did you mean /weasel/theme-editor/" page instead of the app. draw and ui-lab list their base as the path, so the two files disagree on where this app lives. The same mismatch exists for chart (`base: '/weasel/chart/'`, path `/`).
- evidence: read
- severity: low

## Files read
apps/theme-editor/icons/index.mjs
apps/theme-editor/scripts/gen-brand-colors.mjs
apps/theme-editor/vite.config.ts

<!-- done: 5 findings, files read: 3 -->
