---
'@weasel-js/core': patch
---

`features/selection` gets a barrel, and core's main barrel reaches its overlay
layers and ambient context only through it. No export changes name or shape.

The entry had been held back as needing a design pass, on the grounds that
selection is protocol-shaped. It is — but the protocol (`SelectionApi`,
`useSelection`, `ChromeState`, `MULTI_RESIZE_TARGET_ID`) lives in
`core/selection`, below this directory, because affordances and tools both read
it and the layering runs `core` → `affordances` → `tools` → `features`. So the
barrel covers what is built *on* the protocol and says so, rather than moving
the protocol up to join it. `docs/taxonomy.md` said the protocol lived under
`features/`; corrected.
