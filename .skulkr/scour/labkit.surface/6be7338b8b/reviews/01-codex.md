# Review saturation for `labkit.surface`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 12 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Clipping and flattened ancestry across document realms | 1 | 1 | 0 |
| 2 | Resize observation and overlapping registrations | 1 | 2 | 0 |
| 3 | Tile invalidation, scope lifetimes, and painter ordering | 0 | 2 | 1 |
| 4 | Local and device pixel rectangle conversion | 0 | 2 | 2 |
| 5 | Scroll listener ownership and surface registration hooks | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Cross-document tiles lose clipping or shadow ancestry

[clip.ts](packages/labkit/src/surface/clip.ts#L124) · Pass 1 · medium · Source-traced

The flattened-tree walk checks a parent against the module realm's ShadowRoot, and padding measurement similarly checks against its HTMLElement. For tiles rendered into a same-origin iframe from parent code, these checks miss the frame's own elements. As a result, ancestor traversal can stop at the shadow root and scroll clips can use border edges in place of padding edges. Shadow-scroll registration uses the same realm-dependent test.

### 2. Releasing one tile key can unobserve another key's element

[useElementWatch.ts](packages/labkit/src/surface/useElementWatch.ts#L30) · Pass 2 · medium · Source-traced

Watch registrations are stored by key, but the shared ResizeObserver observes each element only once. Registering the same element as both a container and a tile, or as two distinct tile IDs, is allowed. Releasing one key calls unobserve on the element even though another key still depends on it, so size-only changes stop reaching that surface watch.

Source and tests were left untouched.
