# Review saturation for `diagram-formats`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 39 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Native document loading and sequence drawing contracts | 1 | 1 | 0 |
| 2 | DOT lexer termination and parser boundary checks | 1 | 2 | 0 |
| 3 | Graph export loss reporting for connector routes | 1 | 3 | 0 |
| 4 | Scene page ownership, placement, and export coordinates | 0 | 3 | 1 |
| 5 | DOT strict edges, defaults, labels, and cluster membership | 0 | 3 | 2 |
| 6 | Page metadata, template assembly, and SVG export wiring | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Native JSON accepts a sequence page that cannot be drawn

[jsonFormat.ts](packages/diagram-formats/src/jsonFormat.ts#L38) · Pass 1 · Medium · Source-traced

Import a native file with a sequence page whose data is {}. The reader accepts the object and returns no warnings because it checks required collections only for graph pages. documentSpecs then calls sequencePageSize and sequenceLayout, which reads the missing participants list and throws. The import should reject that page at the format boundary.

### 2. An unfinished DOT block comment is silently swallowed

[lex.ts](packages/diagram-formats/src/dot/lex.ts#L42) · Pass 2 · Low · Source-traced

Read a complete graph followed by an opening block-comment marker with no closing marker. The lexer's end helper returns the input length on a miss, and the block comment branch advances to EOF without an error. The graph parser accepts the file, while other unclosed DOT constructs trigger line-numbered failures.

### 3. Graph exports silently omit generated connector bends

[graphWrite.ts](packages/diagram-formats/src/graphWrite.ts#L117) · Pass 3 · Low · Source-traced

Export a graph with a connector whose visible bends are stored in routed, as diagram routing edits store them. DOT omits the bends but the shared warning checks only waypoints, so the export reports no route loss. An otherwise identical connector with authored waypoints produces the warning.

Source and tests were left untouched.
