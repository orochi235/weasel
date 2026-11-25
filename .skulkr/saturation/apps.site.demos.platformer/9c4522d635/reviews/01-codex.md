# Review saturation for `apps.site.demos.platformer`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 20 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Audio state reporting without a music bed | 1 | 1 | 0 |
| 2 | Fixed-step transition to the ending | 1 | 2 | 0 |
| 3 | Tile collision, one-way platforms and contact resolution | 0 | 2 | 1 |
| 4 | Camera bounds, level parsing and input ownership | 0 | 2 | 2 |
| 5 | Pose clip switching, scene synchronization and footstep booking | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Finishing silently before enabling audio leaves later audio state changes unreported

[usePlatformerAudio.ts](apps/site/demos/platformer/usePlatformerAudio.ts#L90) · Pass 1 · Low · Source-traced

Reach the flag before enabling audio. Enabling afterward unlocks the engine but deliberately creates no music bed. The context's state listener also requires a bed, so a later suspension or resume leaves the demo's status and enable control stale.

### 2. The world drops the remaining frame time when the outcome changes

[world.ts](apps/site/demos/platformer/world.ts#L270) · Pass 2 · Low · Source-traced

If a long frame reaches the pole on its first fixed step, advanceWorld stops stepping and zeros the accumulator, dropping the time remaining in that frame. frameWorld only runs the ending when it was already active at entry. The documented split gives that remaining time to the ending, but the flag slide waits until the next frame.

Source and tests were left untouched.
