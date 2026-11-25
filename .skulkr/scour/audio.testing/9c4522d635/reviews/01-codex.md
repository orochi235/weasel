# Review saturation for `audio.testing`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 14 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Fake context clock and suspension behavior | 1 | 1 | 0 |
| 2 | Renderer startup, suspend/resume, and exception cleanup | 0 | 1 | 1 |
| 3 | Native and worklet fake source lifetimes and dispatch | 0 | 1 | 2 |
| 4 | Timer ordering, graph walkers, and signal measurement guards | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. The fake context advances audio time while suspended

[fakeAudioContext.ts](packages/audio/src/testing/fakeAudioContext.ts#L172) · Pass 1 · Low · Source-traced

The fake context changes state on suspend but _advance still increments currentTime and dispatches due source endings regardless of state. Tests that drive this clock while suspended can observe scheduled audio work finishing during a pause, which obscures errors in code that waits for the audio clock to resume.

Source and tests were left untouched.
