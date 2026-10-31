---
'@weasel-js/diagram': patch
---

Sequence diagrams can be authored on the canvas. `useSequenceTools` (or `sequenceTools` outside React) builds the
tools in `SEQUENCE_TOOLS`: Participant clicks a lifeline in where the click falls between two, and on empty canvas
starts a new sequence (`startSequence`); Message drags from one lifeline to another, inserted at the row of the press
and previewed as it goes, a release on its own lifeline making a self-message; Note clicks a note over the nearest
lifeline, or beside it when the click is off to one side, and drags one across several; Fragment drags across rows to
wrap them. The host picks the participant kind, the arrow, and the fragment type through the options' readers. Each
tool binds its gesture on a sequence's heads, messages and notes as well as on open canvas, and each edit is one undo
entry through `commit`.

A click on a head, a message, a note, a fragment's tab, or a box's label strip selects the node drawing it, and
`createSequenceDeleteAction` turns Delete on such a selection into an edit of the sequence: a head removes its
participant and everything naming it. Fragments can be dragged to another row by their tab. `DiagramView` deletes a
sequence's selected parts through `onEditSequence`, and takes `tools` and `onToolsCreated` to host the tools. A
sequence's selected parts take no resize handles under `diagramResizable`.
