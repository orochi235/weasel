---
'@weasel-js/labkit': patch
---

labkit gains `Specimen`: one page of the kit's controls and chrome, each in a small
working state, as a preview surface for a theme. It covers weasel-ui's buttons,
toggles, fields and pickers, property panels and rows, overlays, lists, tool chrome,
and editors and plots, and labkit's own toolbar, status bar, sidebars, legend, job
progress, zoom and scale readouts, floating panel and split. Popovers, dialogs and
toasts portal into the page, so they take the theme the page is under.
`SPECIMEN_SECTIONS` names its sections; the `labkit/Specimen` story renders it.
