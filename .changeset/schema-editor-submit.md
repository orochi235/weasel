---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` takes `onSubmit(changes, literal)`. Given, the Changes pane draws a Submit button, disabled while nothing has changed, that hands over the changes since `original` and the schema as a TypeScript literal. When `onSubmit` returns a promise the button reads "Sending…" until it settles, then "Sent" or "Failed"; it offers to submit again once the changes are different ones. The callback's type is exported as `SubmitChanges`.
