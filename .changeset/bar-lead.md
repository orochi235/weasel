---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A group or section drawn `as: 'bar'` takes `lead: 'label'`, which starts its line with its name ahead of its cells. `Bar` takes the same as a `lead` prop, over what its schema says, and every surface that draws a bar honors it. The asset editor offers it beside Overflow for a bar. New public API: `PrefBarLead`, `PrefGroup.lead`, `PrefSection.lead`, and `BarProps.lead`.
