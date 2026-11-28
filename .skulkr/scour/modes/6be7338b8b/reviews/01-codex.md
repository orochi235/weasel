# Review saturation for `modes`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 9 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Registry ownership, versioning, and eligibility consistency | 1 | 1 | 0 |
| 2 | Decoration stack and subscription lifecycles | 0 | 1 | 1 |
| 3 | Scope invalidation and alpha normalization | 0 | 1 | 2 |
| 4 | Capability defaults, preset wiring, and property-test support | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Mutable mode definitions can leave canvas eligibility stale

[registry.ts](packages/modes/src/registry.ts#L34) · Pass 1 · P2 · Source-traced

The registry stores the caller's ModeDefinition objects by reference, and ModeDefinition exposes a mutable allows array. After a canvas has primed createActiveModeReader, pushing a tag into the active definition's allows array changes the answer from isToolEligible immediately. The canvas reader continues returning its old allowedCapabilities set because the mutation emits no notification and leaves getVersion unchanged. A tool can therefore be eligible in registry consumers while the canvas still gates it out.

Source and tests were left untouched.
