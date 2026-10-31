---
'@weasel-js/diagram': patch
---

A sequence diagram can be built from nothing with pure edits of its `SequenceData`: `addParticipant` (with
`newParticipant` minting one), `removeParticipant`, `setParticipantOutline`, `insertMessage` with a named arrow from
`SEQ_ARROWS`, `insertNote`, `insertMark` for activations, creations and destructions, `wrapSteps` to put a run of
steps in a loop, alt, opt, par, critical, break or colored region, `addSection`, `removeSection`, `setFragmentType`,
`unwrapFragment`, `removeStep` and `removeStepAt`, `setMessageArrow`, `setMessageActivation`, `addBox`, `removeBox`
and `setAutonumber`. `freshSeqId` mints an id nothing in the sequence uses.

Removing a participant removes every message to or from it, every mark naming it, and it from every note and box; a
note or box left naming no one goes too. Fragments stay, even emptied.
