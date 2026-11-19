- **Coast canceled from outside (`cancelAll`, `cancelKey`, unmount) records nothing; over pose targets it moves the document outside history** (A+B): fixed f5e9b92639. This is the fixer's call, recorded in `docs/unruled.md`: on every adapter the coast now records the flick where it stopped and clears its preview. That replaces round six's "left as is" entry for the `previewPoses` path, which B's report also covers.
- **`scenePoseTarget` returns a stale target for a node deleted at rest, and its cache grows without bound** (A+B): fixed ac3b1b591e. A lookup now drops that target, and making a new one sweeps the dead ones out each time the table doubles.
- **Rewinding tween with an easing that overshoots ends early and jumps** (A): fixed 4d484ef4db.
- **`rigFromNode` loses the skin of a node whose id is `__proto__`** (A): fixed 86a0133925.
- **`useRigNode` throws during render on a joint the skeleton no longer has** (B): fixed 60c4ff4e00. This is the fixer's call, recorded in `docs/unruled.md`: such joints are left out and `useRigNode` warns about them; `bindRig` still throws on one.
- **`Rig.bake` throws, and `show` puts an override back each frame, for a bound or skinned node deleted after binding** (B): fixed 70c6b9beb0. B also said a node locked since binding throws: not a defect (refusing a write to a locked node is what a lock does).
- **`boundary: 'stop'` behaves differently on pose targets than through writes** (B): fixed e9a3403a21. Each node now stops at its own edge on both paths.
- **`momentum({ friction: 1 })` throws at release on one adapter and coasts forever on the other** (B): fixed 204b2096de. This is the fixer's call, recorded in `docs/unruled.md`: `momentum()` throws a `RangeError` on a friction outside (0, 1).

Extra defects: none. One test-only change: the stub animator in `move.lifecycle.test.ts` gained `watch`, which the coast now calls.

Checks (no browser test files touched):
- `npx vitest run --maxWorkers=1`, one file at a time: momentum.otherWriters.test.ts pass (5), momentum.test.ts pass (10), poseHelpers.rewind.test.tsx pass (7), poseTarget.test.tsx pass (13), bindRig.test.ts pass (13), rigNode.test.tsx pass (9), skinRig.test.ts pass (13), editing move.lifecycle.test.ts pass (21), editing momentum.targets.test.tsx pass (9). Also run and passing, though not edited: poseTarget.reflow, target.read, clipTargets, rigNode.rebind, rigTarget, useRig, animateOnSetPose, move.momentum.
- `npm run typecheck:packages -- core editing`: pass (core ok, editing ok)
- eslint on the changed files: pass
- `npm run check:size`: pass ("no file or function grew past its cap")
- `npm run check:changesets`: pass ("OK — 1738 changeset(s)")
- Working tree clean.