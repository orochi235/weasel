---
'@weasel-js/ui': patch
---

A `Dialog` `bodyClassName` that set `flex` could lose to the dialog's own `flex: 1`, depending on stylesheet order. That default now sits with the body's other overridable defaults, so the consumer class wins. The doc no longer says a click outside closes the dialog: it does only with `isDismissable`.
