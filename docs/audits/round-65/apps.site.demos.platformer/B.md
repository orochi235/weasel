# Audit round 65 — apps.site.demos.platformer

## Two enemies touched in the same step cost two lives; the first hit's invulnerability doesn't guard the second
- where: apps/site/demos/platformer/world.ts:156 (stepWorld), with apps/site/demos/platformer/entities.ts:66 (resolveContacts)
- scenario: `resolveContacts` is handed `g.invuln` once, before the loop, and returns a `hurt` for every overlapping enemy. The loop in `stepWorld` sets `g.invuln = INVULN` on the first `hurt` but still runs `g.lives--` for each later one in the same list. The level's enemies 1 and 2 (row 14, cols 40 and 56) patrol the same floor (cols 36–57) in opposite directions and pass through each other; a player touching them while they overlap loses 2 lives in one step (with 2 lives left that ends the run outright) and gets two stacked knockbacks and two "ow" callouts. Every other source of damage in the step (spike, bonk) checks `g.invuln` after an earlier hit, so one hit per invulnerability window should hold here too.
- evidence: read
- severity: medium

## A jump pressed while the demo is paused (or before Start) fires on resume, however long ago it was
- where: apps/site/demos/platformer/useInput.ts:19 (usePlatformerInput), consumed via apps/site/demos/platformer/world.ts:265 (advanceWorld)
- scenario: `keys.take(JUMP)` keeps a press until it is taken (`keyState.ts`: "freshly pressed since it was last taken"), and the reader is called only from `advanceWorld`, which runs only while `running && outcome === 'playing'`. Press Space/ArrowUp while paused (the demo has a pause button) or before clicking the canvas to start, wait any length of time, resume: the first step reads `jumpPressed: true` and the player jumps unprompted. `JUMP_BUFFER` (0.12 s) is the physics' stated bound on how long a press is remembered; a press made seconds or minutes earlier bypasses it. Nothing drains or releases the key state while the world isn't stepping.
- evidence: read
- severity: low

## Falling out of the level is the one hit that doesn't duck the music
- where: apps/site/demos/platformer/world.ts:187 (stepWorld)
- scenario: spike (l.129), bonk (l.150) and enemy hit (l.181) each play `hurt` and call `hooks.duck()` — "Drop the music bed under a hit." The out-of-bounds death plays the same `hurt` sound and costs a life but never calls `duck()`, so the bed stays at full level over the hurt sound only for this hit. The same "what a hit does" decision is answered two ways.
- evidence: read
- severity: low

## Coins stop spinning when the run is decided, while the rest of the presentation keeps moving
- where: apps/site/demos/platformer/sceneWorld.ts:163 (syncScene)
- scenario: the coin spin is driven by `g.elapsed`, which stops with the simulation. `GameRefs.clock` was added precisely as the presentation clock that keeps advancing in `stepEnding` "so what moves on it (callouts, the shake's jitter) keeps moving after the run is decided". After catching the pole, callouts and shake keep animating on `clock` but every untaken coin freezes mid-spin (some collapsed to a 1-unit sliver) for the whole slide and ending card. Presentation time is answered by two clocks.
- evidence: read
- severity: low

## Enabling audio after the flag impact starts the music bed that the impact was meant to cut
- where: apps/site/demos/platformer/usePlatformerAudio.ts:96 (enableAudio)
- scenario: `flagImpact` cuts the bed two frames later via `cutMusicIn` → `audio.current?.bed?.stop()`. If audio is still off at the impact (no engine, so `bed` is null and the stop is a no-op), and the user then clicks enable during the slide or ending card, the unlock callback sees `!a.bed`, creates the bed and `start()`s it: the music loops on under "GOAL REACHED", the state the impact exists to prevent. The unlock path doesn't know the run's music was already cut.
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

<!-- done: 5 findings, files read: 20 -->
