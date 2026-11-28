# Review saturation for `parallax`

Snapshot `ca78c1c42a92855c2a3e72ac749e4854d9c29849`. The tracked working tree was clean at the start of review. Scope is the 6 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Live option ownership and degenerate viewport guards | 2 | 2 | 0 |
| 2 | Periodic visibility, bleed and numerical boundary correction | 0 | 2 | 1 |
| 3 | Draw order, transforms, effects and source error isolation | 0 | 2 | 2 |
| 4 | Wrapper redraw forwarding, exports and regression fixtures | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Reading live plane options exposes mutable state without redraw notification

[createParallaxPlane.ts](packages/parallax/src/createParallaxPlane.ts#L26) · Pass 1 · P2 · Source-traced

Create a plane with pan {x: 0, y: 1}, subscribe to it, and mutate the object returned by get by setting its nested pan.x to 1. The public options type permits this write. The next draw uses the new pan, but no subscriber is notified. Calling set with that already-mutated pan afterward is also silent because it compares the copy to the mutated internal snapshot.

### 2. A non-invertible view still draws world copies when its collapsed axis is untiled

[createTiledLayer.ts](packages/parallax/src/createTiledLayer.ts#L111) · Pass 1 · P3 · Source-traced

Draw a layer with period 100, a positive canvas size, unit x scale and zero y scale. viewportWorldRect reports infinite height, but tileRange short-circuits the untiled y axis to index zero, so the count and safe-integer checks accept the lattice. World source draw callbacks run for each horizontal copy under the invalid view even though the outer transform collapses the result. This defeats the finite-span guard when a collapsed axis is the commonly untiled axis.

Source and tests were left untouched.
