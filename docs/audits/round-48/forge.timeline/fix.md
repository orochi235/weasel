- Seek or play after a hash `t` never reaches the URL, because the new hold's listener runs after `toUrl` (A): fixed 83d9655dbc. While fixing it I found that the new hold's first seek also reached `toUrl` before `hold` was set. That wrote the clamped time over a `t` the span couldn't reach yet. This commit fixes that too: it unsubscribes `toUrl` while the hold is made and subscribes it again after. Tests: "writes the next scrub after a hash t to the URL" and "writes play to the URL while a hash t still waits for the span".
- A hash `t` that matches the shown time, or has no `t`, leaves the earlier waiting hold alive (B): fixed 171450f1f8. `fromUrl` now releases the old hold before its early return. Test: "drops a waiting t once the hash names the time shown, or none", which adds a `Growing` fixture story.

Checks:
- `npx vitest run --maxWorkers=1 packages/forge/src/timeline/timeline.test.tsx`: pass (22/22). The 3 new tests fail on the frozen `RoutePlayhead.tsx`.
- `npm run checks:gate`: pass ("all 32 passed"). The first run failed 4 of 32 on an unused variable and a changeset title over 140 characters. Both were fixed and squashed into 171450f1f8, then the gate reran clean.
- `npm run lint -w @weasel-js/forge`: not run, because forge has no `lint` script (npm says "Missing script"). `npx eslint` on both changed files: pass. The gate's root `npm run lint`: pass.
- `npm run check:changesets`: pass.
- No `*.browser.test.*` file touched.

tally: 2 of 2 fixed, 0 extra fixed