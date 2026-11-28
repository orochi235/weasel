# Findings: diagram-formats.mermaid.part1

## An explicit solid dash (`dash: []`) is written as a dotted/dashed Mermaid line
- where: packages/diagram-formats/src/mermaid/flowchart/write.ts:94 (MermaidWriter.link)
- scenario: a graph page whose edge has `colors: { dash: [] }` (solid, as `paint.ts` and the DOT and draw-XML writers read an empty dash; Mermaid's own `dashOf` also yields `[]` for `stroke-dasharray:` with no value) is written with `dash !== undefined` as the test, so the flowchart writes `-.-`/`-.->`, the block diagram `-.-`, the class diagram `..`, and the ER diagram `..`. Read back, those edges carry `dash: [4, 4]`, so a solid connector turns dotted. It should be written as a solid line, the way the DOT writer's `dash.length > 0` test treats it.
- evidence: read (flowchart/write.ts:94, block/write.ts:103, class/write.ts:118, er/write.ts:69; compare dot/write.ts:26,47 and paint/src/paint.ts:320)
- severity: medium
- fix: packages/diagram-formats/src/mermaid/flowchart/write.ts, packages/diagram-formats/src/mermaid/block/write.ts, packages/diagram-formats/src/mermaid/class/write.ts, packages/diagram-formats/src/mermaid/er/write.ts
- size: line
- cause: the Mermaid writers and the other writers decide "dashed" differently (`!== undefined` against `length > 0`)
- confidence: sure

## The class writer silently drops a box's extra head lines when the box has two dividers
- where: packages/diagram-formats/src/mermaid/class/write.ts:29 (classParts)
- scenario: a node with rows `[label "Order", label "aggregate root", divider, label "id: int", divider, label "total()"]`. `names` is `["Order", "aggregate root"]`. With `rest.length > 1`, attributes are `rest[0]` and methods `rest.slice(1)`, so `names.slice(1)` ("aggregate root") goes nowhere and no warning is raised. With zero or one divider the same lines are kept as members. The extra line should be kept as a member, or dropped with a warning, the same way on every path.
- evidence: read
- severity: low
- size: line
- cause: `names.slice(1)` used on only one branch
- confidence: sure

## The journey writer checks a title or section name for emptiness before stripping its syntax characters
- where: packages/diagram-formats/src/mermaid/journey/write.ts:47 (writeMermaidJourney; also :49)
- scenario: `data.title` is `"#;"` or a section is named `":"`. The guard (`data.title?.trim()`, `section.name.trim() !== ''`) tests the raw text, then `plain` strips every character, so the writer emits a bare `  title ` or `  section ` line. Mermaid's journey grammar needs text after `title`/`section`, so the file fails to parse there. The local reader accepts it, which hides the problem. Step names avoid this because `stepName` runs after `plain` and falls back to `(untitled)`. The emptiness test should run on the stripped text, as it does for steps and actors.
- evidence: read
- severity: low
- size: line
- cause: emptiness checked before `plain`, not after
- confidence: sure

## The gantt writer emits a bare `section` or `title` line for an empty name
- where: packages/diagram-formats/src/mermaid/gantt/write.ts:92 (writeMermaidGantt; settingLines:71)
- scenario: a gantt whose section `name` is `''` (the local reader produces this from a bare `section` line), or whose `title` is `''` or only whitespace. The writer tests only `!== undefined`, so it writes `  section ` / `  title `. Mermaid's gantt grammar needs text after either keyword, so its parser rejects the file. An empty name should be treated as no name: the section's tasks join the one before, with the existing warning, and the title line is left out.
- evidence: read
- severity: low
- size: line
- cause: `!== undefined` used where an empty-text test is needed
- confidence: likely

## The block writer warns that a grid skip of 0 was dropped
- where: packages/diagram-formats/src/mermaid/block/write.ts:69 (BlockWriter.level → gridCount)
- scenario: a grid layout whose `skips` gives an item `0` (no gap). `gridCount` rounds it to 0, finds `whole < 1`, and warns "Mermaid block spaces are whole numbers from 1; others were dropped." The output is right (no `space` line), but the warning reports a loss that did not happen. A skip of 0 should be read as no skip, with no warning.
- evidence: read
- severity: low
- size: line
- cause: gridCount's lower bound of 1 is applied to skips, where 0 is valid
- confidence: sure

## Files read
packages/diagram-formats/src/mermaid/architecture/parse.ts
packages/diagram-formats/src/mermaid/architecture/read.ts
packages/diagram-formats/src/mermaid/architecture/write.ts
packages/diagram-formats/src/mermaid/block/parse.ts
packages/diagram-formats/src/mermaid/block/read.ts
packages/diagram-formats/src/mermaid/block/write.ts
packages/diagram-formats/src/mermaid/c4/kinds.ts
packages/diagram-formats/src/mermaid/c4/parse.ts
packages/diagram-formats/src/mermaid/c4/read.ts
packages/diagram-formats/src/mermaid/c4/write.ts
packages/diagram-formats/src/mermaid/class/parse.ts
packages/diagram-formats/src/mermaid/class/read.ts
packages/diagram-formats/src/mermaid/class/write.ts
packages/diagram-formats/src/mermaid/common/header.ts
packages/diagram-formats/src/mermaid/common/lines.ts
packages/diagram-formats/src/mermaid/common/meta.ts
packages/diagram-formats/src/mermaid/common/number.ts
packages/diagram-formats/src/mermaid/common/styles.ts
packages/diagram-formats/src/mermaid/common/text.ts
packages/diagram-formats/src/mermaid/er/parse.ts
packages/diagram-formats/src/mermaid/er/read.ts
packages/diagram-formats/src/mermaid/er/write.ts
packages/diagram-formats/src/mermaid/flowchart/lex.ts
packages/diagram-formats/src/mermaid/flowchart/parse.ts
packages/diagram-formats/src/mermaid/flowchart/read.ts
packages/diagram-formats/src/mermaid/flowchart/write.ts
packages/diagram-formats/src/mermaid/format.ts
packages/diagram-formats/src/mermaid/gantt/parse.ts
packages/diagram-formats/src/mermaid/gantt/read.ts
packages/diagram-formats/src/mermaid/gantt/write.ts
packages/diagram-formats/src/mermaid/gitgraph/parse.ts
packages/diagram-formats/src/mermaid/gitgraph/read.ts
packages/diagram-formats/src/mermaid/gitgraph/write.ts
packages/diagram-formats/src/mermaid/journey/read.ts
packages/diagram-formats/src/mermaid/journey/write.ts

<!-- done: 6 findings, files read: 35 -->
