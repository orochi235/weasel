---
'@weasel-js/registry': patch
---

A child extension registry lists its ids among its parent's in registration order when the parent is any `ExtensionRegistry`, not only one `createExtensionRegistry` made in the same copy of the package.

<!-- entry: fix -->
