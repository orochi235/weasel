---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

`<SwitchRow>` joins `@weasel-js/ui`'s property rows: the same row as
`<CheckboxRow>`, drawn as an on/off switch.

labkit's `<ControlPanel>` now reads the annotation `f.boolean(…).toggle()`
writes and draws one, in a row of its own and in a paired cell. It drew a
checkbox for both before, so a schema asking for a switch got one in
`<PrefsForm>` and not in a lab.
