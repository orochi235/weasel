## A carriage return in sequence text is written raw, so the written diagram reads back as a broken statement and throws
- where: packages/diagram-formats/src/mermaid/sequence/syntax.ts:50 (mermaidSeqText), used by sequence/write.ts:57,114,120,125,162
- scenario: a message, note, participant label, fragment label or page name holding `\r` (a CRLF paste: `"a\r\nb"`). `mermaidSeqText` splits only on `\n`, so it writes `A->>B: a\r<br>b`. `parseSequence`'s `body()` splits lines on `/\r\n?|\n/`, so the reader sees `A->>B: a` and then a line `<br>b`, which `readStatement` throws on ("is not a sequence diagram statement"). Every other Mermaid writer spells `\r` (`mermaidEscaped`, `oneLine`, `spelledBreaks` all match `[\r\n]`); this one should too (treat `\r\n?` as a break, or spell `\r` as `#13;`). U+2028/U+2029 in a note fail similarly, since `NOTE` (sequence/parse.ts:41) has no `s` flag and its `(.*)$` cannot cross them.
- evidence: read
- severity: medium

## A kanban lane and a card sharing an id are written under one id, which the kanban reader rejects
- where: packages/diagram-formats/src/mermaid/kanban/write.ts:34 (KanbanWriter constructor)
- scenario: a pool lane with id `a` holding a node whose id is also `a` (lane ids and node ids are separate in `DiagramData`). `mermaidIds([...nodeIds, ...laneIds])` maps both to `a`, so the board is written as `  a[Col]` / `    a[Card]`. `readKanban`'s `claim` (kanban/read.ts:48) then throws `"a" names two items`. The same thing happens for a node listed as a member of two lanes: it is written twice under one id. The writer should give each written item its own id, because the reader keeps lanes and cards in one namespace.
- evidence: read
- severity: medium

## Sequence participant ids that start with `title`, `link`, `details` and so on, followed by a non-ASCII letter, read back as other statements
- where: packages/diagram-formats/src/mermaid/sequence/parse.ts:81,84,85 (readStatement); writer ids at sequence/write.ts:34
- scenario: the writer's `mermaidIds(…, { unicode: true, reserved: SEQUENCE_WORDS })` keeps the id `titleé` because it is a valid unicode id and not a reserved word. It writes `titleé->>B: hi`. In the reader, `/^title\b/i` matches, because `\b` is ASCII-only, so `é` counts as a boundary. The message is read as a title, its participant disappears, and the page name becomes `é->>B: hi`. `linksé`, `propertiesé`, `detailsé` (read as dropped menus) and `accTitleé` / `accDescré` (dropped) fail the same way. The keyword tests need a boundary that holds for unicode ids (for example `(?![\p{L}\p{N}_])` with `u`), or the writer must keep ids from opening with these words.
- evidence: read
- severity: medium

## A mind map node whose id is `accTitle` or `accDescr` and whose outline is a hexagon is read as an accessible description, and the node is lost
- where: packages/diagram-formats/src/mermaid/mindmap/write.ts:51-54 (writeMindmap); consumed at common/lines.ts:62 (statementsOf)
- scenario: a node with id `accTitle` and outline `hexagon`. The id matches `/^[\w-]+$/`, so it is written as-is: `  accTitle{{Text}}`. `statementsOf` matches `/^acc(Title|Descr)\s*(?::…|\{\s*(.*))$/`, takes the line as an `accDescr { … }` block, and never hands it to the mind map parser. The node and its subtree's link to it are gone (its children become a second root and throw, or hang off the wrong parent). The writer guards plain text with `readsAsStatement`, but it applies no guard to the id that opens a bracketed node.
- evidence: read
- severity: low

## The sankey writer drops a page name without a warning, unlike every other Mermaid plot writer
- where: packages/diagram-formats/src/mermaid/sankey/write.ts:22 (writeMermaidSankey)
- scenario: a sankey plot page with `name: 'Flows'` and no `data.title`, or with a title that differs from the name. The writer emits `titleLines(data.title)` only, so the name disappears and no warning is given. Pie, packet, quadrant, radar, timeline and xychart writers all call `warnDroppedPageName` in exactly this case. Either call it here, or write the page name as the front matter title when the data has none.
- evidence: read
- severity: low

