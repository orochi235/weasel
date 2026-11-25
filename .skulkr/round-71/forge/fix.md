**4 of the 11 findings fixed (one pair was the same defect); the other 6 were not defects, 5 of them carried findings that no longer apply.**

argTypes-only arg typed `boolean`, `string`, or `enum` gets no control (A): fixed b49b19fddc

`weaselforge build --out <root>` builds into the vite root (A): fixed 5f15a84253. I made the strict call (refuse) and recorded it in `docs/unruled.md`.

`sameKnob` treats an `undefined` list member as absent (A): fixed eadcbbf3cd

sameKnob ignores array length (B): duplicate of "`sameKnob` treats an `undefined` list member as absent" (A)

describeSchema drops a nested leaf's `encoding`, so a link's encoded entries are refused (B): fixed e1bb53798c

boundsOf drops a finite bound when the other is non-finite (B): not a defect. `docs/unruled.md` (2026-11-16) rules that bounds not both finite, `max: Infinity` named, count as none. A lone finite bound with the other one *absent* is kept.

[r47-1] select/radio with non-string options disappears or becomes a free field (carried): not a defect (no longer applies). Number, boolean, and null options now map through `String`, and other options warn and fall back to a structured leaf.

[r47-6] describeSchema copies function-valued annotations into `ready` (carried): not a defect (no longer applies). `dataOf` drops functions, and a test checks the description with `structuredClone`.

[r47-8] description drops `enableIf`, `auto`, `resettable`, `motif`, and `dialog` (carried): not a defect. The first three are carried now (`gated`, `auto`, `resettable`). Leaving out `motif` and `dialog` was ruled in `docs/unruled.md` on 2026-11-21.

[r47-9] a cleared clearable number writes no URL param (carried): not a defect (no longer applies). `isClearedKnob` makes `knobsToParams` write an empty param, and `parsedKnob` reads it back as `undefined`.

[r47-11] an arg holding a Proxy gets a control and fails the `ready` post (carried): not a defect (no longer applies). `isPortSafe` now also requires `structuredClone` to succeed, and a Proxy fails that.

Extra: `sameKnob` would have treated a hole in a sparse list as equal to any value (`[, 1]` vs `[5, 1]`). It is fixed inside eadcbbf3cd: holes now read as `undefined`. It was caught while writing that fix, never shipped, so it is not counted below.

Checks:
- `npx vitest run --maxWorkers=1` on `cli/policy.test.ts`, `cli/cli.pbt.test.ts`, `route/url.test.ts`, `route/url.pbt.test.ts`, `csf/argsToSchema.test.ts`, `csf/csf.pbt.test.ts`, `csf/loadCsfModule.test.tsx`, `csf/portSafe.test.ts`, `protocol/schema.test.ts`, `protocol/protocol.pbt.test.ts`, and `protocol/messages.test.ts`: pass.
- `npm run checks:gate`: "checks:gate: all 33 passed".
- `npm run check:changesets`: "OK — 454 changeset(s)".
- `npm run lint -w @weasel-js/forge`: forge has no `lint` script, so it can't run. `npx eslint` on every changed file passes.
- The tree is clean.

tally: 4 of 11 fixed, 0 extra fixed