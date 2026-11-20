# Audit round {{round}}: fixer brief, area `{{area}}`

{{source}}

## Where you work

- You are in a fleet node's synced copy of the repo, at a commit holding exactly the frozen tree, with
  node_modules installed. Work only here. Never `git stash`, never switch branches, never reset or rebase
  past the current commit: your commits on top of it are what the controller takes back, as patches.
- Read root `CLAUDE.md` first, and the `docs/traps/*.md` file its table names for what you touch.
- Leave `.skulk/` alone and out of every commit.
- Every call rereads everything before it, so read in few, targeted calls: the findings and the files they cite
  together, a function rather than a whole file, and a check's verdict rather than its log (`… | tail -5`, or
  `grep -E "Tests |×|error"`).

## Writing

What you write ships under the repo owner's name.

- US English: color, behavior, gray, canceled; never -ise or -our. The Oxford comma in any list of three or more.
- Comment sparingly: only what the code cannot say and a reader would be harmed not knowing, in one or two
  lines. Never narrate what the code does.
- A changeset or a message says what a consumer sees, plainly, with no session shorthand.

## For each distinct finding

1. Verify it against the code. A reviewer can be wrong; a finding contradicted by `docs/unruled.md` is not a
   defect.
2. Reproduce it with a test that fails before the fix (plain example test beside the code).
3. Fix it, the general way: if the same mistake sits elsewhere in your area, fix those too.
4. Commit each fix on its own. The subject is lowercase imperative, as in this repo's `git log`: "end a color
   cycle when cancelAll ends its keep-alive entry", never "End a color cycle …". It says what the change
   does, for a reader with no session context; end the message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
   Each fix that a consumer could notice gets its own changeset — read "Writing a changeset" in
   `docs/releasing.md` first; `npm run check:changesets` must pass.
5. A finding that needs a behavior call nobody has made: make the strict call (misuse throws or warns, with an
   opt-in override), record it in `docs/unruled.md` in that file's format, and say so in your report.

## Before reporting

- Each test file you touched, one at a time: `npx vitest run --maxWorkers=1 <file>` from the tree root (a
  `*.browser.test.*` file cannot run here — list it as unrun).
- `npm run checks:gate`, run here directly: every check the batch's gate runs, the root `npm run typecheck`
  and every `check:*` among them, in about three minutes. Fix each failure and rerun it until all pass;
  a check you skip here fails the whole batch later.
- `npm run lint -w <pkg>` for every package you changed: the package's whole lint script, not eslint alone.
- No fleet runs and no merging: the controller batches every area and runs the fleet once.
- Leave the tree clean: everything you mean to keep committed, nothing else changed.

## Report (your final reply, nothing else)

One line per distinct finding: `fixed <sha> | not a defect (why) | question (what) | duplicate of <other>`,
each line led by the finding's claim in a few words and where it came from (A, B, A+B, or sweep). Then any
extra defects you found while fixing, the same way. Then the checks you ran and their results, verbatim
pass/fail.

End with one line, exactly: `tally: <F> of <N> fixed, <X> extra fixed`. N is how many findings you were
given, counted as they were listed to you, however you split or joined them while fixing; F is how many of those
you fixed; X is the extra defects you fixed.
