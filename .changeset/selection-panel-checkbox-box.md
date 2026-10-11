---
'@weasel-js/ui': patch
---

A `control: 'checkbox'` leaf in a `SelectionPanel` draws as a box whichever order the stylesheets load in. The panel's rule sharing a row among its controls tied on specificity with the checkbox's own `flex: none`, so where the panel's sheet came last the checkbox was stretched across the row, 210px wide in a 280px panel.
