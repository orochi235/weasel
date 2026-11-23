architecture group in itself, A — fixed 4bc6f2c142

block group id given twice or shared with a block, A — fixed 2a64660aab (the strict call: it throws, with no override; recorded in `docs/unruled.md`)

block writer writing non-integer grid counts, A — fixed ee59055fff (counts are rounded with a warning, and dropped when they round below 1)

block `classDef default` applied to groups, A — fixed dc9c593cfc (the flowchart reader's own copy of the style cascade now goes through the shared `StyleSheet`)

C4 writer silently dropping stroke width and dash, A — fixed 57c93fbbe5

C4 writer writing colors without `hexColor`, A — fixed a086da3e35

C4 deployment writer turning every boundary into a `Deployment_Node`, A — fixed a6de7fa339 (it now warns and keeps the macro, because a page cannot tell `System_Boundary` from a deployment node typed `system`, and the earlier fix 31bb7aadf4 keeps typed deployment nodes; the call is recorded in `docs/unruled.md`)

ER `crow-many` written as one-or-many, A+B — fixed cd7b85f19e (now written as zero-or-more, with a warning)

class writer dropping note and namespace colors and a note's namespace, A — fixed 35b14531fa (it now warns)

flowchart link text running up to an unspaced closing arrow, A — fixed a13d0428ae

class relation `o` read as an end head before an id, B — fixed e0a0887504 (the writer's spaced `a -- obj` already read back correctly; the hand-written `a --obj` and `a ..obj` misread, and that is what was fixed)

class note joined to another note written as `note for` that note, B — fixed 41cdc5b591

ER `crow-many`, B — duplicate of the A entry above, fixed in cd7b85f19e

No extra defects.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: architecture.test.ts, block.test.ts, c4.test.ts, er.test.ts, class.test.ts, flowchart lex.test.ts, parse.test.ts, read.test.ts, write.test.ts, flowchart.pbt.test.ts, every `mermaid/*.test.ts`, and colorCheck.test.ts — all pass.
- `npm run checks:gate` — fail on the first run: `typecheck` and `typecheck:packages` failed on a test helper type in c4.test.ts. I fixed it and squashed the fix into a086da3e35, then reran: `checks:gate: all 33 passed`.
- `npm run lint -w @weasel-js/diagram-formats` — not run: this package has no `lint` script (its only scripts are `build` and `test`). eslint on every changed `.ts` file passed (exit 0) in its place.
- The tree is clean, and nothing under `.skulkr/` was committed.

tally: 13 of 13 fixed, 0 extra fixed