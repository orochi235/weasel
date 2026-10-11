---
'@weasel-js/ui': patch
---

A field inside an `as: 'panel'` box is drawn on the plain surface, in `SelectionPanel` (a panel section, and a panel inside an object leaf) and in `PrefsForm`'s rail layout. The box and a field's frame both defaulted to the sunken surface, so in light mode, where a field has no border, a text or number field in a panel was the panel's own color and could not be seen.
