Pass-through write leaves a no-poseTarget glide running (A): fixed 49a5f3105f. The `skipDuringGesture` and `shouldAnimate` paths now end the glide. The `isTicking` path is left as it was: `animateLifecycle` writes its own `pose:<id>` tween's frames through that path, so canceling there would cancel the tween from its own tick.

Re-insert during an exit inserts an id the scene still holds (A+B): fixed d9a31d3365. The pending removal now runs at once, then the given node is inserted. This is a call nobody has ruled on, so it is recorded in `docs/unruled.md` under "Audit round sixty-six".

Skin bake applies a rotated node's rotation twice (A): not a defect. `fromBounds` is documented to carry none of the template's shape, and every shipped descriptor drops the rotation. `skinRig.test.ts` ("shows it with no turn left to apply") covers a turned node.

Root joints placed by the full frame but turned by the descriptor's rotation only (A): fixed e0cca19cfb. Turn, scale, and mirror now all come from the frame's linear part.

A flick with no riders never ends, leaving its coast and animator watch (B): fixed ec6c39dcff.

[r38-5] An externally canceled coast leaves its preview and records nothing (carried): not a defect. `docs/unruled.md` (round six, which round thirty-seven restates as standing) leaves the `previewPoses` path as is.

Checks:
- `npx vitest run --maxWorkers=1` on `animateOnSetPose.test.ts`, `animateLifecycle.test.ts`, `rigNode.test.tsx`, and `momentum.test.ts`: all pass. I also ran `wrappers.scene.test.tsx`, `rigNode.rebind.test.tsx`, and `rigTarget.test.tsx`: all pass.
- `npm run checks:gate`: "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/core`: fail, because `@weasel-js/core` has no `lint` script. eslint on every changed file instead: pass (exit 0).
- `npm run check:changesets`: "OK — 5 changeset(s)."

tally: 4 of 6 fixed, 0 extra fixed