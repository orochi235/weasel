---
"@weasel-js/core": patch
"@weasel-js/d3": patch
"@weasel-js/font": patch
"@weasel-js/geom": patch
"@weasel-js/gestures": patch
"@weasel-js/history": patch
"@weasel-js/hud": patch
"@weasel-js/labkit": patch
"@weasel-js/modes": patch
"@weasel-js/svg": patch
"@weasel-js/theme": patch
"@weasel-js/ui": patch
---

Every package now declares `engines.node: ">=22"`, up from `">=20"`. Node 20
reached end of life on 2026-04-30, so the old floor advertised support for a
runtime that no longer receives security patches — a claim in each published
tarball that had quietly stopped being true. `@weasel-js/labkit` had no `engines`
field at all and now matches its siblings.

Nothing in the kit required a Node 20 feature, so this changes what is promised
rather than what runs. CI tests both ends of the range: the 22 floor and the 24
Active LTS the release and docs workflows build on.
