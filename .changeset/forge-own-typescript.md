---
'@weasel-js/forge': patch
---

forge depends on `typescript` `~6.0.2` itself instead of taking it as an optional peer, so its prop controls and API tables work in a project on TypeScript 7, which dropped the compiler API forge reads (`ts.sys` among it). npm installs forge's own copy beside the project's.
