---
"@weasel-js/core": patch
"@weasel-js/devtools": patch
---

Add `@weasel-js/core/devtools-protocol`: everything `@weasel-js/core/devtools` exports — the
protocol types, `DEVTOOLS_PROTOCOL`, the envelope tag, the transports, and the hook's constructors —
without installing a hook on import. `@weasel-js/core/devtools` re-exports it and still installs one.
`@weasel-js/devtools` now imports from the new entry, so mounting the panel no longer puts a hook in
the panel's own window; `createInPagePanelTransport()` still installs one when called.
