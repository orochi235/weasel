---
'@weasel-js/core': patch
'@weasel-js/forge': patch
---

`stableStringify` writes a bigint as `{"$type":"bigint","value":"10"}` and a reference to an object that contains it as `{"$type":"cycle"}`, the tags devtools serialization uses, instead of throwing. Forge compares story args with it, so a story whose args hold a cyclic object used to throw once its config came back through the frame's port; it now compares that config with its default as it should.
