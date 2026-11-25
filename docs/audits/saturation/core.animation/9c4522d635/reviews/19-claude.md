# core.animation — blind review findings

## coastByWrite leaves its preview on screen and records nothing when its decay is canceled from outside
- where: packages/core/src/animation/behaviors/coastByWrite.ts:41 (coastByWrite, `coast.stop`) and :62 (`animator.decay`, no cancel hook)
- scenario: flick a node over an adapter without `poseTarget` but with `previewPoses`, then `animator.cancelAll()` (or the canvas's animator unmounts) mid-coast. The decay's `onDone` only runs on natural completion (the animator runs exactly one of `onDone`/`onCancel`), and coastByWrite registers neither `onCancel` nor an `animator.watch`, so `commitFlick` never runs: the last coast frame stays installed through `previewPoses` while the document keeps the pre-drag pose, no flick op is recorded, and the coast sits in `coasts` until a later drag of the same id calls `stop()`, which sees the key inactive and only deletes it — still never clearing the preview. coastOnTargets answers the same event the other way (`animator.watch` on cancel/interrupt → `halted` → flick recorded where it stopped), and momentum's doc promises one behavior for both. Should: on an outside cancel, commit the flick at the last position and clear the preview, as coastOnTargets does.
- evidence: read (coastByWrite.ts; animator `onCancel` semantics in packages/animator/CHANGELOG.md:88-90, tweenAnimation.ts:70-78; coastOnTargets.ts:166-172 for the other answer)
- severity: medium

## createDepartures drops every leaving ghost mid-fade when the seat's transition object changes
- where: packages/core/src/animation/departures.ts:82 (createDepartures, `carrierOf`)
- scenario: a node is removed and its ghost starts fading out through transition A; before it finishes, the seat hands `bindPoseTransition` a different transition object B (for example `useAnimatedReflow` rebuilt because `animator` changed or it was toggled off and on), and another node is removed. `carrierOf(B)` disposes A's carrier, which `stop`s every glide it holds and clears their overrides; the overrides subscriber then deletes those ghosts, so the first ghost vanishes at whatever alpha it had instead of finishing its exit. Should: let the old carrier's glides run out (dispose it once it holds none), or carry its ghosts over.
- evidence: read (inference about how often a seat's transition identity changes)
- severity: low

## Files read
packages/core/src/animation/behaviors/coast.ts
packages/core/src/animation/behaviors/coastByWrite.ts
packages/core/src/animation/behaviors/coastOnTargets.ts
packages/core/src/animation/behaviors/momentum.ts
packages/core/src/animation/clipTargets.ts
packages/core/src/animation/departures.ts
packages/core/src/animation/index.ts
packages/core/src/animation/motionMs.ts
packages/core/src/animation/pathMotion.ts
packages/core/src/animation/poseHelpers.ts
packages/core/src/animation/poseTarget.ts
packages/core/src/animation/poseTransition.ts
packages/core/src/animation/reflow.ts
packages/core/src/animation/reflowGlide.ts
packages/core/src/animation/rewind.ts
packages/core/src/animation/rig/bindRig.ts
packages/core/src/animation/rig/index.ts
packages/core/src/animation/rig/rigNode.ts
packages/core/src/animation/rig/rigSeat.ts
packages/core/src/animation/rig/skinBinding.ts
packages/core/src/animation/rig/useRig.ts
packages/core/src/animation/wrappers/animateLifecycle.ts
packages/core/src/animation/wrappers/animateOnSetPose.ts
packages/core/src/animation/wrappers/index.ts
packages/core/src/animation/wrappers/instantPose.ts
packages/core/src/animation/writtenPoseTarget.ts

<!-- done: 2 findings, files read: 26 -->
