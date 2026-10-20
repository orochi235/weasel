---
'@weasel-js/icons-plugin': patch
---

Walk the parsed module with the plugin's own walker over oxc-parser's `visitorKeys` instead of
oxc-parser's `Visitor`, which loads its walker with `require()` of an ES module. That load failed
under vitest's vm pools on Node 22, so any test importing the plugin's collector or rewriter
there threw `SyntaxError: Unexpected token 'export'`.
