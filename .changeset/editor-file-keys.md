---
'@weasel-js/editor': patch
---

`useNewCommand`, `useOpenCommand` and `useSaveCommand` register a document's New, Open and Save the way `useCommand` does, bound to Cmd/Ctrl+N, O and S unless `keys` names others; `keys: null` binds none. `FILE_KEYS` holds the three defaults.
