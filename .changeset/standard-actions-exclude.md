---
'@weasel-js/core': patch
---

`useStandardActions` takes an `exclude` list, so a consumer can bind its own.

The hook registered a fixed descriptor list, which left no way to suppress an
individual kit action. A consumer wanting its own align or distribute
keybindings got the kit's as well, and the two competed for the same keys.

`exclude` names ids to leave unregistered; an id naming no kit action is
ignored, and changing the list re-registers. `KIT_STANDARD_ACTION_IDS` is the
full list in registration order, so the ids are discoverable rather than
something to read out of the source.
