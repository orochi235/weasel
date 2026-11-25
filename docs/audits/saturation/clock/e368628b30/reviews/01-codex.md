# Review saturation for `clock`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 13 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Signed rate ramps and frame-boundary crossings | 1 | 1 | 0 |
| 2 | Playback holds and external seeks at pass boundaries | 1 | 2 | 0 |
| 3 | Range validation and pass arithmetic at accepted numeric limits | 1 | 3 | 0 |
| 4 | Declaration and override transitions, including reset | 0 | 3 | 1 |
| 5 | Registry shadowing and frame observer lifecycle | 0 | 3 | 2 |
| 6 | Mix following, public exports, and recorded positions | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A reversal inside one frame can miss the end of the run

[clock.ts](packages/clock/src/clock.ts#L176) · Pass 1 · Medium · Source-traced

On a 1000 ms run at 990 ms, ramp from +1 to −1 over 100 ms and sync once at the end of that interval. The playhead reaches 1015 ms halfway through, but the integrated displacement is zero, so it is left at 990 ms and starts moving backward. The intended behavior, covered by shorter-frame tests, is to stop at the first endpoint reached.

### 2. An external seek to the other side of a pass boundary leaves a hold active

[hold.ts](packages/clock/src/hold.ts#L139) · Pass 2 · Low · Source-traced

Hold at the end of a 100 ms pass on a looping clock, then call seek(100, 'start'). The seek changes pass and phase and emits a notification, but the hold compares only elapsed and stays active. A later span change moves the playhead back to the old hold target despite the external seek.

### 3. An accepted small duration can produce an infinite pass and NaN phase

[place.ts](packages/clock/src/place.ts#L16) · Pass 3 · Low · Source-traced

Set duration to Number.MIN_VALUE on a looping clock and seek to 1 ms. Duration validation accepts this positive value, and the elapsed value is finite, but elapsed divided by duration overflows. The pass remains Infinity after the adjustment and phase becomes NaN, even though phase is documented to be between zero and one.

Source and tests were left untouched.
