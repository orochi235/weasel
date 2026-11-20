I couldn't write `.skulk/out/findings.md` because the permission was denied, so here is the whole findings document.

# Audit round 46: diagram.stencils

The frozen commit 6438325dbfdd7d007274232811abe60fc38c4f12 is not in this clone (`git cat-file` fails). The listed files have no uncommitted changes at HEAD 782733b19c, so I read that revision, and line numbers are HEAD's. `git log` wasn't approved, so I didn't review the last week's history.

## The UML interface stencil spells its stereotype `«interface»`, which the class writer and reader don't recognize
- where: packages/diagram/src/stencils/uml.ts:30 (UML_STENCILS, `uml-interface`)
- scenario: the interface's head rows are `«interface»` and `Interface`. Mermaid's class reader builds `<<interface>>` (`diagram-formats/src/mermaid/class/read.ts:108`, and `class.test.ts:27` expects it). The writer's `classParts` only treats `/^<<.*>>$/` as an annotation (`class/write.ts:26-27`). So exporting a palette interface (the umlClass type's notation is `class`) writes `class n1["«interface»"]`: the guillemet row becomes the class name. Because the empty attributes compartment is left out, only one divider remains (`rest.length === 1`), so the real name `Interface` lands in `names.slice(1)` and is written as an attribute. The annotation is lost, and an imported interface reads differently from a placed one. It should be `<<interface>>`, which is how `c4.ts` and `requirement.ts` spell their stereotypes.
- evidence: read
- severity: medium

## The ERD entity stencil's field rows put the attribute name where the ER reader and writer keep its type
- where: packages/diagram/src/stencils/erd.ts:12-14 (ERD_STENCILS, `erd-entity`)
- scenario: the stencil's rows are `{label:'id', value:'PK'}`, `{label:'name', value:'text'}` and `{label:'owner_id', value:'FK'}`, so the name is the label and a type or key is the value. Mermaid's ER reader builds the opposite: the type as label, and "name keys comment" as value (`er/read.ts:1-5,21-23,57`). The writer emits `${label} ${value}` (`er/write.ts:26`), and `ATTRIBUTE` (`er/parse.ts:36`) parses that as type then name. So a palette entity exports as `id PK`, `name text` and `owner_id FK`. Mermaid reads those as type `id` named `PK`, type `name` named `text`, and type `owner_id` named `FK`, and the PK and FK keys are lost. On the canvas a placed entity shows `id: PK` while an imported one shows `int: id PK`. The rows should be e.g. `{label:'int', value:'id PK'}`, `{label:'string', value:'name'}`, `{label:'int', value:'owner_id FK'}`.
- evidence: read
- severity: medium

## The abstract-class stencil marks abstractness only as italic, which the class writer drops without a warning
- where: packages/diagram/src/stencils/uml.ts:36-41 (`uml-abstract`)
- scenario: the class name and the `+ draw()` field are only `italic: true`. Mermaid's reader keeps abstractness as a `<<abstract>>` row, the same path as `<<interface>>`. The writer reads only text (`classParts`), so exporting writes an ordinary class with an ordinary `draw()` and no warning. That makes two ways of saying "abstract", and the stencil's way is lost on its own diagram type's notation.
- evidence: read
- severity: low

## The mind-map subtopic and note stencils use outlines the mindMap type's Mermaid notation can't write
- where: packages/diagram/src/stencils/mindMap.ts:16, 20 (`subtopic` stadium, `floating-note` note)
- scenario: the mindMap type's notation is `mindmap` (`diagramTypes/catalog.ts:75`). The writer's `BRACKETS` maps only rect, roundRect, ellipse, cloud and hexagon (`mermaid/mindmap/write.ts:11`). Any palette mind map with a subtopic, the most common node, exports with "Mermaid mind maps have five shapes; others were written plain". It reads back with no outline, so a stadium subtopic comes back as the default box. The palette's own default subtopic doesn't round-trip through its own notation.
- evidence: read
- severity: low

## The BPMN end event differs from a start event only by stroke width, so draw.io export writes it as a start event
- where: packages/diagram/src/stencils/bpmn.ts:13-16 (`end-event`)
- scenario: `end-event` uses outline `event`, the same as `start-event`, with only `style.strokeWidth: 4`. draw.io's mapping writes every `event` as `mxgraph.bpmn.event;outline=standard` (`drawXml/mapping.ts:13-14,50`), so draw.io shows a start event with a thick ring. In the other direction, draw.io's own end event (`outline=end`) falls to the catch-all `event` entry (`mapping.ts:53`) and reads back as a thin start event. Nothing in the node names it as an end event, so every outline-keyed format loses the distinction.
- evidence: read
- severity: low

## `expectStencilsBuild` checks row width against the text measured unstyled, so a bold or large row that overflows passes
- where: packages/diagram/src/stencils/stencils.fixture.ts:52 (expectStencilsBuild)
- scenario: `measure(row.data.text ?? '', {})` measures every row at 12px regular, but the row is laid out and drawn in its own style. For example, `central-topic` is bold 16px: 13 chars × 16 × 0.62 = 129 px versus 88 px unstyled. Its row could shrink to anything between those widths and the check, which claims "wide enough for its text", would still pass. It should measure with `row.data.style` (fontSize and bold or weight).
- evidence: read
- severity: low

## `expectStencilsBuild` counts only label and field rows, but header rows also become text nodes
- where: packages/diagram/src/stencils/stencils.fixture.ts:47-48
- scenario: `stencilInsertOps` emits a text node for `label`, `field` and `header` rows (`stencil.ts:100`), plus an aside node for a header's `aside` (`buildBody.ts:97-99`). The fixture's `textRows` filter leaves `header` out. Any stencil group with a header row, such as a table-style entity, fails "builds one node per text row" even when it builds correctly. The fixture and `stencilInsertOps` disagree about which rows become nodes.
- evidence: read
- severity: low

## `expectStencilsBuild` leaves its `console.warn` spy installed when an assertion fails
- where: packages/diagram/src/stencils/stencils.fixture.ts:38-57
- scenario: `vi.spyOn(console, 'warn').mockImplementation(...)` is restored only on the last line, not in a `finally`. No vitest config sets `restoreMocks`. In `describe.each([UML_GROUP, ERD_GROUP])` (modeling.test.ts:21) and the five-group `describe.each` in notations.test.ts, a failure in one group leaves `console.warn` muted. The next group's `spyOn` then reuses the same spy along with its recorded calls, so `expect(warn).not.toHaveBeenCalled()` fails there and blames the wrong group. Real warnings stay hidden for the rest of the file.
- evidence: read
- severity: low

## Files read
packages/diagram/src/stencils/architecture.ts
packages/diagram/src/stencils/bpmn.ts
packages/diagram/src/stencils/c4.ts
packages/diagram/src/stencils/containers.ts
packages/diagram/src/stencils/erd.ts
packages/diagram/src/stencils/flowchart.ts
packages/diagram/src/stencils/kanban.ts
packages/diagram/src/stencils/mindMap.ts
packages/diagram/src/stencils/network.ts
packages/diagram/src/stencils/org.ts
packages/diagram/src/stencils/requirement.ts
packages/diagram/src/stencils/state.ts
packages/diagram/src/stencils/stencils.fixture.ts
packages/diagram/src/stencils/uml.ts

<!-- done: 8 findings, files read: 14 -->