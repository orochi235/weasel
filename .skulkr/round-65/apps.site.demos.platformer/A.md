## Two enemies touching the player in one step cost two lives
- where: apps/site/demos/platformer/world.ts:156 (stepWorld), apps/site/demos/platformer/entities.ts:73 (resolveContacts)
- scenario: `resolveContacts` gets a snapshot of `g.invuln` and emits one `hurt` per overlapping live enemy. The `else` branch in `stepWorld` then applies each one: `g.invuln = INVULN; g.lives--` and a knockback. The invulnerability the first hit grants never suppresses the second. Walkers pass through each other, so two of them can overlap the player at once (two enemies meeting mid-walk, or the 40-enemy swarm the demo inserts at the player). Two overlapping enemies cost 2 lives in one step, 3 or more end the run on the spot, and each hit also plays `hurt`, ducks the music and pushes an "ow" callout. Every other hit source (spike, bonk, fall) costs at most one life per step, and invulnerability is meant to cover everything after the first hit. The second and later `hurt` contacts should be ignored once `g.invuln > 0`.
- evidence: read
- severity: medium

## A walker placed with no floor under it hangs in mid-air and reverses every step
- where: apps/site/demos/platformer/entities.ts:34 (createEnemies), apps/site/demos/platformer/entities.ts:50 (stepEnemy)
- scenario: Enemies have no gravity. `createEnemies` snaps `y` to the bottom of whatever row `at` lands in, and `stepEnemy` only probes the floor *ahead*. When the tile under the enemy is air, `floorAhead` is false on every step, so the enemy flips `vx` in place forever, floating. The demo's swarm button (`SceneScrollerDemo.tsx` `swarm`) calls `createEnemies` at `player.y - 40`. With the player on the row-14 floor that is row 12, so the enemies sit on top of row 13, which is air everywhere except the two one-way platforms and the goal ledge. Nearly all 40 freeze in the air, jittering their eyes left and right. An enemy with nothing standable under it should fall, or be placed on the floor below.
- evidence: read
- severity: medium

## The left and right walls stop above row 0, so a body above the level can leave it sideways
- where: apps/site/demos/platformer/level.ts:111 (tileAt)
- scenario: `tileAt` returns EMPTY for `cy < 0` before it checks `cx`. So above row 0, the columns `cx < 0` and `cx >= cols` read as air. The doc says "The left and right edges read SOLID so a body can never walk out of the level". But a body whose whole box is above row 0 (y < -11 for the 22-unit player) walks through x = 0 or x = widthPx unopposed. That needs a level with standable tiles within about 4 tiles of the top (the jump peaks near 93 units): any level `parseLevel` accepts, though not the shipped `WORLD`, where the highest standable row is 11. The player then falls outside the level and dies by the out-of-bounds rule. The edge columns should read SOLID at every row, or the doc should say otherwise.
- evidence: read
- severity: low

## Falling out of the level is the one hit that doesn't duck the music
- where: apps/site/demos/platformer/world.ts:186 (stepWorld)
- scenario: Spikes (l.124), an enemy hit (l.175) and a ?-block bonk outside invulnerability (l.146) each do `lives--`, `hooks.sound('hurt')` and `hooks.duck()`. The fall-out branch does `lives--` and plays `hurt` but never calls `hooks.duck()`. So the one life loss that also teleports the player back to spawn plays its hurt sound over full-level music, while every other life loss drops the bed under it (`duckMusic` in `usePlatformerAudio`). That is the same decision, "a hit ducks the music", answered two ways.
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

<!-- done: 4 findings, files read: 20 -->
