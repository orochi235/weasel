---
'@weasel-js/core': patch
---

Release held keys when the window loses focus

A window that blurs mid-hold never delivers the keyup, so every in-flight
`key-held` handle stayed engaged until that key was pressed again — holding
Space and tabbing away left the hand tool on the hotkey stack indefinitely.

The gesture dispatcher now fires the `key-held` up phase for each held key on
window blur. Consumers that hand-rolled this reset can drop it; ongoing
invocations see a normal `onEnd`.
