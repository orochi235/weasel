Rename field stays open after its cluster leaves the doc (A): fixed 2df63015f0

Replacing the live audio runner closes the bitmaps still on screen (A): fixed 31f33f846e. A disposed runner now keeps its newest run's previews open until `drawn` reports a render that no longer shows them, and `useLiveAudioRunner` makes that call on each replaced runner after the render that shows the new one.

`livePlan` checks for feedback loops over every raw wire (B): fixed 4214dc0de0. Loops, ordering and feeding now all use only wires between ports their audio stages have. A wire into an input its stage lacks is now left out of the plan, as one from a missing output already was. I changed one `liveRunner.test.ts` case so its stage declares the port its node lacks, since that mismatch is what the runner's "no input port" error guards.

A numeric level without a `control` silently plays at its default (B): fixed f582555aa2. Text that spells a number now plays as that number, and any other text fails the stage with an error naming the level. That is a strict call nobody had made, so I recorded it in `docs/unruled.md` under round seventy-three.

`dissolveCluster` doesn't pin shown stages under `nodeGraph` (B): fixed 4e04019bc7

`cluster` makes a group from ids that name nothing (B): fixed eefdd2e74d. Both `clusterStages` and the editor API now drop unknown ids, and the API returns `null` when none is left.

Extra: none. 5b779bfd4a only shortens the six changeset titles above to under 140 characters, which `check:changesets` requires.

Checks:
- `npx vitest run --maxWorkers=1` for each file:
  - `EffectEditor.clusters.test.tsx`: pass (13)
  - `clusterEdit.test.ts`: pass (16)
  - `audio/plan.test.ts`: pass (12)
  - `audio/liveRunner.test.ts`: pass (18)
  - `audio/livePreviews.test.ts`: pass (7)
  - `audio/useLiveAudioRunner.test.tsx`: pass (8)
  - `audio/patches.test.ts`: pass (12)
  - `livePlan.shrunk.test.ts`: pass (1)
  - `livePlan.pbt.test.ts`: pass (2)
  - `EffectEditor.test.tsx`: pass (17)
  - `check.test.ts`: pass (18)
  - `run.test.ts`: pass (18)
- No browser test files touched.
- `npm run checks:gate`: pass, "checks:gate: all 33 passed". The first run failed two checks (changeset titles over 140 characters, and a `react-hooks/exhaustive-deps` ref error in `useLiveAudioRunner.ts`); both are fixed.
- `npm run lint -w @weasel-js/diagram`: the package has no `lint` script. The root `npm run lint` passed inside the gate.
- `npm run check:changesets`: pass.
- Tree is clean.

tally: 6 of 6 fixed, 0 extra fixed