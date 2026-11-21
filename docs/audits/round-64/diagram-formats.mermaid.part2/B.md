# Audit round 64 — diagram-formats.mermaid.part2

Note: commit 49e5a07e6aecc7037a5e3692706cf28dd58211c4 is not in this checkout; files were read at HEAD 6f634fabe1
(packages/diagram-formats unmodified in the working tree).

## A mind map's cloud outline is written as Mermaid's bang shape
- where: packages/diagram-formats/src/mermaid/mindmap/write.ts:11 (BRACKETS)
- scenario: a node read from `id)Cloud(` (Mermaid's cloud) gets outline `cloud`; writing it emits `id))Cloud((`, which
  is Mermaid's *bang* shape (parse.ts:28 reads `))…((` as `bang`). Mermaid then draws a bang where the source had a
  cloud. The writer should emit `)…(`, the cloud brackets; `cloud` is the outline both shapes read to, and the
  cloud is the one whose name it carries.
- evidence: read
- severity: low

## A Mermaid sequence page is named by an empty title statement over its front matter title
- where: packages/diagram-formats/src/mermaid/sequence/read.ts:157 (readMermaidSequence)
- scenario: `---\ntitle: Checkout\n---\nsequenceDiagram\n  title\n  A->>B: hi` — parse.ts:81 reads the bare `title` as
  text `''`, so `r.title ?? parsed.title ?? r.accTitle` is `''` and the page's name is `''`. Every other kind goes
  through `readPageName` (common/lines.ts:110), which skips an empty title and names the page `Checkout`
  (2026-11-20, 49692b62c6). The sequence reader also never warns that a title statement dropped a different front
  matter title, and its own front matter pass (parse.ts:107) warns only for `config:`/`displayMode:` lines, so any
  other front matter key is dropped silently where `readPageName` warns. One decision, two answers.
- evidence: read
- severity: low

## Radar ids rewritten to Mermaid's id syntax can collide
- where: packages/diagram-formats/src/mermaid/radar/write.ts:12 (item)
- scenario: a radar with axes `a b` and `a.b` (or `a b` beside an existing `a_b`) writes `axis a_b, a_b`; curves
  `x y` and `x.y` both write `curve x_y{…}`. Reading back gives two axes (or curves) sharing one id, and keyed
  curve values (`{a_b: 1}`) can no longer say which axis they mean. The other kinds make rewritten ids distinct with
  `mermaidIds` (common/text.ts:67); radar does a bare replace with no uniqueness pass.
- evidence: read
- severity: low

## A state's description read before its `state "…" as` line is thrown away
- where: packages/diagram-formats/src/mermaid/state/read.ts:77 (StateReader.walk, `state` branch)
- scenario: `stateDiagram-v2\n  A : waits for input\n  state "Idle" as A` — `describe` sets A's lines to
  `['waits for input']` with `described: true`, then the `state … as` branch does
  `Object.assign(d, { lines: ['Idle'], named: true })`, replacing them. The box reads "Idle" only; the description is
  dropped with no warning. Mermaid keeps both. The name should go first and the lines already described stay after
  it (as `describe` does in the other order).
- evidence: read
- severity: low

## A labeled choice diamond is written as a plain state with no warning
- where: packages/diagram-formats/src/mermaid/state/write.ts:52,61 (StateWriter.node)
- scenario: a `diamond` node with a text row ("Valid?") skips the `<<choice>>` branch (it needs no lines), is written
  as `state "Valid?" as X`, and reads back as a `roundRect`. The outline warning at line 61 exempts `diamond`, so the
  shape change is silent. Either warn that a choice holds no text (and the text or the shape was dropped), or write
  `<<choice>>` and warn of the dropped text.
- evidence: read
- severity: low

## Several start or end shapes in one scope collapse into one, and an unconnected one vanishes, silently
- where: packages/diagram-formats/src/mermaid/state/write.ts:41,45 (StateWriter.id, StateWriter.node)
- scenario: a page with two `start` shapes S1 and S2 at the top, `S1 → A` and `S2 → B`, writes `[*] --> A` and
  `[*] --> B`; the reader (read.ts:62) makes both one `[start]` node with two edges. A `start`/`end` shape with no
  connector is never written at all (`node` returns early for pseudo states and only transitions write `[*]`). A
  `start` shape a connector arrives at is written `X --> [*]` and reads back as an `end` (read.ts:71). No
  warning in either case, while the writer warns for every other shape it merges or drops.
- evidence: read
- severity: low

## The xychart reader drops a front matter title for its title statement without the warning the other charts give
- where: packages/diagram-formats/src/mermaid/xychart/read.ts:38 (readMermaidXychart)
- scenario: `---\ntitle: Revenue\n---\nxychart-beta\n  title "Sales"` — the chart and page are titled "Sales" and
  "Revenue" is gone with no warning. pie/read.ts:44, packet/read.ts:52, quadrant/read.ts:41, radar/read.ts:20 and
  timeline/read.ts:45 each warn "The front matter title was dropped…" for the same input. One decision, answered two
  ways.
- evidence: read
- severity: low

## The kanban writer mints against ids the board never writes, so a generated card id reads back as another
- where: packages/diagram-formats/src/mermaid/kanban/write.ts:47 (KanbanWriter.leaveUnwritten)
- scenario: a page whose first pool has one lane holding node `card-2`, plus a node `card-1` outside any lane (dropped,
  with a warning). The writer's mint is seeded from every entry of `this.ids` — all nodes and every pool's lanes —
  so it holds `card-1`, mints `card-2` for the lane's card, and leaves that card's id unwritten (`    [text]`). The
  reader seeds its mint only from ids in the file (read.ts:52), which has no `card-1`, so it mints `card-1`: the card
  comes back as `card-1`, not `card-2`. Same with a lane of a second pool, or any dropped node, named `column-N` /
  `card-N`. The seed should be the ids the board actually writes (the first pool's lanes and the cards in them).
- evidence: read
- severity: medium

## A packet field with an empty label is written as a gap and lost on reading, with no warning
- where: packages/diagram-formats/src/mermaid/packet/write.ts:28 (writeMermaidPacket)
- scenario: data fields `[{start: 0, end: 7, label: ''}, {start: 8, end: 15, label: 'Flags'}]` write `0-7: ""` —
  the same text the writer uses for a gap (line 26) — and read.ts:49 drops every unlabeled field, so the first field
  disappears from `fields` on the round trip. The writer warns for every other field it cannot keep (line 23) but
  not this one.
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

<!-- done: 9 findings, files read: 34 -->
