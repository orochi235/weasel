## gen-brand-colors overwrites legoColors.ts with an empty palette when Brickset answers with anything but the expected page
- where: apps/theme-editor/scripts/gen-brand-colors.mjs:45 (lego), :73 (writeFileSync)
- scenario: Brickset returns a 403/429/503 or a bot-challenge page to the scripted `fetch` (the spoofed user-agent alone does not pass a challenge), or renames the `<article class='set'>` / `type-Solid'` markup. `fetch(...).then((r) => r.text())` never checks `r.ok`, the split finds no blocks, `legoRows` is `[]`, and the script writes `export const LEGO_COLORS = [\n];` over the committed table and logs a count of 0 for LEGO, then exits 0. It should fail (non-2xx status, or zero rows) and leave the existing file alone.
- evidence: read
- severity: medium

## gen-brand-colors writes to cwd-relative paths, so running it from anywhere but the repo root throws or writes outside the app
- where: apps/theme-editor/scripts/gen-brand-colors.mjs:74, :98
- scenario: `cd apps/theme-editor && node scripts/gen-brand-colors.mjs` resolves `apps/theme-editor/src/palette/legoColors.ts` against `apps/theme-editor/`, and `writeFileSync` throws ENOENT after both network fetches complete. No npm script pins the cwd. Paths should resolve from `import.meta.dirname`.
- evidence: read
- severity: low

## Copic rows with no name are emitted as `name: undefined`, which breaks the generated file's `readonly name: string` type
- where: apps/theme-editor/scripts/gen-brand-colors.mjs:66-67, :119 (copic)
- scenario: the filter requires `extractedColor` and `number` but not `name`. An upstream entry missing `name` produces `JSON.stringify(undefined)`, i.e. the literal `undefined` in `copicColors.ts`, and typecheck fails on the generated file. `extractedColor` is also never validated as a 7-character hex before being written into a `hex` field.
- evidence: read
- severity: low

## Generated row order depends on the machine's default locale
- where: apps/theme-editor/scripts/gen-brand-colors.mjs:59, :68
- scenario: `localeCompare` with no locale argument uses the runtime default ICU locale, so two machines with different locales (sv, de, tr, for example) sort names with diacritics or case differently. Re-running the script then reorders `LEGO_COLORS`/`COPIC_COLORS` and produces a diff even when nothing changed upstream. It should pass a fixed locale (`'en'`).
- evidence: read
- severity: low

## Files read
apps/theme-editor/icons/index.mjs
apps/theme-editor/scripts/gen-brand-colors.mjs
apps/theme-editor/vite.config.ts

<!-- done: 4 findings, files read: 3 -->
