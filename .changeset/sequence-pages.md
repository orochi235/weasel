---
"@weasel-js/diagram-formats": patch
---

Sequence pages. `DocumentPage` gains `SequencePage` (`kind: 'sequence'`, `data: SequenceData`): `documentSpecs` draws
one as a sequence root, `documentFromScene` reads such a root back as one, and the SVG, PNG, and PDF page exports draw
it. The JSON and Mermaid formats hold sequence pages; Mermaid reads and writes `sequenceDiagram` — participants and
their types, every arrow, activations, notes, fragments, boxes, `create` and `destroy`, `autonumber`, and the title.
`scenePageKinds` and `formatTakes` say which formats can hold a scene without building its document. Breaking for a
caller that reads `page.data` as a `DiagramData` without checking `page.kind`. Page exports also now place a node's
children through its frame, where they had drawn them at their stored offset from the page's corner.
