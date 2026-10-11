---
'@weasel-js/ui': patch
---

`PrefSchemaEditor`'s Auto value row is a switch before the leaf's control: off, nothing is stored, and the control shows the default and takes no input; on, the value starts from the default. The pin label and the words "not set" are gone. A `PrefRenderer` may carry `group: true` to say its control is several, or one a `<label>` may not wrap, so its row is drawn as a group; the editor's option list and pair editor now say so.
