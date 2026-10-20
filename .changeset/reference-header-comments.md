---
'@weasel-js/devtools': patch
'@weasel-js/svg': patch
---

The opening doc comments of `@weasel-js/devtools`'s entry and of `@weasel-js/svg`'s `serializePathD` module are marked `@packageDocumentation`, so the API reference reads them as the module's description instead of handing them to every name the file exports. No code changed.
