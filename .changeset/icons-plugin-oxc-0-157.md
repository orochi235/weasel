---
'@weasel-js/icons-plugin': patch
---

Depends on `oxc-parser` 0.157.0, up from 0.156.0. The parser now rejects some TypeScript-only syntax in plain JavaScript files, such as an optional class member or a TypeScript default export; the plugin parses `.ts` and `.tsx` files as TypeScript, as before.
