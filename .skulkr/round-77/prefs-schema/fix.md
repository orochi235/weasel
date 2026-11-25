**prefs-schema, round 77: 6 of the 7 findings are fixed and committed, and one is not a defect.**

- Root-path read into a list or map entry misses the item field's default (A): fixed 9d0335c429
- `prefDisplayBounds` reads a decreasing unit's direction only at stored 0 and 1, giving min above max (A): fixed 01580f7043
- A group's switch that is a field of an object leaf is disabled by the group's own `enableIf` (A): fixed 67bcec79d6. That object leaf and the path down to the switch stay live, and its other fields stay disabled. I made this call myself and recorded it in `docs/unruled.md`. `PrefOwner` gains an optional `switchOf` field, so the changeset is `minor`, tagged `fix api`.
- An alias with its own name keeps the target's access letter (A): fixed d7afb279f1. I made this call myself and recorded it in `docs/unruled.md`.
- The pbt fixture's `leaf()` doc says it excludes `paint`, but it yields paint leaves (A): fixed d6175410b0. Only the comment was wrong; the fixture's own code handles paint, so I kept paint and corrected the doc. There is no changeset, since no consumer can see the change.
- `prefStatusAt` disables an item's switch field that `applyPrefConditions` spares (B): not a defect. Both passes treat any condition that reads the entry (`from: 'item'`) as holding, the whole of it, an `all` beside a root test included. So neither disables that switch in the first place, and `owner.entry` changes nothing in `prefStatusAt`. I checked this by running the scenario.
- A null entry, and an auto item, read differently by root path and by `from: 'item'` (B): fixed. The null part is 9d0335c429. The other part, reading the auto value or `defaultScope` rather than `default` from the entry, is 4bbcc8001b.

Extra defects found while fixing: none.

Checks:
- `npx vitest run --maxWorkers=1` on each touched file: `judge.test.ts` pass (11), `status.switch.test.ts` pass (8), `status.union.test.ts` pass (4), `alias.test.ts` pass (3), `helpers.test.ts` pass (31). Everything under `packages/prefs-schema/src` and `packages/prefs/src` together: pass (116 files, 1040 tests). `packages/routing/src/menus/resolveMenu*.test.ts`: pass (43 and 17).
- `npm run checks:gate`: pass, "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/prefs-schema`: the package has no `lint` script ("Missing script"), so the root `lint` inside the gate covers it, and that passed.
- The tree is clean, and `.skulkr/` is untouched.

tally: 6 of 7 fixed, 0 extra fixed