## The sequence writer silently drops a box whose members are all undeclared participants
- where: packages/diagram-formats/src/mermaid/sequence/write.ts:77-94 (SequenceWriter.participants)
- scenario: `SequenceData` has `boxes: [{ id: 'b1', label: 'Team', members: ['A', 'B'] }]` and no `participants` entries for A and B, which are named only by messages. The box is opened only from the loop over `data.participants`, and line 92 (`declare({ id: m }, 2)` for undeclared members) is reached only after a declared member has triggered the box. So `box Team … end` is never written, and no warning says so. The "members that name no participant" warning does not fire either, because `named` includes ids that steps name.
- evidence: read
- severity: low

## A kanban card metadata value holding `]@{` makes the card's line read back wrong
- where: packages/diagram-formats/src/mermaid/kanban/write.ts:16-19 (metaValue); parsed by kanban/parse.ts:20 (ITEM)
- scenario: a card with text `x` and a field row `k` = `a]@{b`. It is written `    id[x]@{ k: 'a]@{b' }`. In `ITEM`, the greedy `\[(.*)\]` stops at the last `]` that still lets `@\{(.*)\}$` match, so the label becomes `x]@{ k: 'a` and the meta becomes `b' `. `metaOf` then throws (`cannot read "b'" as card metadata`), or the card's text is wrong. `bracketed` spells `]` in the text, but the meta value is written raw, and the label pattern is not quote-aware.
- evidence: read
- severity: low

## Files read
packages/diagram-formats/src/mermaid/kanban/parse.ts
packages/diagram-formats/src/mermaid/kanban/read.ts
packages/diagram-formats/src/mermaid/kanban/write.ts
packages/diagram-formats/src/mermaid/mindmap/parse.ts
packages/diagram-formats/src/mermaid/mindmap/read.ts
packages/diagram-formats/src/mermaid/mindmap/write.ts
packages/diagram-formats/src/mermaid/packet/read.ts
packages/diagram-formats/src/mermaid/packet/write.ts
packages/diagram-formats/src/mermaid/pie/read.ts
packages/diagram-formats/src/mermaid/pie/write.ts
packages/diagram-formats/src/mermaid/plots.fixture.ts
packages/diagram-formats/src/mermaid/quadrant/parse.ts
packages/diagram-formats/src/mermaid/quadrant/read.ts
packages/diagram-formats/src/mermaid/quadrant/write.ts
packages/diagram-formats/src/mermaid/radar/parse.ts
packages/diagram-formats/src/mermaid/radar/read.ts
packages/diagram-formats/src/mermaid/radar/write.ts
packages/diagram-formats/src/mermaid/requirement/parse.ts
packages/diagram-formats/src/mermaid/requirement/read.ts
packages/diagram-formats/src/mermaid/requirement/write.ts
packages/diagram-formats/src/mermaid/sankey/read.ts
packages/diagram-formats/src/mermaid/sankey/write.ts
packages/diagram-formats/src/mermaid/sequence/parse.ts
packages/diagram-formats/src/mermaid/sequence/read.ts
packages/diagram-formats/src/mermaid/sequence/syntax.ts
packages/diagram-formats/src/mermaid/sequence/write.ts
packages/diagram-formats/src/mermaid/state/parse.ts
packages/diagram-formats/src/mermaid/state/read.ts
packages/diagram-formats/src/mermaid/state/write.ts
packages/diagram-formats/src/mermaid/timeline/read.ts
packages/diagram-formats/src/mermaid/timeline/write.ts
packages/diagram-formats/src/mermaid/xychart/parse.ts
packages/diagram-formats/src/mermaid/xychart/read.ts
packages/diagram-formats/src/mermaid/xychart/write.ts

<!-- done: 7 findings, files read: 34 -->
