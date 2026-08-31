---
'@weasel-js/labkit': patch
---

Add `span` to `PropertyRow` for a full-width row

Making a row take the whole width of a `pack="pairs"` list or a `<Subpanel>`
meant typing the private class name `lk-property-list__span` into `className`
and hoping it stayed spelled that way. `<PropertyRow span>` now does it.
