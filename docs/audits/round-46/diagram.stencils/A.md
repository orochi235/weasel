I couldn't write `.skulk/out/findings.md`: creating the file and its directory both need approval this session doesn't have. As the brief allows, the whole document is below.

One discrepancy: this checkout's HEAD is `782733b19c`, not the frozen commit `6438325dbf…` the brief names. I read the tree as it is, so the line numbers come from `782733b19c`.

```markdown
# Findings: diagram.stencils (round 46)

## The ERD entity stencil's attribute fields put the name in `label` and the type/key in `value`, the reverse of the ER reader and writer
- where: packages/diagram/src/stencils/erd.ts:12-14 (ERD_STENCILS, `erd-entity` rows)
- scenario: Place an `erd-entity` and export the page as Mermaid ER. `entityParts` (diagram-formats/src/mermaid/er/write.ts:26) writes a field as `${label} ${value}`. `readErDiagram` (er/read.ts:57) builds a field as `label: a.type` and `value: name keys comment`, so `label` is the type. The stencil's rows `{label:'id', value:'PK'}`, `{label:'name', value:'text'}` and `{label:'owner_id', value:'FK'}` write as `id PK`, `name text` and `owner_id FK`. `ATTRIBUTE` (er/parse.ts:36) reads those back as attributes of type `id`/`name`/`owner_id` named `PK`/`text`/`FK`, with no keys. The PK and FK markers are lost, and type and name swap. A placed entity shows `id: PK` while an imported one shows `int: id PK`, so one notation has two row layouts. The rows should be shaped like the reader's (`{label:'int', value:'id PK'}`).
- evidence: read
- severity: medium

## The UML interface stencil spells its stereotype `«interface»`, which the class writer does not read as an annotation, so it exports as a class named "«interface»" with "Interface" as an attribute
- where: packages/diagram/src/stencils/uml.ts:30 (UML_STENCILS, `uml-interface`)
- scenario: `classParts` (diagram-formats/src/mermaid/class/write.ts:26-30) takes annotations only from rows matching `/^<<.*>>$/`, and the class reader produces `<<interface>>` (class/read.ts:108; class.test.ts:27). For the stencil, `«interface»` becomes `names[0]`, the class name. The attributes compartment is empty, so `compartments` leaves it out and only one divider is written. `rest.length` is then 1, which sends `names.slice(1)` (that is, `Interface`) into `attributes`. The export is `class n1["«interface»"] { Interface … }` with no `<<interface>>`. It should be `class n1["Interface"] { <<interface>> … }`. The stencil and the reader answer the stereotype's spelling two ways.
- evidence: read
- severity: medium

## The abstract-class stencil marks abstraction only with italics, which the class writer drops without a warning
- where: packages/diagram/src/stencils/uml.ts:38-40 (`uml-abstract`)
- scenario: The name row is `{bold, italic}` and `+ draw()` is italic. `classParts` (class/write.ts:20-24) keeps only `row.text` and `label value`, so neither becomes Mermaid's `<<abstract>>` annotation or the `draw()*` abstract marker. A placed abstract class exports as a concrete class with a concrete method, and no warning is raised. Mermaid's own spellings, a `<<abstract>>` row and a `*` suffix on the method, would survive the export.
- evidence: read
- severity: low

## The mind map's subtopic stencil uses `stadium`, which the mind map writer has no brackets for, so every placed subtopic exports plain with a warning
- where: packages/diagram/src/stencils/mindMap.ts:16 (`subtopic`); also `floating-note` (`note`), :20
- scenario: The mind map type's notation is `mindmap`. `BRACKETS` in diagram-formats/src/mermaid/mindmap/write.ts:11 covers rect, roundRect, ellipse, cloud and hexagon only. Exporting any map built from the type's own palette therefore warns "Mermaid mind maps have five shapes; others were written plain", and the subtopic comes back on import as a plain node, not a stadium. A stencil group made for this notation can't round-trip through it.
- evidence: read
- severity: low

## `expectStencilsBuild` checks each row's width against text measured in the default style, not the row's own bold or font size
- where: packages/diagram/src/stencils/stencils.fixture.ts:52 (expectStencilsBuild)
- scenario: `measure(row.data.text ?? '', {})` measures at 12px, not bold. The central topic's row is bold 16px: `measure` gives it 13·16·0.62 ≈ 129px, against the 88px the check asks for. A row laid out narrower than its styled text still passes. The doc comment promises "wide enough for its text", but this measures the wrong text.
- evidence: read
- severity: low

## `expectStencilsBuild` leaves `console.warn` mocked when any assertion inside it fails
- where: packages/diagram/src/stencils/stencils.fixture.ts:38-57 (expectStencilsBuild)
- scenario: `vi.spyOn(console, 'warn').mockImplementation(() => {})` is restored only on the last line. It isn't in a `finally`, and no vitest config sets `restoreMocks`. When one stencil's `expect` throws, `console.warn` stays silenced for the rest of the file's tests, which hides warnings from them. This is state left behind by teardown.
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

<!-- done: 6 findings, files read: 14 -->
```

<!-- done: 6 findings, files read: 14 -->