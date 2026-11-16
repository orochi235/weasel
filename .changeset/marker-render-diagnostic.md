---
'@weasel-js/core': minor
---

Headless renders and exports report a stroke's marker that nothing registered, as a `RenderDiagnostic` of the new kind `'marker'`.

Code that switches over `RenderDiagnosticKind` exhaustively gains a case to handle.

<!-- entry: api fix -->
