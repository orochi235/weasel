---
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

A lab says how much room its chrome takes.

`<Lab density>` picks the theme's density axis for the lab's own shell —
`'compact'`, `'comfortable'` (the default, unchanged) or `'roomy'`. The trials
and their instruments are unaffected: this sizes the header, the sidebar, the
tool rail and the palette around them.

A lab that is the whole window rather than a panel beside one reads better at
`'roomy'`, so weaselforge takes it: its chrome goes from 13px body text and
24px controls to 15px and 28px. A story's frame keeps its own density, which
is still the workshop's `Density` global.

Get Info was a 40rem box in a full-width window, narrow enough to wrap a story's
file path onto a second line. It is 52rem now.
