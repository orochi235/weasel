# Audit round 36 — apps.site.demos.platformer

## A `?`-block bonk costs a life even while invulnerable, so repeated bonks drain every life in under a second
- where: apps/site/demos/platformer/world.ts:127 (stepWorld)
- scenario: the bonk branch checks only `g.player.bonk && g.outcome === 'playing'`; it sets `g.invuln = INVULN` (line 133) but never reads it. Standing on the floor under the `?` at column 3 (WORLD row 12; floor top at y=360, block bottom at y=312), the head is 26 units from the block, so a jump bonks within ~0.05 s and the player is back on the floor in ~0.2 s. Holding jump re-bonks every ~0.25 s: three lives gone in about 0.75 s, each bonk also stacking an `ow`, a shake and a duck. An enemy hit (via `resolveContacts`' `invuln <= 0`) and a spike (`g.invuln <= 0`) both respect invulnerability; the bonk is the one damage path that does not, although it grants the window that should block it.
- evidence: read
- severity: medium

## The enemy hit's horizontal knockback is thrown away by the next step
- where: apps/site/demos/platformer/world.ts:164 (stepWorld, hurt branch); apps/site/demos/platformer/physics.ts:137 (stepBody)
- scenario: a hurt contact sets `vx: g.player.body.facing * -120`, but `stepBody` starts every step with `b.vx = dir * MOVE_SPEED`, overwriting it from input before integrating. So the next step moves the player at 0 (no keys) or at full run speed toward wherever they were going, and the knockback never displaces them at all. Only the `vy: -280` hop survives, because vertical velocity is carried over. The player stays overlapping the enemy and walks into it again once `INVULN` ends.
- evidence: read
- severity: low

## The "steady-state jitter" readout records the length of any pause in running as jitter
- where: apps/site/demos/platformer/usePlatformerAudio.ts:122 (step booking in the run-cycle effect); :208 (endFrame)
- scenario: `endFrame` pauses the run cycle on a jump, a stop, or a pause, but nothing resets `stepStats.lastAt`. When running resumes at the same speed (scale 1 before and after, since `vx` snaps to `MOVE_SPEED`), the next footfall passes the `|scale - lastScale| <= 0.02` guard and is compared against the last footfall before the pause: run, stop for 2 s, run again → `spread ≈ |2000 − 250|` = 1750 ms. `spread` is a running max that is never lowered, so the first jump or stop pins the readout (`SceneScrollerDemo`'s "steady-state jitter" stat) at roughly the airtime or the idle time for the rest of the run. Expected: a pause breaks the pair, the way the not-running branch does by setting `lastAt = 0`.
- evidence: read
- severity: low

## Callouts freeze on screen once the run is decided: the last `ow` never fades
- where: apps/site/demos/platformer/world.ts:123 (stepWorld) and :215 (stepEnding)
- scenario: callouts expire and fade on `g.elapsed`, which only `stepWorld` advances, and `stepWorld` stops when `outcome` leaves `'playing'`. `stepEnding` does not step them. So the `ow` from the hit that ends the run, or a `FREE HEALTHCARE` collected just before the pole, is never removed: `drawCallouts(…, g.elapsed)` keeps drawing it at the age it had at the decision, near full alpha, under or over the ending card for as long as the card stays up. The ending already keeps a clock of its own (`ended`) for exactly this reason (the comment at line 47 says so), but callouts were not moved onto it.
- evidence: read
- severity: low

## The flagpole impact's screen shake is a sliding offset, not a shake
- where: apps/site/demos/platformer/world.ts:192 (stepWorld, win branch); :216 (stepEnding)
- scenario: the win sets `g.shake = SHAKE_DURATION`, and only `stepEnding` decays it from then on. The consumer's jitter is `sin(g.elapsed * 53)` and `cos(g.elapsed * 47)` (SceneScrollerDemo.tsx:168), and `g.elapsed` stops advancing at the win. So for the 0.25 s of shake, the view is displaced by one constant vector scaled down linearly to zero: the screen jumps a few units and slides back, with no oscillation. Bonk shakes during play oscillate because `elapsed` is still ticking then.
- evidence: read
- severity: low

## A second hit inside 260 ms has its music duck lifted early by the first hit's timer
- where: apps/site/demos/platformer/usePlatformerAudio.ts:171 (duckMusic)
- scenario: each duck schedules its own restore 260 ms later and none cancels the one before it. A spike hit at t=0 and an enemy hit at t=200 ms: the first timer restores `MUSIC_GAIN` at t=260, 60 ms into the second hit's hurt sound, and the second duck's own restore at t=460 does nothing. The bed comes back up under the second hit instead of staying down for it. The timers are also never cleared on unmount, though the `audio.current === a` guard keeps them from touching a disposed engine.
- evidence: read
- severity: low

## Toggling music while the unlock is still pending gets reverted when it resolves
- where: apps/site/demos/platformer/usePlatformerAudio.ts:84 (enableAudio)
- scenario: the `.then` callback mutes the bus with `!musicOn` from the render in which "enable audio" was clicked. Click "enable audio", then "music off" before `engine.unlock()` resolves: `toggleMusic` mutes the bus (the engine already exists) and sets `musicOn` false, then the unlock resolves and runs `mute(!true)`, unmuting it. The bed plays while the button says music is off. Reading the current value (a ref) when the promise resolves fixes it.
- evidence: read
- severity: low

## `audioState` is a snapshot taken at unlock and never follows the context afterward
- where: apps/site/demos/platformer/usePlatformerAudio.ts:82 (enableAudio)
- scenario: `audioState` is set once, when `unlock()` resolves, and nothing else writes it (the engine exposes no state-change signal, and the hook does not poll `engine.state()`). If the browser later suspends or interrupts the context (Safari does this on interruptions and backgrounding), `fire`, `fireAt`, `swarm` and the footstep booking all go silent because they check `engine.state() !== 'running'`, but the toolbar still reads "audio on" and the button stays `disabled`. The user then has no way to re-run `enableAudio`, which is the only path that resumes the context.
- evidence: read
- severity: low

## Spikes play every hurt effect but cost no life, unlike every other hit
- where: apps/site/demos/platformer/world.ts:113 (stepWorld)
- scenario: a spike sets `invuln`, bounces, plays `hurt`, ducks the music, says `ow`, and plays the hurt clip, which is the full treatment the enemy-hit, bonk and fall-out branches give. But it is the only one with no `g.lives--`, so landing on the `^^` pairs is harmless. This has been the case since the spike check went in (691c2ee129, which had no sound or callout then). The later addition of "Every hit the player takes says so" (sayOw's doc) treats it as a hit. Whether spikes should cost a life is answered one way here and the other way in the three other damage branches.
- evidence: read
- severity: low

## Files read
apps/site/demos/platformer/animState.ts
apps/site/demos/platformer/bed.ts
apps/site/demos/platformer/boneRig.ts
apps/site/demos/platformer/callouts.ts
apps/site/demos/platformer/camera.ts
apps/site/demos/platformer/clips.ts
apps/site/demos/platformer/entities.ts
apps/site/demos/platformer/flagpole.ts
apps/site/demos/platformer/footsteps.ts
apps/site/demos/platformer/level.ts
apps/site/demos/platformer/physics.ts
apps/site/demos/platformer/playerPose.ts
apps/site/demos/platformer/sceneWorld.ts
apps/site/demos/platformer/sfx.ts
apps/site/demos/platformer/skeleton.ts
apps/site/demos/platformer/skin.ts
apps/site/demos/platformer/useInput.ts
apps/site/demos/platformer/usePlatformerAudio.ts
apps/site/demos/platformer/world.ts
apps/site/demos/platformer/worldLevel.ts

<!-- done: 9 findings, files read: 20 -->
