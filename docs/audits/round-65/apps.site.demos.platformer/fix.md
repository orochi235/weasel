Two enemies at once cost two lives (A+B) — fixed b0874024fa
Walker placed with no floor under it floats and reverses every step (A) — fixed 0d3d905e6f (my own call, recorded in `docs/unruled.md`: a walker is placed on the first floor below where it is put, and one over a pit is left out)
Left and right walls stop above row 0 (A) — fixed 317619d2c7
Falling out of the level doesn't duck the music (A+B) — fixed f3b6306243
A jump pressed while paused fires on resume (B) — fixed e87695595e
Coins stop spinning once the run is decided (B) — fixed 31e6cc6410
Enabling audio after the flag impact starts the music the impact cut (B) — fixed d01b779b91

No extra defects found. No changesets: `apps/site` is not a published package, and the earlier platformer fixes shipped without them.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: platformerWorld.test.ts pass (18), platformerEntities.test.ts pass (14), platformerLevel.test.ts pass (11), platformerCull.test.ts pass (3), platformerAudio.test.tsx pass (7), SceneScrollerDemo.test.tsx pass (6). Each new test failed with its fix reverted. No browser test files touched.
- `npm run checks:gate`: pass ("checks:gate: all 32 passed").
- `npm run lint -w <pkg>`: not applicable, since `apps/site` is not a workspace package. Ran eslint on every changed .ts/.tsx file instead: pass.
- Tree clean apart from `.skulkr/`.

tally: 7 of 7 fixed, 0 extra fixed