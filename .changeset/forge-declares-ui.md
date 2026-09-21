---
'@weasel-js/forge': patch
---

Declare `@weasel-js/ui` as a dependency.

The workshop shell imports it, and forge's build leaves every `@weasel-js`
package external, so the published shell asked for a package forge never
declared. It only resolved when something else — labkit — happened to install it.
