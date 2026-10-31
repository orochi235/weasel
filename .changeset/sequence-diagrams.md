---
"@weasel-js/diagram": patch
---

Sequence diagrams. `SequenceData` holds participants and steps — messages, notes, activations, `create` and
`destroy`, and fragments with sections — plus boxes and `autonumber`; `sequenceSpecs` draws it as one root node
holding the data, every head, lifeline, message, activation, note, and fragment a child of it, each in the theme's
roles. `moveStep`, `moveParticipant`, `reconnectMessage`, and `setSequenceText` are the edits as pure functions;
`DiagramView`'s new `onEditSequence` turns them on as drags and in-place text editing, and `diagramSequence` does the
same on a scene that is the document, each edit one undo entry. New outlines: `boundary`, `control`, `entity`,
`collections`, and `queue`. Additive: sequence roots and parts take no connectors and are left alone by
`themeWrites`, while `applyDiagramTheme` draws them again in the new theme.
