---
"@weasel-js/core": patch
"@weasel-js/react": patch
"@weasel-js/routing": patch
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
"@weasel-js/hud": patch
"@weasel-js/forge": patch
"@weasel-js/diagram": patch
"@weasel-js/diagram-formats": patch
"@weasel-js/menu": patch
"@weasel-js/symmetry": patch
"@weasel-js/devtools": patch
"@weasel-js/registry": patch
"@weasel-js/path-tools": patch
"@weasel-js/theme": patch
"@weasel-js/text": patch
---

The rest of the kit's stores notify through registry's `createEmitter`: the entered group, the snap
outcome, devtools roots and transports, kit settings, the menu host and menu controller, tool
options, `RunSlots`, the seam preview, the HUD list, the effect runners, the symmetry controller,
the devtools client, and forge's loupe and CSS-variable stores. A listener that throws is logged
and no longer stops the others, and a listener unsubscribed mid-notify is no longer called; the
menu host, `RunSlots` and the HUD list used to walk their live set. diagram, diagram-formats, menu,
symmetry and devtools now depend on `@weasel-js/registry`.

Structural comparisons that went through `JSON.stringify` use `deepEqual` instead, so key order no
longer makes two equal values differ (theme baking, diagram export's style diffs, trial marks, path
constraints, unit rows, toolbar dock drops). PrefSchemaEditor's three-way merge keeps
`JSON.stringify`, because there a reordered key is an edit.

New: `sameList(a, b, same?)` in `@weasel-js/registry`, whether two lists hold equal elements in
order. `@weasel-js/react`'s `sameList` is now this function, and ui's `samePath` is an alias of it.
