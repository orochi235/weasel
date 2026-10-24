---
"@weasel-js/core": patch
"@weasel-js/path-tools": patch
---

A path effect that hides its sources no longer treats a source that was already hidden when the effect was made as one it hid. Release leaves that source hidden, and Expand to Paths, Delete and Cut leave it in the scene; Set Path moving off it leaves it hidden too. The effect records those sources by position in a new `foundHidden` field beside `hideSources`, and a saved effect without one reads as before: it hid them all. `sourcesHiddenBy(node)` in core answers which sources an effect holds hidden.
