---
"@weasel-js/path-tools": patch
---

Set Spine and Release Spine move the `hidden` flag as Set Path does where a blend hides its sources. Set Spine hides the path it lays the blend along, or records it in `foundHidden` where it was hidden already, and shows the spine it replaces unless another effect still hides it or the blend found it hidden. Release Spine shows the spine on the same terms, counting every selected blend let go of that spine.
