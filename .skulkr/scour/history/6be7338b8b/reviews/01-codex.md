# Review saturation for `history`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 18 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Journal commits, coalescing contracts, and live versus restored entry metadata | 1 | 1 | 0 |
| 2 | Snapshot validation, serialization cutoffs, and branch reachability | 0 | 1 | 1 |
| 3 | Undo and redo walks, rollback pairing, time lookup, and observer hooks | 0 | 1 | 2 |
| 4 | Branch switching, journal ownership, swap operations, and public entry points | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Journal commits can omit IDs touched by undo operations

[recording.ts](packages/history/src/recording.ts#L102) · Pass 1 · low · Source-traced

A journal commit passes both halves from appliedHalves to the parent's record call. Timed coalescing can replace the forward ops with a later batch that shares the same coalesce keys but exposes different args IDs, while leaving the original base ops in place for undo. The parent computes touchedIds from the forward half alone, so its entry view omits IDs that undo still touches. For serializable ops, restore computes the union of both halves, so the same entry exposes different IDs after a round trip.

Source and tests were left untouched.
