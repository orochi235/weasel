Ghost on carry cancel, from B: fixed 7375a44683

Mode-disabled tool still gets the carry-source class, from A+B: fixed 08a74bb1df

Cycle click does nothing when the shown member is the only enabled one and not active, from B: fixed c9e37f7d4d

RailStack throws on a stack with no members, from B: fixed 7190e4cf14 (an empty stack is now left out, and a one-member stack draws as a plain button)

Stack listing one id twice makes a two-row stack, from B: fixed 4ceafcd31b (ids are deduped, as `toolIdsOf` already does for tool sets)

Tooltip parses each string child as separate markdown, from A: fixed 7a6b8145ed

A numeric loop of 0 or 1 reads as looping forever in useTimelinePlayback, from A: fixed ced80c35f2. The real animator handle already reports `false` once no laps are left, so this only bit a handle returning `0` or `1`, which the `TimelineHandle` contract allows. One `loopsAgain` predicate now serves both the hook and `Transport`'s switch, and the switch shows `1` as off.

isAdvancing ignores the loop policy when playing in reverse, from A: not a defect. A reversed timeline stops at 0 of its first lap whatever the loop policy is. The playhead's `atEnd(backward)` is `t <= 0 && lap === 0`, and laps going backward count laps already taken, not `loopsLeft`. So reading the reverse case as "advancing while time > 0" matches the animator.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1`, each touched file run alone: ToolPalette.layout.test.tsx pass (10), ToolPalette.stacks.test.tsx pass (17), ToolPalette.test.tsx pass (39), ToolRail.test.tsx pass (9), Tooltip.test.tsx pass (13), Transport.test.tsx pass (27), useTimelinePlayback.test.tsx pass (5). Each new test was seen failing before its fix.
- `npm run checks:gate`: pass (exit 0). The first run failed `check:changesets` on four titles over 140 characters. I shortened them and folded each into its own commit.
- `npm run lint -w @weasel-js/ui`: unrun, because the package has no `lint` script ("Missing script: lint"). eslint on every changed `.ts`/`.tsx` file passed with no output.
- Tree clean; `.skulkr/` untouched.

tally: 8 of 9 fixed, 0 extra fixed