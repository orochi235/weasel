## Quadrant axis ends holding `-->` are written quoted but read back split inside the quotes
- where: packages/diagram-formats/src/mermaid/quadrant/write.ts:14 (text) / packages/diagram-formats/src/mermaid/quadrant/parse.ts:18 (axisOf)
- scenario: a quadrant chart with `x: { low: 'a-->b', high: 'c' }`. `text()` sees `-->` and quotes it with `mermaidQuoted`, which does not escape `-->`, so the line is `x-axis "a-->b" --> c`. `axisOf` takes the first `-->` with `rest.indexOf('-->')`, ignoring quotes, so it reads low `"a` and high `b" --> c` (`textOf` cannot unquote either half). With no high end, `x-axis "a-->b"` reads back as low `"a`, high `b"`. Expected: low `a-->b`, high `c`. Either the writer should spell `-->` (for example `#45;-->`) inside the quotes, or `axisOf` should skip a `-->` inside a quoted span.
- evidence: read
- severity: medium

## Sequence writer emits `Note over : text` for a note with no participants, which the reader rejects
- where: packages/diagram-formats/src/mermaid/sequence/write.ts:123 (SequenceWriter.steps, note branch)
- scenario: a sequence step `{ kind: 'note', over: [], text: 'x' }` (for example after its participants were removed) is written as `Note over : x`. The reader's NOTE regex needs at least one non-colon character before the `:`, and the line holds no arrow, so `readMermaidSequence` throws "is not a sequence diagram statement" on the writer's own output. Expected: the note dropped with a warning, or written over a participant.
- evidence: read
- severity: medium

## State writer drops a pool's lane labels without a warning
- where: packages/diagram-formats/src/mermaid/state/write.ts:79 (StateWriter.cluster, pool branch)
- scenario: a pool with lanes labeled "Left" and "Right" is written as regions split by `--`. `scope(lane, …)` writes each lane's contents, but the lane's `label` is never written and no warning is added. The reader mints the lanes as `X-region-N` with no label. Expected: a warning that region labels were dropped, the way every other dropped attribute in this writer gets one.
- evidence: read
- severity: low

## State writer drops a fork/join bar's text without a warning
- where: packages/diagram-formats/src/mermaid/state/write.ts:51 (StateWriter.node)
- scenario: a node with `outline: 'bar'` and `lines: ['sync']` is written as `state id <<fork>>`. Its `lines` are computed but never written, and no warning is added. A diamond with text gets a warning at line 64, and a bar with text does not. Expected: a warning that bars hold no text.
- evidence: read
- severity: low

## Sequence writer drops a `create` step for a participant missing from `participants`, without a warning
- where: packages/diagram-formats/src/mermaid/sequence/write.ts:124 (SequenceWriter.steps, create branch)
- scenario: steps hold `{ kind: 'create', participant: 'C' }`, then a message to `C`, and `data.participants` has no `C`. `participants.find` returns undefined, so nothing is written and no warning is added. `C` is also left out of the declarations because it is in `created`. The reader then auto-declares `C` at the message, and the create step is lost. Expected: write `create participant C`, as the box path does for undeclared members (`declare({ id: m })`), or warn.
- evidence: read
- severity: low

## Mind map reader reads a bang node as a cloud without a warning
- where: packages/diagram-formats/src/mermaid/mindmap/read.ts:15 (SHAPE_OUTLINES)
- scenario: `mindmap\n  root))Boom((` parses as shape `bang` and is read with outline `cloud`, the same as `)Boom(`, and no warning is added. The writer then writes it as a cloud `)Boom(`, so the bang shape is lost on a round trip and the user is not told. Expected: a warning that bang nodes were read as clouds, as icons and classes get.
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

<!-- done: 6 findings, files read: 34 -->
