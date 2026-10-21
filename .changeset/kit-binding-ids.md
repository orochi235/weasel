---
"@weasel-js/core": patch
"@weasel-js/routing": patch
"@weasel-js/ui": patch
"@weasel-js/path-tools": patch
"@weasel-js/rig": patch
"@weasel-js/kernel3d": patch
"@weasel-js/diagram": patch
"@weasel-js/guides": patch
"@weasel-js/hud": patch
"@weasel-js/minimap": patch
"@weasel-js/symmetry": patch
"@weasel-js/labkit": patch
---

Every binding the kit ships now declares an id, so a binding override names it by that id rather
than by its owner and position: `undo.key`, `rect.drag`, `nudge.left.big`, `selection.rotate.handle`,
`tool.activate.rect`. The scheme is `<owner>.<role>`, the owner being the action for an action's own
binding and the tool or entry for a contribution's (`docs/taxonomy.md`, "binding override"). An
override written against a positional id such as `select#3` no longer reaches its binding.

An action's `defaultBinding` that was a bare spec is now a one-entry `{ spec, opts: { id } }` array;
code reading `defaultBinding` as a spec reads it through `actionBindings`.
