---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

Pref leaf kinds are declared once, and every renderer is exhaustive

`@weasel-js/ui` carried its own copy of the pref-leaf union under a comment
saying to keep it in sync with core's field-for-field. It had drifted: ui's enum
leaf had neither `encoding` nor `options[].disabled`, so a dash-array
preference did not merely fail to select — choosing an option wrote the option
string over the stored dash array. labkit's two renderers were missing the
`paint` and `object` kinds outright.

ui's schema is now a rename re-export of core's declaration. The public `Pref*`
names are unchanged, and there is nothing left to keep in sync.

More importantly, all four renderer switches ended in `default:`, so adding a
built-in kind produced no error at any site and simply rendered nothing —
verified by adding one and typechecking. `ToolPrefLeaf` widens `kind` to
`string` so app-defined prefs can ride the same tree, which means a `never`
guard cannot sit on it directly. New from core: `TOOL_PREF_KINDS`, a
`Record<ToolPrefKind, true>` that a new kind fails to compile against first, and
`isBuiltinToolPref(leaf)`, which narrows to the closed union so each renderer
can discriminate and end in a `never`. App-defined kinds take the placeholder
path as before.

Dash-array preferences now select and commit correctly in `PrefsForm`: the enum
arm threads sibling values, routes through `encoding.read` / `encoding.write`,
and honors `option.disabled`. `SelectionPanel` already did all of this — it was
only the forked copy that could not express it.
