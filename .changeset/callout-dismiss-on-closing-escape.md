---
'@weasel-js/ui': patch
---

`Callout`: `onDismiss` fires for an Escape only when that Escape closes the callout. With a menu open inside it, such as a `ComboBox`'s, Escape closes the menu and the callout stays up, and `onDismiss` used to fire anyway. Under `CalloutTrigger` the consumer's `onOpenChange` is unchanged.
