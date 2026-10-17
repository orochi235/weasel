---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

The command palette titles a variant with its action's label and its own ("New: A4"), and a search matches that title. A variant whose label already opens with the action's keeps it ("Zoom In"). `actionItemTitle` gives the title; menus and bars still show the variant's own label. `@weasel-js/core` also exports `ActionDisabledReasonValue`.
