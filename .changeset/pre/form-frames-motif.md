---
"@weasel-js/ui": patch
---

A settings form's framed groups draw through `MotifFrame`, so a `<DefaultMotif>` an app sets reaches them: the columns layout's groups (`group`) and the groups inside them (`subpanel`), and every `as: 'panel'` group in `PrefsForm`, `PrefsPane` and `SelectionPanel`. With no such default they keep their own look, now the new `well()` motif: a sunken box, or a rule down the leading edge, whose spacing and title type each form sets through `--wzl-well-*` properties. A pane's panel stays a `region` named by its title, and a leaf marked `heading` still draws its control inside the heading.
