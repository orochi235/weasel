- Enemy-hit knockback overwritten by the next step (A+B): fixed b69530976f
- Stomp, spike and enemy knock-ups clipped by the jump cut (A): fixed fb36d2f7e6
- advanceWorld keeps stepping after the run is decided (A): fixed c3646129b0
- `?`-block bonk costs a life while invulnerable (A+B): fixed 6525ae175c
- Spikes play the hurt sequence but cost no life (A+B): fixed 69b0f2fe46. This was a behavior call: I made spikes cost a life and recorded it in `docs/unruled.md`.
- Enemies float 4 units above the floor (A): fixed 76f5210e56
- Walkers treat only SOLID as wall and floor (A): fixed 3ce70146d2
- Head hit straddling `#` and `?` drops the bonk (A): fixed 6270e2f8fc
- enableAudio's deferred setup applies a stale musicOn (A+B): fixed 932c905a80
- Overlapping ducks restore the music early (A+B): fixed 14c2c4c397
- parseLevel accepts a level with no `S`/`G`, or several (A): fixed 1225c59cfb. This was a behavior call: a missing marker throws unless `{ markers: 'optional' }` is passed (the geometry test fixtures use it), and a duplicate always throws. Recorded in `docs/unruled.md`.
- Jitter readout records a pause in running as jitter (B): fixed c2c7283ac1
- Callouts freeze on screen once the run is decided (B): fixed 08825b0ede
- Flagpole shake slides instead of shaking (B): fixed 08825b0ede. It's the same fix as the callouts: both now run on a new `g.clock` that `stepEnding` also advances.
- audioState is a snapshot taken at unlock (B): fixed 488a570cbf. The hook now listens for `statechange` on `engine.context`.

Extra defects found while fixing:
- Knockback pushed against the player's facing, not away from the enemy: fixed b69530976f
- Pending duck restore not cleared on unmount: fixed 14c2c4c397

No changesets: `apps/site` is not a published package, and earlier platformer fixes (85d186fee6) had none.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - platformerWorld.test.ts: 15 passed (15)
  - platformerPhysics.test.ts: 20 passed (20)
  - platformerEntities.test.ts: 12 passed (12)
  - platformerLevel.test.ts: 10 passed (10)
  - platformerCamera.test.ts: 5 passed (5)
  - platformerAudio.test.tsx: 6 passed (6)
  - SceneScrollerDemo.test.tsx: 6 passed (6)
  - platformerCull.test.ts: 2 passed (2)
  - platformerCallouts.test.ts: 10 passed (10)
- Each new test was run with its fix reverted and failed.
- `npm run typecheck`: pass (exit 0). I ran this instead of `typecheck:packages` because `apps/site` is not a package.
- eslint on the 12 changed files: pass (exit 0)
- `npm run check:size`: pass ("sizes: no file or function grew past its cap.")
- `npm run check:changesets`: pass ("[changesets] OK — 1699 changeset(s).")
- Browser tests: none touched, none run.
- Tree: clean apart from `.skulk/`.