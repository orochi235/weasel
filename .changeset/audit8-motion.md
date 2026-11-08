---
'@weasel-js/animator': patch
'@weasel-js/gestures': patch
'@weasel-js/kernel3d': patch
---

`setWeights` weighs a joint named like an `Object.prototype` member (`constructor`, `toString`) as its own joint, where it used to drop it and write the weights onto the prototype's function; `dropSkinJoints` hands back the same skin for such a name when the skin does not weigh it.
Canceling a `cycleVertexColors` cycle leaves alone an override set on the same node and channel since, and a second cancel does nothing.
A release of a pointer the recognizer never saw pressed no longer ends the multitouch gesture the held fingers are making.
`keySpecFromKey` and `keySpecFromCode` print a key named like an `Object.prototype` member as itself rather than throwing or answering a function, and `key('constructor+K')` throws as for any unknown modifier.
kernel3d's pick and snap indexes share one box-validity test and one padding.
