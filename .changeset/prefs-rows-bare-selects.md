---
"@weasel-js/ui": patch
---

A select anywhere in a property row now drops its box and reads as its value, a bold underlined word, however deep the surface around it wraps the control. Prefs forms and inspector cells used to keep the boxed look with its caret. `--wzl-select-weight` sets the value's weight.

`PrefsForm` takes `layout="list"`: the root's children down one column with no panel around them, nested groups as sub-panels. A group whose name is the empty string now draws no heading, as `ToolPrefGroup` documents; it drew an empty one. `PrefSchemaEditor`'s attributes use the list layout, so its fields sit directly under the pane's header.
