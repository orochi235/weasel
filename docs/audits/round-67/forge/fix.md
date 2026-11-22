- listWithUnsent turns an `undefined` entry's part into `null`, so removing an entry loses a callback (A): fixed fc069a0d90
- A control with `min`/`max` but no `type` drops its bounds (A): fixed cf88814fc9
- `build --out <root>` builds into the vite root (A): not a defect. `policy.test.ts` ("does not empty the root itself") pins building into the root as allowed without emptying it. The docstring's "never" is about emptying.
- One finite bound plus one infinite bound loses both (B): not a defect. `docs/unruled.md`, ruled 2026-11-16, says a bound like `max: Infinity` makes the control read as having no bounds at all.
- configKey gives `[undefined]` and `[null]` the same key (B): fixed fb3f563bef. The same fix covers Map and Set members.
- `.dialog()` is dropped when the schema crosses to the workshop (B): not a defect. Round 65 ruled that `.dialog` and `motif` are not carried (unruled.md, "Audit round sixty-five: forge").
- Keys holding a dot collide with nested paths in answers and `schemaActionAt` (B): fixed 3885b50259. Answer paths now escape a dot inside a key, and `answerSchema` walks the resolved group by key instead of looking leaves up by dotted path.
- [r47-1] A select/radio control with non-string options vanishes or becomes a free field (carried): not a defect (no longer applies). `optionChoice` takes number, boolean, null, and undefined options, and warns about the rest.
- [r47-6] Function-valued annotations get copied into `ready` (carried): not a defect (no longer applies). Annotations now go through `dataOf`, which drops functions.
- [r47-8] The schema description drops `enableIf`, `auto`, `resettable`, `motif`, and `dialog` (carried): not a defect (no longer applies). The first three are carried now (`gated`, `auto`, `resettable`), and round 65 ruled the last two out.
- [r47-9] A cleared clearable number writes no URL param (carried): not a defect (no longer applies). `isClearedKnob` writes an empty param, and `decodeKnob` reads it back as cleared.
- [r47-11] A Proxy arg gets a control and then fails the `ready` post (carried): not a defect (no longer applies). `isPortSafe` now requires `structuredClone` to succeed, and `splittable` refuses a Proxy.

No extra defects found.

Process note: by mistake I ran `git stash` once, which is shared across worktrees. The stack held only my own entry. I applied it back by SHA (56b078de4f) and dropped it after checking the SHA, so the stack is empty again and no one else's work was touched.

Checks:
- `npx vitest run --maxWorkers=1`: portSafe.test.ts 24 passed; argsToSchema.test.ts 58 passed; messages.test.ts 3 passed; schema.test.ts 13 passed. protocol.pbt.test.ts was not touched; 4 passed.
- `npm run checks:gate`: "checks:gate: all 32 passed".
- `npm run check:changesets`: "[changesets] OK — 102 changeset(s)."
- `npm run lint -w @weasel-js/forge`: forge has no `lint` script (npm: missing script). I ran eslint on the eight touched files instead: pass.
- `npm run typecheck:packages -- forge`: "1/1 forge ok".

tally: 4 of 12 fixed, 0 extra fixed