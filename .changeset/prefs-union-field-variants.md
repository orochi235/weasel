---
'@weasel-js/prefs': patch
---

A condition on a field of a `union` that several variants describe differently is checked against every variant: `checkPrefConditions` no longer warns that `{ path: 'fill.d', is: '' }` never holds because the first variant's `d` is an object while another's is a string. `prefShownReader` shows such a field through the variant the value holds, so one variant's `encoding` is no longer applied to another's field.
