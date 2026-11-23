- A replaced runner's last preview bitmaps get closed while a render still shows them (A): fixed 9986f12c21
- Node defs built for a structural batch the graph refuses are never disposed (B): fixed bf9a86de4a. The second half of the finding, "a def built for a node `prune` then dropped", can't happen: `prune` drops only nodes whose `build` threw, and those have no def.
- A wire picked before a controlled `selected` change shows as picked again once `selected` returns to null (B): fixed 228ed1039b

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/diagram/src/effect/audio/liveRunner.test.ts`: pass (21/21)
- `npx vitest run --maxWorkers=1 packages/diagram/src/effect/audio/useLiveAudioRunner.test.tsx`: pass (9/9)
- `npx vitest run --maxWorkers=1 packages/diagram/src/effect/editorPicks.test.tsx` (new file): pass (1/1)
- `npx vitest run --maxWorkers=1 packages/diagram/src/effect/EffectEditor.test.tsx`: pass (17/17)
- `npx vitest run --maxWorkers=1 packages/diagram/src/effect/EffectEditor.clusters.test.tsx`: pass (13/13)
- `npm run check:changesets`: pass ("OK — 901 changeset(s), 33 with warnings"; none of the warnings are in the three changesets added here)
- `npm run checks:gate`: pass ("all 33 passed")
- `npm run lint -w @weasel-js/diagram`: not run, because `@weasel-js/diagram` has no `lint` script. Its files are covered by the root `npm run lint`, which passed inside the gate.

tally: 3 of 3 fixed, 0 extra fixed