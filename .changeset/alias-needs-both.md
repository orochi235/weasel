---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

An alias row answers for the leaf it shows as well as for itself. It is shown only while its own `showIf` and its target's both hold, and enabled only while both `enableIf`s hold, and the target's side counts every group or section above the target. Before, only the alias's own conditions were read. `applyPrefConditions` and `prefScopeAt` apply the rule, so `PrefsForm`, `SelectionPanel`, `Bar`, and labkit's `ControlPanel` and `ControlMatrix` all follow it; in labkit a function passed to `.showIf` or `.enableIf` on the target or a group above it counts too.

Adds API: `applyPrefConditions` and `prefScopeAt` take `aliasOver`, the schema an alias's `of` names a leaf of when that is not the schema walked. `prefScopeAt` now answers for a `PrefSection` schema as well as a `PrefGroup`.
