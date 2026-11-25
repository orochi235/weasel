# Review saturation for `forge`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 30 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Story test mounting and initial state parity | 1 | 1 | 0 |
| 2 | Story test cleanup across pending setup and successive runs | 1 | 2 | 0 |
| 3 | URL serialization and structured knob round trips | 1 | 3 | 0 |
| 4 | CSF argument inference, mapping, and local updates | 0 | 3 | 1 |
| 5 | Protocol transport, schema reconstruction, and frame answers | 0 | 3 | 2 |
| 6 | CLI argument parsing, output configuration, and public entry points | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Story tests can render native stories with null before their initial state is seeded

[runStory.tsx](packages/forge/src/test/runStory.tsx#L37) · Pass 1 · Medium · Source-traced

TestTrial supplies null on first render and relies on StoryTrial's effect to seed initialState. The isolated frame and index initialize before invoking the story render. A native story using state immediately, such as Counter.stories.tsx reading state.n, can throw before seeding, and runStory keeps the first render error even if the following render succeeds.

### 2. A timed-out story test can mount again after the next run cleans it up

[runStory.tsx](packages/forge/src/test/runStory.tsx#L127) · Pass 2 · Medium · Source-traced

If setup.prepare is still pending when the next run calls leftover cleanup, the old container is removed and no root exists to unmount. When the old setup resolves it still mounts a React root into that detached container, because the continuation never checks whether cleanup already ran. Detached effects and callbacks can execute during a later test.

### 3. Encoding a cyclic knob throws instead of leaving it out of the route

[url.ts](packages/forge/src/route/url.ts#L117) · Pass 3 · Medium · Source-traced

Arrays and plain objects are sent directly to JSON.stringify without handling values JSON cannot serialize. A cyclic object is accepted by the frame's structured-clone checks, but changing a routed knob to such a value can throw in RouteKnobs' synchronization effect. A structured value containing a BigInt also throws. The encodeKnob contract says a value a param cannot carry yields undefined.

Source and tests were left untouched.
