# The animator on blits

**Status: a proposal. Nothing in it is built, and it waits on blits being published.** Delete it
once it is built or turned down.

For whoever picks up weasel's animation work. It answers: how weasel gets a model for combining
several animations on one property, without keeping a second copy of the arithmetic that blits
already has.

## The problem

Two animations writing the same property resolve as last-writer-wins everywhere in weasel, and the
specs that hit this each set it aside:

- **The animator.** Two animations on different `cancelKey`s that write the same pose both run, and
  the one registered later wins each frame. `docs/specs/2026-05-04-animation-primitive-design.md`
  calls a gesture fighting a tween a "sharp edge".
- **Color overrides.** "Multi-override composition… requires a stacking model. v1 is
  last-write-wins." (`docs/superpowers/specs/2026-05-21-animated-vertex-colors-design.md`)
- **Pose overrides.** One entry per node; the last `set` wins, and `usePoseRun` pins any node whose
  entry it didn't write.

The only blending in the kit is the rig's `blendPoses`.

blits (`~/src/blits`, `orochi235/blits`, not yet on npm) is that combining model. Each voice is an
effect with its own clock and weight, and a mix folds every voice reaching a subject into one value
per frame. The rules belong to the value being written, declared once per channel: `sum`, `mul`,
`max`, `last`, or a channel's own. klieg runs all three of its animation systems on it, and
magicsmoke runs on it too. A second interpolation and easing implementation inside weasel would
drift from it, which is the divergence this proposal removes.

## The proposal

Split the animator into the part that decides what runs and the part that computes values. Hand
the second part to blits, and keep the first.

| Job | Today | After |
|---|---|---|
| Interpolation, easing, keyframe sampling | `useAnimator`, `timeline/sampleTrack.ts`, pose helpers | blits `keys` patches |
| Springs, decay | `physics` in `useAnimator.ts` | blits patches (exact springs, below) |
| Combining several writers | None: last writer wins | A blits mix per target |
| Pose overrides, color overrides, camera | Written directly | Each a mix. The paint walk probes it per node; the camera is a mix with one subject |
| `cancelKey` slots and interrupts | Animator | Stays. An interrupt fades the old voice and cues the new one from the current value |
| Timelines, nesting, event tracks, audio booking | Animator | Stays. Cues and seeks voices instead of sampling tracks itself |
| Pause and time scale at three levels | Animator | Stays. Writes the product to each voice's `rate` |
| `watch` / `live` | Animator | Stays, reading voice handles |

What stays has no arithmetic of its own. It acts only by cueing, fading, seeking and re-rating
voices, so there is one implementation of time-to-value, and it is blits'.

**The public surface doesn't change.** `useAnimator`, `tween`, `spring`, `timeline`, `cancelKey`,
the pose helpers and `onTick` keep their signatures and get reimplemented underneath. About 30
source files call the animator: 15 in `packages/core`, 11 site demos, 2 in `packages/d3` and 1 in
`packages/ui`. weasel is published with outside consumers, so this is a rewrite under a stable API,
not a migration. `onTick` keeps working by probing a one-subject mix and handing the value over.

## What blits has to have first

Each of these is blits work. The ones marked open are proposed in `~/src/blits` but not built.

- **Published on npm.** `@weasel-js/core` can't take a `file:` dependency. Open: blits' handoff
  says magicsmoke waits on the publish too.
- **A frozen vocabulary.** weasel's types would follow blits' names. blits renamed across its API
  the week of 2026-09-28, so the type surface in its `docs/schema.html` wants to settle first. Open.
- **Fixed-interval stepping.** A stateful patch now steps by the whole gap between samples, so the
  same spring cue lands in different places at different frame rates: 116.9 at 144 fps against
  109.0 at 30 fps, read at 300 ms. Open: proposed in blits' `NOTES-ON-SCRUBBING.md`.
