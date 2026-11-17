# Audit round 29 — blind reviewer brief

You are one of two reviewers reading the same area of the weasel repo independently. You will never see the
other reviewer's work, and they will never see yours: the overlap between your two lists estimates how many
defects the area still holds. That estimate only works if both reviewers search the same way, so:

- **Do not spawn subagents or split the area.** Read it yourself, end to end, as far as your budget goes.
- **Do not edit anything.** No fixes, no commits, no branches, no stash. Report only.
- **Read the frozen tree only:** `/Users/mike/src/weasel/.worktrees/audit29-frozen` (detached at f10daafb87).
  Cite paths relative to that root. It has no node_modules; reason from the code. If you want to run a
  tiny check (a one-core node/tsx snippet under ~10 s), put it in your own scratch dir below, never in the repo.
- Read `CLAUDE.md` at the root first (terminology, module rules, traps table), and the `docs/traps/*.md`
  file for your area if the table names one. `docs/unruled.md` lists calls already made — a behavior
  ruled there is not a defect.

## What counts

A defect is code that does the wrong thing for some input or sequence a real caller can produce: wrong
output, a throw, a hang, a leak (listener, timer, GPU resource, cache without a bound), state left behind by
teardown, a decision answered two different ways in two places, an option silently dropped on one path,
precision lost far from the origin, prototype-chain lookups on user-keyed tables, timers with computed
delays bypassing `after`, docs/README examples that do not work against the code. Style nits, naming
preferences and "could be cleaner" are not defects — leave them out.

Rounds 1–28 already fixed a lot; look for what is still there, especially in code changed in the last week
(`git -C <frozen> log --since=2026-11-09 -- <paths>`).

## Output

Write your findings to `OUT` (path below) as Markdown, one `##` section per finding:

    ## <one-line claim>
    - where: path/to/file.ts:LINE (function name)
    - scenario: concrete input/state → what happens vs what should
    - evidence: read | ran (say which; "ran" only if you executed something)
    - severity: high | medium | low

Write the file as you go (append after each finding), not only at the end. Finish with a final line
`<!-- done: N findings, files read: M -->`. Your reply to the controller is just that line.
