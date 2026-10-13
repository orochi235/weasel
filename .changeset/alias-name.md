---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Fixes: a vertical bar inside a `PrefsForm` named the popover of an alias with no name of its own with the empty string. It is named for the leaf the alias shows, as a standalone `Bar` names it, and an alias that shows nothing is named `Alias` in both.

Adds API: `prefAliasName(alias, target?)` in `@weasel-js/prefs`, what an alias is called wherever one is drawn: its own name, else its target's, else `Alias`. `prefAliasedLeaf`, the bars, and the row a form or a `ControlPanel` draws for an alias of nothing all name one through it.
