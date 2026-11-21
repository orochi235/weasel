All five carried findings checked against the frozen tree. None needs a new fix, so I made no commits.

[r47-1] select/radio with non-string options (carried, A+B): not a defect (no longer applies). `optionChoice` in `packages/forge/src/csf/argsToSchema.ts` now reads number, boolean, bigint, null and undefined options through `String()`. Options with no string form, or ones that read alike, log a `console.warn` and fall back to a field typed from the arg's value. `argsToSchema.test.ts:101-103` covers both cases.

[r47-6] function-valued annotations in the `ready` message (carried, B): not a defect (no longer applies). `describeShape` now passes annotations through `dataOf`, which drops functions. The frame runs an action's `run` (`runsInFrame`, commit 9452ec197d). Covered by `schema.test.ts:83-89`.

[r47-8] schema description drops `enableIf`, `auto`, `resettable`, `motif` and `dialog` (carried, B): question (whether to take on the rest now). Commit f3f4f31a27 fixed `enableIf` (the frame answers it, sent as `gated`) and `resettable`. The other three are filed as a P3 in `docs/TODO.md` ("An isolated story's `.auto()` leaf, `.dialog()` row and group `.motif()` do not reach the workshop's panel"):
- `auto` stores the `AUTO` symbol, which a port cannot post.
- `dialog` and `motif` are renderers that live in the frame.

That takes a protocol change (the frame drawing rows for the panel), too big for this pass.

[r47-9] cleared clearable number writes no URL param (carried, B): not a defect (no longer applies). `knobsToParams` now writes an empty param for a cleared knob (`isClearedKnob`), and `decodeKnob` reads `''` on a clearable number or enum back as cleared. Covered by `url.test.ts:143`.

[r47-11] an arg holding a Proxy gets a control (carried, B): not a defect (no longer applies). `isPortSafe` now also requires `structuredClone` to succeed, and `splittable` won't split a Proxy whose members each cross on their own. Covered in `portSafe.test.ts` and `argsToSchema.test.ts`.

No extra defects found.

Checks: none run. I changed nothing, so there were no touched test files and no packages to lint. I skipped `checks:gate` because the tree is still the unchanged frozen commit. The tree is clean.

tally: 0 of 5 fixed, 0 extra fixed