---
'@weasel-js/core': patch
---

A promised `produceFlavors` flavor that rejects now costs only itself. Chromium writes nothing when any flavor in a `ClipboardItem` rejects, and `useClipboardOps` then fell back to the well-known types alone, so a failed SVG export also lost the `application/x-weasel-clipboard+json` flavor, and a rejected `text/plain` lost everything. The copy now retries without the rejected flavors before falling back. Behavior fix, not breaking: a copy whose flavors all resolve writes exactly what it did before.
