---
"@weasel-js/core": minor
---

An Alt-drag clone runs the select tool's move behaviors that say what they do on a clone, through a new `clone` field on `MoveBehavior`. `snapToContainer` drops the copies into the container at their slots and leaves the originals where they were, and `snapBackOrDelete` makes no copy when the clone is released anywhere but a snap target. A clone behavior's `onEnd` is told `CloneEnd`, whose `copyOps` makes the copies under a given parent.

<!-- entry: new api -->
