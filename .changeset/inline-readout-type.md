---
'@weasel-js/ui': patch
---

An inline property row's value readout now draws in the same type as a block row's. The inline layout puts the readout after the control, outside the label it used to inherit its font from, so it fell back to whatever the page's font was — the browser's default serif at 16px on a bare page.
