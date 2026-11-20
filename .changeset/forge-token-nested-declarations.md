---
'@weasel-js/forge': patch
---

A lens's Token readout finds a color declared after a nested rule inside a style rule, such as `.card { .title { … } color: var(--wzl-fg); }`.

<!-- entry: fix -->
