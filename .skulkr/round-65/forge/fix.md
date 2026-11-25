- A CSF argType's `if` ignores frame-local args (A): question. Is it the trial's render or each Live lens copy that decides, since each holds its own local args? And how should labkit's in-page panel rerun its predicates on a change that isn't a config change? Both need settling first, so I filed a TODO entry in 687111683c with a condition that closes it.
- A render with a default or rest parameter loses its prop controls (A): fixed 7193f8dc08
- A URL number outside its leaf's range goes into the config unclamped (B): fixed fc31cd1498. Nested numbers are clamped too.
- runStory ignores the story's own `globals` (B): fixed d429f3c2a4. The same gap was in the in-page workshop host and its Live lens copies, and those are fixed in the same commit.
- sameKnob treats Infinity, -Infinity, NaN, and null as one value (B): fixed a3643fadfb
- withUnsent restores list entries by index, so callbacks move after a delete (B): fixed 82ae2e1f50. The strict call for the ambiguous case is recorded in `docs/unruled.md`.
- The URL drops every `$`-prefixed key, not just the ones forge owns (B): fixed e0715c191a
- [r47-1] A `select`/`radio` with non-string options disappears (carried): not a defect (no longer applies). 51febda329 draws number, boolean, and null options as a choice, and it warns for object options, which Storybook itself cannot label apart.
- [r47-6] `describeSchema` copies function-valued annotations into `ready` (carried): not a defect (no longer applies). `dataOf` strips functions, and the "ships no function an annotation holds" test covers it.
- [r47-8] The schema description drops `enableIf`, `auto`, `resettable`, `motif`, and `dialog` (carried): fixed 37c15faaa9.
  - `enableIf` and `resettable` already crossed.
  - `auto`, `autoQuote`, and `autoResolve` now cross, with the frame answering `autoResolve`.
  - `motif` and `dialog` are renderers that run in the frame, so they can't be carried; that call is in `docs/unruled.md`.
  - The commit also retires the matching P3 TODO entry. Its premise was that the `AUTO` symbol would cross the port, but labkit keeps auto paths outside the config, so it never does.
- [r47-9] A cleared clearable number writes no URL param (carried): not a defect (no longer applies). `isClearedKnob` writes an empty param.
- [r47-11] A Proxy arg gets a control whose default fails `ready` (carried): not a defect (no longer applies). `clones` and `splittable` refuse a Proxy, and tests in `argsToSchema.test.ts` and `portSafe.test.ts` cover it.

Extra:
- The frame's answer key and the frame-local args' cover collapsed Infinity, -Infinity, and NaN to null (sweep). A config moving between them kept stale show, hide, and validate answers, because the frame never answered again. Fixed 3390304b25 with a new `configKey` in `protocol/messages.ts`.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file: `loadCsfModule.test.tsx` pass, `portSafe.test.ts` pass, `schema.test.ts` pass, `url.pbt.test.ts` pass, `url.test.ts` pass, `answers.test.ts` pass, `runStory.test.ts` pass.
- `npm run checks:gate`: fail on the first run (2 of 32: `typecheck` and `typecheck:packages`, both from a type error in `schema.test.ts`, fixed and folded into 37c15faaa9), then pass (`all 32 passed`).
- `npm run check:changesets`: pass
- `npm run lint -w @weasel-js/forge`: forge has no lint script. eslint on every changed forge source file: pass.
- The tree is clean.

tally: 8 of 12 fixed, 1 extra fixed