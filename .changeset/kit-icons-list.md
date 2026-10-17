---
'@weasel-js/ui': patch
'@weasel-js/forge': patch
---

`@weasel-js/ui/kit-icons` exports `kitIcons`, core's and ui's icon tables in one list, for a registry that should hold every kit glyph without the build plugin. Forge's workshop and story frames register it in place of their own copy of the list. Additive.
