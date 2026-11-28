# Review saturation for `icons`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 15 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Variant lifetime, synchronous registry notifications, and removal | 1 | 1 | 0 |
| 2 | Namespace claims, registration validation, and name round trips | 1 | 2 | 0 |
| 3 | React subscription snapshots and loader retry effects | 0 | 2 | 1 |
| 4 | Generated table exports and package entry-point isolation | 0 | 2 | 2 |
| 5 | Composite parsing and SVG mark geometry | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Removing a variant during its registration notice can strand its glyphs

[variants.ts](packages/icons/src/variants.ts#L61) · Pass 1 · medium · Source-traced

addTables emits a synchronous registry change before returning its release function. A subscriber removing the variant in that notification clears its loader and pending run before releases has the new disposer. When addTables returns, the old run writes the disposer back, but the variant is now unknown and future replace calls iterate states, so its glyphs and namespace claim can remain indefinitely.

### 2. Icon tables accept names that the public ref parser rejects

[registry.ts](packages/icons/src/registry.ts#L82) · Pass 2 · low · Source-traced

The add path checks only that namespace is a string and validates each glyph value. It accepts an empty namespace, a whitespace-containing name, or a colon in either component and publishes the concatenation as an IconRef via entries. Passing that emitted ref through toIconRef or toIconSpec then fails, so a registered glyph can appear in a picker but fail when its ref is read back from saved data.

Source and tests were left untouched.