- **Exact springs and decay, carrying velocity across a retarget.** `spring` and `physics` here
  retarget mid-flight through `setTarget` and `setVelocity`. In blits a retarget is a new voice,
  which today starts from zero velocity. Open: proposed in the same note, as piecewise closed forms
  with velocity recorded at each segment.
- **Speed at scene sizes.** Measured 2026-09-30 with blits' own `npm run bench`, one run on this
  machine: 1000 subjects × 3 voices at 1.18 ms per frame, 10k × 3 at 27.8 ms for `fn` patches and
  14.6 ms for `keys`. blits reported about 10.5 ms for the `fn` row the day before, so take one run
  as rough. Either way, 10k is over budget. The paint walk would probe only the nodes some voice
  reaches. blits now walks only the voices that reach a subject (`1b1d841`), but nothing yet lists
  which subjects any voice reaches. That list is weasel's to supply: its control layer knows every
  node it cued a voice on.

## What weasel has to design

- **Interrupts with momentum.** A `cancelKey` interrupt today starts the new animation from the
  live value and drops velocity. On blits it can carry velocity: fade the old voice out over zero
  ms, and start the new spring segment from the old one's position and velocity. This is where the
  velocity hand-off is designed; the reflow glide's known gap ("velocity does not carry over") is
  its first user.
- **Pausing fades.** Writing `rate = 0` pauses a voice's clock, but blits' fades run on the mix
  clock, so a fade in progress keeps going while the voice is paused. A global pause means either
  that blits fades follow voice time, or that the control layer holds the mix clock still and calls
  `rebase()` on resume. The second needs no blits change.
- **Events against mix time.** Event tracks and booking stay in weasel's timeline, but they must
  read the same clock the mix was synced to, or a sound cue drifts against the motion it belongs
  to. The timeline reads time from the mix's `sync` timestamp, not from its own.
- **Channel kits for each target.** Pose: one channel per field, `sum` for translation and rotation
  and `mul` for scale, matching how `resolveSkeleton.compose` already layers rig poses. Color
  overrides are per-vertex arrays, which want a `vec` channel of the right length. Which blend rule
  a vertex color takes is open.

## Decisions this needs

- **Where blits sits — decided 2026-09-30: `@weasel-js/core` depends on it.** One animator, rebuilt
  on blits. blits' types stay out of core's public surface, so a blits rename stays inside core. A
  separate animation package was turned down because core still animates its own camera, which
  would leave two animators. Folding blits into the monorepo as its own `@weasel-js` package is
  still open.
- **`blendPoses` folds into a blits locus — decided 2026-09-30.** A clip crossfade is a locus,
  so rig clips become voices and blend with any other voice on the same joint. Three things to
  settle when it's built:
  - **Rotation** needs a channel of weasel's own whose `lerp` takes the short way round the circle.
    blits' `sum` blends angles in a straight line, so 0.1 and 2π−0.1 would average to π.
  - **Weights adding up to less than 1 follow the locus — decided 2026-09-30.** `[0.3, 0.3]` gives
    an even mix at 60% strength, pulled toward the bind pose, as for every other voice;
    `blendPoses` normalizes it to full strength. Every caller in the tree passes weights summing
    to 1 (`[1 - u, u]`), so nothing visible changes. Only `blendPoses.test.ts`'s `[1, 1]` case
    asserts the old behavior.
  - **Three or more clips:** a locus folds its members a pair at a time, which can differ slightly
    from `blendPoses`' single weighted average once angles take the short way. Test against
    `blendPoses`' own cases before deleting it.

## Order

1. blits: fixed-interval stepping, exact springs with velocity, publish.
2. weasel: pose overrides as a mix, behind the existing `PoseOverrides` interface, with the reach
   list supplied by the control layer. Benchmark the paint walk before going further.
3. weasel: tween, spring and keyframe sampling reimplemented on blits patches under the same
   signatures.
4. weasel: `cancelKey` interrupts with momentum; global pause through the mix clock.
5. weasel: color overrides and the camera as mixes.
6. weasel: event tracks reading mix time.
