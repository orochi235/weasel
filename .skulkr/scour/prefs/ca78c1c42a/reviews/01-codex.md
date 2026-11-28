# Review saturation for `prefs`

Snapshot `ca78c1c42a92855c2a3e72ac749e4854d9c29849`. The tracked working tree was clean at the start of review. Scope is the 37 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Mixed-version migration writes and schema merge contracts | 2 | 2 | 0 |
| 2 | Scoped snapshots, selector writes and weighted reads | 0 | 2 | 1 |
| 3 | CSS output, host attributes and stylesheet integration | 0 | 2 | 2 |
| 4 | Store lifecycle, reset plans and selection sources | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Migrating an older alias can overwrite a current preference

[migrate.ts](packages/prefs/src/migrate.ts#L111) · Pass 1 · P2 · Source-traced

With target version one, store an old key stamped zero and its replacement key stamped one. A migration renames the old key to the replacement key. The current value is correctly withheld from the migration callback but the final value write ignores the set of current records, replacing the newer preference with the stale value. The same problem occurs when another writer reintroduces the old key after migration.

### 2. Merging schemas that share a section key throws a TypeError

[merge.ts](packages/prefs/src/merge.ts#L15) · Pass 1 · P2 · Source-traced

Merge two valid groups whose children at the same key are sections with different member leaves. Sections pass the non-leaf check, but use members instead of children. The recursive call passes undefined to Object.entries and throws. The documented merge accepts groups and reserves collisions for leaves, so shared sections should preserve both sets of members.

Source and tests were left untouched.
