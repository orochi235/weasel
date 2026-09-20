---
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

`EligibilityState.heldTriggers` is gone. Nothing populated it: a declared
`Eligibility.offhand` already reaches the hotkey tier by id, because the
`tool.offhand` action the declaration registers pushes the tool's id onto the
active-tool context's hotkey stack, and `engagedIds` is what `liveScope`
reads. Populating the set instead would have given the same tier a second
source of truth — raw key state tracked beside the gesture that already owns
the hold — with release order to reconcile between them.

`offhand` is untouched. Construct `EligibilityState` without the field; a
consumer reading it has to read `engagedIds` instead.
