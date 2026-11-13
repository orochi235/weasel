---
'@weasel-js/core': minor
---

In path edit on the path a text-along effect hides, a click on the effect's curved text opens that text for editing.

The `pathEdit` preset registers the `editEffectText` action for it, bound to a click on a body; an anchor of the open path under the click keeps the click. `effectsShowing(scene, source, role)` answers the effects hiding a source, which a host's path-edit scope lights so the text stays drawn at full strength and takes the click.

<!-- entry: new api -->
