---
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

A config section can lay out its own rows: `.section(label, { layout, pack })` puts
every row under that heading in the given label layout and grid packing, over the
panel's `layout` and `pack`. Say it on any one node in the section; the resolved
`SectionSpec` carries both. Other sections keep the panel's.

forge's Globals section in a trial's Settings now uses `{ layout: 'inline', pack:
'pairs' }`: two globals to a row, each with its label beside its dropdown.
