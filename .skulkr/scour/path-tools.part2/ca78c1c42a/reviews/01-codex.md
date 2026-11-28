# Review saturation for `path-tools.part2`

Snapshot `ca78c1c42a92855c2a3e72ac749e4854d9c29849`. The tracked working tree was clean at the start of review. Scope is the 37 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Anchor data through cutting and joining, and face selection bounds | 3 | 3 | 0 |
| 2 | Outline conversion batches, replacement order and error propagation | 0 | 3 | 1 |
| 3 | Path effect settings, source visibility, retargeting and release | 0 | 3 | 2 |
| 4 | Gesture previews and replay, topology commands, and tool wiring | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Cut pieces can borrow anchor data from another contour at a crossing

[pieceOrigins.ts](packages/path-tools/src/pathCommands/pieceOrigins.ts#L39) · Pass 1 · P2 · Source-traced

Give two crossing line subpaths distinct constant per-anchor stroke widths, then cut the second subpath at their crossing. The new endpoint belongs to the second line, but pieceOrigins projects its position onto the entire original path. nearestOnPath keeps the first command at equal distance, so it records the first line's anchors. The cut piece can acquire the first line's width at its new endpoint and taper toward it.

### 2. Joining a default-width path can widen it to the retained path's width

[joinAnchorData.ts](packages/path-tools/src/pathCommands/joinAnchorData.ts#L72) · Pass 1 · P2 · Source-traced

Join a retained path with base width 8 and per-anchor widths to a second path with a painted stroke whose width is omitted. The second path's stroke originally defaults to width 1. Its anchors enter the joined array as NaN, which resolves through the retained stroke's base width of 8, so they inherit the wrong width despite the join explicitly constructing a per-anchor width channel.

### 3. Shape Builder accepts fractional face indices and then crashes in merge mode

[shapeBuilder.ts](packages/path-tools/src/shapeBuilder/shapeBuilder.ts#L66) · Pass 1 · P3 · Source-traced

Build a plan with at least one face and call its public commit method with [0.5] and merge. The range filter accepts 0.5. The subsequent lookup of cut[0.5] returns undefined and accessing first.path throws. A fractional value identifies no face and should be ignored like an out-of-range index.

Source and tests were left untouched.
