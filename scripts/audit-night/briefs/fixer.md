# Audit round {{round}}: fixer brief, area `{{area}}`

Two blind reviewers read this area at the frozen commit {{commit}} and reported without fixing. Their
reports are `{{reportA}}` and `{{reportB}}`. Some findings appear in both under different words; treat
those as one.

## Where you work

- You are in a fleet node's synced copy of the repo, at a commit holding exactly the frozen tree, with
  node_modules installed. Work only here. Never `git stash`, never switch branches, never reset or rebase
  past the current commit: your commits on top of it are what the controller takes back, as patches.
- Read root `CLAUDE.md` first, and the `docs/traps/*.md` file its table names for what you touch.
- Leave `.audit-night/` alone and out of every commit.

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

## Before reporting

- Each test file you touched, one at a time: `npx vitest run --maxWorkers=1 <file>` from the tree root (a
  `*.browser.test.*` file cannot run here — list it as unrun).
- `npm run typecheck:packages -- <pkg> …` for every package you changed; eslint on the files you changed;
  `npm run check:size`; `npm run check:changesets`.
- No fleet runs and no merging: the controller batches every area and runs the fleet once.
- Leave the tree clean: everything you mean to keep committed, nothing else changed.

## Report (your final reply, nothing else)

One line per distinct finding: `fixed <sha> | not a defect (why) | question (what) | duplicate of <other>`,
each line led by the finding's claim in a few words and which reviewer(s) found it (A, B, or A+B). Then any
extra defects you found while fixing, the same way. Then the checks you ran and their results, verbatim
pass/fail.
