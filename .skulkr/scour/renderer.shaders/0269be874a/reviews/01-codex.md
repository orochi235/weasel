# Review saturation for `renderer.shaders`

Snapshot `0269be874a5adbbc9f6a3bd2b580f6a1dd1dea4f`. The tracked working tree was clean at the start of review. Scope is the 18 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | GLSL picking rewrite and sentinel handling | 2 | 2 | 0 |
| 2 | Uniform declaration scanning across preprocessor branches | 1 | 3 | 0 |
| 3 | Program refresh, fallback and context restore | 0 | 3 | 1 |
| 4 | Batch shader slots, hull coverage and trim guards | 0 | 3 | 2 |
| 5 | Glyph sampling, paint alpha and built-in shader variants | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. ID injection can collide with a custom shader helper

[idOutput.ts](packages/renderer/src/shaders/idOutput.ts#L58) · Pass 1 · Medium · Source-traced

The shader rewrite reserves two generated names but omits weasel_main from its collision check. A valid GLSL fragment that already defines a no-argument helper with that name gets two definitions after injection and can fail compilation even in a color-only frame.

### 2. A zero pick ID overwrites the ID behind it

[idOutput.ts](packages/renderer/src/shaders/idOutput.ts#L74) · Pass 1 · Medium · Source-traced

The zero value decodes as no claim, but it passes validation and is written with an opaque ID alpha. A later group with pickId 0 can therefore replace an earlier positive ID with zero. The same value is also treated as a claim by the group ID composite.

### 3. Conditional struct members lose larger array declarations

[extractUniformNames.ts](packages/renderer/src/shaders/extractUniformNames.ts#L214) · Pass 2 · Low · Source-traced

When conditional branches redefine a struct, member declarations are merged by name alone. If a later branch declares more slots for the same member, its extra slots never reach lookup even when that branch is the one the driver compiled. Uniform writes to those slots are then skipped.

Source and tests were left untouched.
