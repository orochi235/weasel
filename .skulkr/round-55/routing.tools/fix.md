- Tools slot goes blank when the newest canvas unmounts while an earlier one is still mounted (A+B): fixed b5cc350502
- A held tool's `[`/`]`/Shift+wheel step actions are enabled only for the active tool (A+B): fixed 7aece16376 (the step actions and the option tuning now share one `liveTool` rule)
- A mode's `defaultTool` can name an ambient tool, which makes `setActive` throw (B): fixed d55e6b0134
- A tool id or shared key with a dot never reads back from the prefs store (A+B): fixed ee7ace62f3. This was worse than reported: the prefs schema itself throws on a dotted key, so `toolOptionsPrefs` now nests a dotted id's group one level per dot, and `get` walks the same path. Option keys and shared keys with a dot now throw (strict call, recorded in `docs/unruled.md`).
- A tool id `shared` collides with the shared-options owner (A+B): fixed 2c2e46b2c3. `defineTool` and `toolOptionsPrefs` now throw for a tool with options named `shared` or `shared.*` (strict call, recorded in `docs/unruled.md`).

Extra:
- Tool `a`'s option `b` and a tool `a.b` would share one place in the store, which only became possible once dotted ids nest: `toolOptionsPrefs` now throws for it, in ee7ace62f3 (part of that fix, so not counted as extra).

Checks:
- Every new test failed before its fix and passes after it. The tools-slot and ambient-default tests passed against the unfixed code on their first try, so I rewrote them until they failed first.
- `npx vitest run --maxWorkers=1`, one file at a time, all pass: toolsScope.test.tsx (2), toolOptionSteps.test.ts (2), tuneToolOptions.test.ts (5), toolOptionShare.test.ts (7), useModeDefaultTool.test.tsx (6), useTools.test.tsx (7), toolOptionPrefs.test.ts (14), toolOptions.test.ts (18), toolOptionSteps.pbt.test.ts (1).
- `npm run checks:gate`: all 32 passed.
- `npm run check:changesets`: OK, 2594 changesets.
- `npm run lint -w @weasel-js/routing`: not run, because the package has no `lint` script. Instead, `npx eslint` on every changed .ts/.tsx file: pass (exit 0).
- No browser tests touched. Tree clean apart from `.skulk/`.

tally: 5 of 5 fixed, 0 extra fixed