---
'@weasel-js/core': patch
'@weasel-js/text': patch
'@weasel-js/hud': patch
'@weasel-js/svg': patch
'@weasel-js/d3': patch
'@weasel-js/ui': patch
---

Depend on `font` and `core` as exact peers

`@weasel-js/font` and `@weasel-js/core` keep registries that consumer code
writes into — registered faces and glyph-ready subscribers in one, content
handlers and paint kinds and shape painters in the other. Two physical copies
in a tree are two registries, so a face registered into one while layout
resolves against the other lays out nothing and the canvas is blank.

Exact sibling pins are what produced the duplicate: a consumer mixing two
weasel releases left npm no choice but to nest a second copy, silently. As
peers, the same mix is an `ERESOLVE` at install time. `font` is now a peer of
`core`, `hud` and `text`; `core` is now a peer of `svg`, joining `d3`, `hud`
and `ui`, whose `>=` ranges tighten to exact so no version mix resolves by
accident.

**This can break an install that currently succeeds.** Anyone resolving a
mixed set of weasel versions by luck now gets an install error instead of a
blank canvas. That is the point, but it is a break.

`labkit` deliberately keeps `core` as an ordinary dependency: its build aliases
every core entry point to core's built files and inlines them, so it never
resolves core at the consumer and has nothing to peer. The flip side is that
labkit ships its own copy of core's registries, so a consumer using both still
has two — this change does not address that.
