# Review saturation for `diagram.sequence`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 24 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Box membership and visual spans after regrouping participants | 1 | 1 | 0 |
| 2 | ID validation for inserted fragment subtrees | 1 | 2 | 0 |
| 3 | Message, activation, and destruction row geometry | 0 | 2 | 1 |
| 4 | Selection, text edits, and scene rebuild behavior | 0 | 2 | 2 |
| 5 | Authoring hit placement, drag tools, and generated parts | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Adding a box can make the remainder of an existing box straddle it

[author.ts](packages/diagram/src/sequence/author.ts#L103) · Pass 1 · Medium · Source-traced

Start with participants a,b,c,d and a box holding a,b,c. Add a box holding b,d. The order becomes a,b,d,c and the old box keeps a,c. Its layout spans from a to c, enclosing the new box's columns despite their separate memberships. Regrouping should leave the surviving boxes with contiguous members.

### 2. Inserting a fragment can introduce IDs already used by its descendants

[authorSteps.ts](packages/diagram/src/sequence/authorSteps.ts#L54) · Pass 2 · Medium · Source-traced

Insert a fragment with a fresh fragment ID and a nested message that reuses an existing message's ID. The insertion checks only the outer fragment ID. The duplicate makes ID-based edits ambiguous and generated scene parts can share IDs when the sequence is rebuilt. The same collision would have been refused if the message were inserted directly.

Source and tests were left untouched.
