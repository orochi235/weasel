# Findings: apps.site.demos.platformer (round 36)

## Enemy-hit knockback's horizontal velocity is overwritten on the next step and never moves the player
- where: apps/site/demos/platformer/world.ts:164 (stepWorld, hurt branch); apps/site/demos/platformer/physics.ts:137 (stepBody)
- scenario: the player walks into an enemy. stepWorld sets `vx: facing * -120` as knockback. The next `stepBody` sets `b.vx = dir * MOVE_SPEED` unconditionally, so the knockback is replaced before it moves the body even once (0 if no key is held, ±170 if one is). The player is never pushed back. They should be pushed away from the enemy for some time; instead the knockback value does nothing.
- evidence: read
- severity: medium

## Stomp bounce and hurt/spike knock-ups are cut to JUMP_CUT on the next step unless jump is held
- where: apps/site/demos/platformer/physics.ts:147 (stepBody); apps/site/demos/platformer/world.ts:115, 157, 164 (stepWorld)
- scenario: stepWorld sets `vy: -300` (stomp, spike) or `-280` (enemy hit). On the next step, `if (!input.jumpHeld && b.vy < -JUMP_CUT) b.vy = -JUMP_CUT` clips it to -140. The variable-jump-height rule is meant for a jump the player launched, but it also catches these imposed velocities. So a spike or enemy hit with jump not held pops the player about 5 world units instead of about 25, and with spikes 1 tile deep the player stays inside the spikes. The written -300 and -280 only apply while jump is held.
- evidence: read
- severity: medium

## advanceWorld keeps stepping the simulation after the run is decided within the same frame
- where: apps/site/demos/platformer/world.ts:248 (advanceWorld)
- scenario: a frame of 0.1 s runs 12 steps (a normal 60 fps frame runs 2). If step k sets `outcome = 'won'` or `'lost'`, steps k+1… still call `stepWorld`. They apply input and gravity to the pole-snapped body, step enemies, collect coins (score, free lives), and apply enemy hits and fall-outs (`lives--`, hurt sound, "ow" callout). After a win, lives can reach 0 under "GOAL REACHED". After a loss, the score can still rise. The caller (SceneScrollerDemo) gates simulation on `outcome === 'playing'` only per frame, not per step. The loop should stop once `g.outcome !== 'playing'`.
- evidence: read
- severity: medium

## A `?`-block bonk costs a life even while invulnerable, unlike every other hit
- where: apps/site/demos/platformer/world.ts:127 (stepWorld, bonk branch)
- scenario: the player takes an enemy hit (lives--, invuln = 1.2 s), and during the knock-up their head hits a `?` block. The bonk branch checks only `g.outcome`, not `g.invuln`, so a second life goes within one invulnerability window. Spikes check `invuln` (line 113) and enemy contact passes `invuln` to resolveContacts. So "does invulnerability protect?" gets two different answers depending on the source of the hit.
- evidence: read
- severity: medium

## Spikes play the full hurt sequence but never cost a life
- where: apps/site/demos/platformer/world.ts:113 (stepWorld, spike branch)
- scenario: the player walks onto the `^^` at columns 20–21. They get invuln, a hurt sound, a music duck and an "ow" callout, but `g.lives` is never decremented. Enemy contact, bonks and fall-outs all do `lives--`. Walking back and forth across spikes is free, so the hazard has no cost while it presents itself as damage.
- evidence: read
- severity: low

## Enemies float 4 world units above the floor
- where: apps/site/demos/platformer/entities.ts:32 (createEnemies); apps/site/demos/platformer/sceneWorld.ts:180 (syncScene)
- scenario: an enemy spawns at its tile's center (y = 348 for row 14) and has no gravity. It is drawn with bottom `e.y + ENEMY_H/2` = 356, but the floor's top is 360 (row 15). Every walker hovers 4 world units (8 screen px at CAM_SCALE 2) above the ground. It should rest on the floor, at y = tileBottom − ENEMY_H/2.
- evidence: read
- severity: low

## Walkers count only SOLID as wall and floor, though physics treats `?` as solid and `=` as standable
- where: apps/site/demos/platformer/entities.ts:45-46 (stepEnemy)
- scenario: the level parser accepts `e` anywhere. Put an enemy on a `=` one-way platform: `floorAhead` is always false, so it reverses on every step and never moves. Put one next to a `?` block: it walks through it, because the wall test ignores QUESTION, while `blocksMotion` in physics.ts:70 treats QUESTION as solid. The two modules disagree on which tiles block.
- evidence: read
- severity: low

## A head hit that straddles a SOLID tile and a `?` block reports SOLID and drops the bonk
- where: apps/site/demos/platformer/physics.ts:107-124 (resolveY)
- scenario: the body (14 wide) rises under a ceiling where the left column is `#` and the right is `?`. The column loop returns the first blocking tile, the SOLID on the left, with `tile: SOLID`. So `bonk` is null even though the head struck the `?` block. Which column is scanned first decides the result.
- evidence: read
- severity: low

## enableAudio's deferred bed setup applies a stale musicOn, overriding a toggle made in between
- where: apps/site/demos/platformer/usePlatformerAudio.ts:84 (enableAudio)
- scenario: the user clicks enable (musicOn = true is captured) and toggles music off before `engine.unlock()` resolves. toggleMusic mutes the bus. Then the `.then` runs `mute(!musicOn)` with the captured `true`, which unmutes it. The music plays while the UI says it is off. It should read the current value, for example from a ref.
- evidence: read
- severity: low

## Overlapping ducks restore the music early, under the second hit
- where: apps/site/demos/platformer/usePlatformerAudio.ts:171-177 (duckMusic)
- scenario: a hit at t = 0 schedules a restore at 260 ms. A second hit at t = 200 ms (a bonk after an enemy hit) ducks again, but the first timeout still fires at 260 ms and ramps the music back 60 ms into the second hurt sound. The earlier restore is never cancelled, so the duck after a later hit is cut short.
- evidence: read
- severity: low

## parseLevel rejects a typo'd glyph but silently accepts a level with no `S` or `G`, or several of them
- where: apps/site/demos/platformer/level.ts:72-73 (parseLevel)
- scenario: a level with no `S` spawns the player at (0, 0), half outside the level's corner. A level with no `G` puts the flagpole at x = 0, rising from y = 12. A duplicated `S` or `G` is resolved by last-wins. The function's own stated reason for throwing, that a hand-authored typo is otherwise invisible, applies equally here.
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

<!-- done: 11 findings, files read: 20 -->
