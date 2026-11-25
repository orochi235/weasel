# Audit rounds 29/30 — fixer brief

Two blind reviewers read your area at f10daafb87 and reported without fixing. Their reports are the two
files named in your prompt. Some findings appear in both under different words; treat those as one.

## Where you work

- Your worktree and branch are named in your prompt; it is already created and linked (node_modules works).
  Work only there, with absolute paths. Never `cd` into the main checkout, never `git stash` (the stash stack
  is shared by every worktree), never touch another worktree.
- Read root `CLAUDE.md` first, and the `docs/traps/*.md` file its table names for what you touch.

## For each distinct finding

1. Verify it against the code. A reviewer can be wrong; a finding contradicted by `docs/unruled.md` is not a
   defect.
2. Reproduce it with a test that fails before the fix (plain example test beside the code).
3. Fix it, the general way: if the same mistake sits elsewhere in your area, fix those too.
4. Commit each fix on its own: imperative subject saying what the change does, written for a reader with no
   session context; end the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   Each fix that a consumer could notice gets its own changeset — read "Writing a changeset" in
   `docs/releasing.md` first; `npm run check:changesets` must pass.
5. A finding that needs a behavior call nobody has made: make the strict call (misuse throws or warns, with an
   opt-in override), record it in `docs/unruled.md` in that file's format, and say so in your report.

## Before reporting ready

- Each test file you touched, locally, one at a time: `npx vitest run --maxWorkers=1 <file>` from your worktree
  root (a `*.browser.test.*` file cannot run here — list it as unrun).
- `npm run typecheck:packages -- <pkg> …` for every package you changed; eslint on the files you changed;
  `npm run check:size`; `npm run check:changesets`.
- No fleet runs of your own and no merging: the controller batches every branch and runs the fleet once.
- Leave the worktree clean (everything committed).

## Report (your final reply, nothing else)

One line per distinct finding: `fixed <sha> | not a defect (why) | question (what) | duplicate of <other>`,
each line led by the finding's claim in a few words and which reviewer(s) found it (A, B, or A+B). Then any
extra defects you found while fixing, the same way. Then the checks you ran and their results, verbatim
pass/fail.
