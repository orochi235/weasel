# Audit 72 — diagram-formats.mermaid.part1

## Block reader: a `space` before a links line lands on a later block, not the link line's first new block
- where: packages/diagram-formats/src/mermaid/block/read.ts:81 (BlockReader.walk)
- scenario: `space` on one line, then `A --> B` with A new. The links branch declares A and B but neither reads nor resets `skip`, so the gap is recorded for whatever fresh block or group comes next (or warned as trailing). Expected: A is placed after the gap, as the items branch does.
- evidence: read
- severity: medium

## Block writer drops connector colors without a warning
- where: packages/diagram-formats/src/mermaid/block/write.ts:84 (BlockWriter.link)
- scenario: an edge with `colors.stroke` (or label color) on a block-notation page is written as a bare link; nothing in the writer warns, while the architecture writer warns for the same loss (architecture/write.ts:107). Expected: a warning that link colors were dropped (block diagrams have `linkStyle`-less links here).
- evidence: read
- severity: low

## Architecture writer drops container colors without a warning
- where: packages/diagram-formats/src/mermaid/architecture/write.ts:107 (writeArchitecture)
- scenario: a container with `colors.fill` on an architecture page: the "no styles" warning checks only nodes and edges, so the group is written uncolored with no warning.
- evidence: read
- severity: low

## Architecture writer turns an empty service label into the service's id
- where: packages/diagram-formats/src/mermaid/architecture/write.ts:63 (ArchWriter.node)
- scenario: a non-junction node with no text (`lines: []`) is written `service x` with no brackets; the reader reads `textLines(s.title ?? s.id)` (read.ts:70), so it comes back labeled `x`. Writing `[ ]`/`[]` (title present but empty) would keep it empty.
- evidence: read
- severity: low

## C4 writer reads edge colors from `e.colors`, not the resolved style it uses for markers
- where: packages/diagram-formats/src/mermaid/c4/write.ts:82 (C4Writer.rel)
- scenario: an edge whose stroke/label color comes from its resolved style (`edgeStyleIn`, e.g. a page/theme edge style) rather than `e.colors`: markers are taken from the resolved style, but `relColors(e, e.colors)` writes only the edge's own colors, so the resolved color is silently lost. Same split in the element path (`colors(n.id, n.colors)`). Inference: whether a theme-resolved color differs from default depends on `dataEdgeStyle`.
- evidence: read
- severity: low

## Class and ER writers rename ids their own readers accept (hyphens, namespace dots)
- where: packages/diagram-formats/src/mermaid/class/write.ts:44 (ClassWriter constructor); packages/diagram-formats/src/mermaid/er/write.ts:47 (writeErDiagram)
- scenario: the class reader takes ids `[\w-]+` and namespaces `[\w.-]+` (class/parse.ts:36,82), the ER reader `[\w-]+` (er/parse.ts:33-34), but both writers call `mermaidIds` with the default ASCII rule `^[A-Za-z_]\w*$`. Reading `namespace com.example { class Foo }` and writing it back gives `namespace com_example`, plus a "container titles were dropped" warning because the label `com.example` no longer equals the id; `class my-class` and ER entity `LINE-ITEM` come back as `my_class` / `LINE_ITEM` with a bracketed label. Expected: pass an `id:` rule matching what the reader reads.
- evidence: read
- severity: medium

## Class writer loses the solid/dashed distinction of open vs filled arrows without a warning
- where: packages/diagram-formats/src/mermaid/class/write.ts:35 (HEADS) with class/read.ts:22 (headMarker)
- scenario: the reader derives the arrow marker from the line (`..>` → `arrow-open`, `-->` → `arrow`). The writer writes both markers as `<`/`>`, so a solid edge ending in `arrow-open` reads back as `arrow`, and a dashed edge ending in `arrow` reads back as `arrow-open`; no warning is given.
- evidence: read
- severity: low

## ER writer drops connectors to containers silently
- where: packages/diagram-formats/src/mermaid/er/write.ts:58 (writeErDiagram)
- scenario: an edge from an entity to a container: `!ids.has(e.to)` → `continue` with no warning (the class writer warns for the same case, class/write.ts:132). The containers warning does not say their connectors go too.
- evidence: read
- severity: low

## Flowchart reader loses the `v` direction: it upper-cases the header's direction, then looks up the lowercase key
- where: packages/diagram-formats/src/mermaid/flowchart/parse.ts:98 (parseFlowchart) with flowchart/read.ts:17,250 (DIRECTIONS, readFlowchart)
- scenario: `graph v` (accepted by `FLOWCHART_HEADER` in format.ts:105, and listed in DIRECTIONS as `'v': 'down'`): parse stores `restOf().toUpperCase()` = `V`, `getOwn(DIRECTIONS, 'V')` is undefined, so the page gets no direction. It happens to fall back to down here, but an unknown direction (`flowchart XY`) is dropped the same silent way with no warning. The `'v'` key can never match.
- evidence: read
- severity: low

## Gantt, journey and gitGraph writers drop a page name without a warning
- where: packages/diagram-formats/src/mermaid/gantt/write.ts:73 (writeMermaidGantt); packages/diagram-formats/src/mermaid/journey/write.ts:30 (writeMermaidJourney); packages/diagram-formats/src/mermaid/gitgraph/write.ts:60 (writeMermaidGitGraph)
- scenario: a plot page named `Roadmap` whose gantt/journey/gitgraph data has no title (or another title) writes neither the name nor a warning, so it reads back unnamed or named by the title. docs/unruled.md (2026-11-21) rules that chart writers warn via `warnDroppedPageName` (common/lines.ts:122); pie, packet, quadrant, radar, sankey, xychart and timeline do, these three do not.
- evidence: read
- severity: low

## `accTitle { … }` is read as an accessible description
- where: packages/diagram-formats/src/mermaid/common/lines.ts:68 (statementsOf)
- scenario: `accTitle { Foo }` matches the acc regex with `acc[3]` set; both brace branches assign `accDescr`, never `accTitle`, so the page is not named and a "descriptions dropped" warning fires. Either read it as the title or reject it; assigning it to the description is wrong either way.
- evidence: read
- severity: low

## `headerWord` treats an unclosed `---` as front matter running to the end, so detect says no
- where: packages/diagram-formats/src/mermaid/common/header.ts:48 (headerWord)
- scenario: a file starting `---` with no closing `---` (e.g. a horizontal-rule-like first line, then `flowchart TD`): headerWord skips every line and returns null, so `detect` rejects it and `kindOf` falls to FLOWCHART; `frontMatter`, which requires the closing fence, would read no front matter and the header is `---`. The two decide "is this front matter" differently.
- evidence: read
- severity: low

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

<!-- done: 12 findings, files read: 35 -->
