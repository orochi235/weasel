---
'@weasel-js/labkit': patch
---

A dropdown row's label in the params panel now sits on the same rail as every
other row's. A select row aligns to its value's baseline by default, which put
its label ~1.6px below the centered slider and checkbox rows around it, so a
column of labels stepped at each dropdown. The panel sets
`--wzl-prop-row-align-text: center`; the `@weasel-js/ui` default is unchanged.
