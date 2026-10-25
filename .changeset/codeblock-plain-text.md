---
'@weasel-js/ui': patch
---

`CodeBlock` draws an uncolored token as text rather than a `<span class="token plain">` of its own, and wraps a line's tokens in a second span only when it numbers lines. A schema literal in the asset editor drops from about 3,300 elements to 1,800. Nothing it renders looks different, but a stylesheet that targeted `.token.plain` no longer matches anything.
