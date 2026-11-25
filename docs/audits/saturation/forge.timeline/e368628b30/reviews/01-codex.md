# Review saturation for `forge.timeline`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 12 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Playhead URL restoration across stories with and without clocks | 1 | 1 | 0 |
| 2 | Playhead URL writes during route transitions | 1 | 2 | 0 |
| 3 | Clock declarations, span overrides, and own-clock lifecycle | 0 | 2 | 1 |
| 4 | Transport commands, pause and speed, and pass boundaries | 0 | 2 | 2 |
| 5 | Timeline declarations, URL number formatting, and fixtures | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Returning through an untimed route can discard a timed story’s saved playhead

[RoutePlayhead.tsx](packages/forge/src/timeline/RoutePlayhead.tsx#L48) · Pass 1 · Medium · Source-traced

appliedRef stores the last route that had a clock, rather than tracking navigation. After visiting timed story A, navigate to an untimed story and then return to a URL for A with a specific t. The untimed story has no clock to update the ref, so A can skip fromUrl on remount. toUrl then replaces the requested time with the current clock position, or removes it at the span start.

### 2. The outgoing trial can write its playhead into the incoming route

[RoutePlayhead.tsx](packages/forge/src/timeline/RoutePlayhead.tsx#L46) · Pass 2 · Low · Source-traced

toUrl writes the current hash without checking that it still names the route this clock owns. When navigation changes the hash before React has removed the old subscription, a pause, seek, or span update from the outgoing clock can replace the incoming route's t. The hashchange handler checks route ownership but the clock subscription does not.

Source and tests were left untouched.
