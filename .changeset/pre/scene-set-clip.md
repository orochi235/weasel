---
"@weasel-js/core": patch
---

A node's declared clip can now be changed after it is added: `scene.setClip(id, 'outline')` declares it and `scene.setClip(id, null)` clears it, as one undo step, refused on a locked node like `setUnits`. `reconcileSpecs` writes a changed `clip` in place through it, where before it removed the node and added it again. The two setters are typed together as `SceneDeclaredFieldSetters`, which `Scene` extends. `setUnits` no longer records an entry when given a scope equal to the one declared. This adds API.
